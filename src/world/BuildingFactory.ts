import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CITY_BUILDING_PLACEMENTS } from './CityLayout';
import { InstanceTransform, createInstancedMesh } from './InstancedMeshBuilder';
import { batchInstancedMeshes, batchStaticMeshes } from './StaticGeometryBatcher';

interface BuildingConfig {
  width: number;       // meters
  depth: number;       // meters
  floors: number;      // accessible stacked floors
  facade: number;
  base: number;
  trim: number;
  window: number;
  windowEmissive?: number;
  fireEscape?: boolean;
  waterTower?: boolean;
  glassRatio?: number;
}

export interface BuildingBounds {
  x: number;
  z: number;
  hx: number;
  hz: number;
}

interface BuildingMaterialSet {
  facade: THREE.Material;
  base: THREE.Material;
  trim: THREE.Material;
  floor: THREE.Material;
  ramp: THREE.Material;
  window: THREE.Material;
}

const FLOOR_HEIGHT = 3.2;       // 3.2m per floor
const WALL_THICKNESS = 0.24;    // 24cm
const SLAB_THICKNESS = 0.16;    // 16cm
const DOOR_WIDTH = 1.8;         // 1.8m lobby opening
const DOOR_HEIGHT = 2.55;       // 2.55m
const RAMP_WIDTH = 1.55;        // 1.55m internal stair/ramp width
const EXTERIOR_OFFSET = WALL_THICKNESS / 2 + 0.035;

const NYC_BUILDING_TYPES: BuildingConfig[] = [
  // Brick apartment block
  { width: 14, depth: 16, floors: 5, facade: 0x7a3f2e, base: 0x3d332d, trim: 0x2a2420, window: 0x9ec6d6, windowEmissive: 0x203844, fireEscape: true, waterTower: true },
  // Limestone office
  { width: 16, depth: 14, floors: 7, facade: 0x9d9684, base: 0x5f5b52, trim: 0x3b3933, window: 0x7fb0c8, windowEmissive: 0x17313f, fireEscape: false, waterTower: false },
  // Dark glass tower
  { width: 13, depth: 15, floors: 9, facade: 0x26343f, base: 0x1d2429, trim: 0x101417, window: 0x2d7db0, windowEmissive: 0x062c48, fireEscape: false, waterTower: false, glassRatio: 0.75 },
  // Red warehouse loft conversion
  { width: 18, depth: 18, floors: 4, facade: 0x8c4a35, base: 0x4a4038, trim: 0x211b18, window: 0xb8d8e0, windowEmissive: 0x1e3b42, fireEscape: true, waterTower: true },
  // Narrow midtown office slab
  { width: 12, depth: 17, floors: 8, facade: 0x6e7371, base: 0x343838, trim: 0x202323, window: 0x86b7d1, windowEmissive: 0x153447, fireEscape: false, waterTower: false, glassRatio: 0.45 },
];

export class BuildingFactory {
  private buildings: THREE.Group[] = [];
  private vehicleObstacles: BuildingBounds[] = [];
  private materialCache = new Map<number, BuildingMaterialSet>();
  private lightStripMat = new THREE.MeshBasicMaterial({ color: 0xffdca0 });
  private hvacMat = new THREE.MeshStandardMaterial({ color: 0x575b58, roughness: 0.75, metalness: 0.35 });
  private waterTowerWoodMat = new THREE.MeshStandardMaterial({ color: 0x5c4633, roughness: 0.8 });
  private waterTowerMetalMat = new THREE.MeshStandardMaterial({ color: 0x252525, roughness: 0.55, metalness: 0.6 });

  createBuilding(
    type: number,
    x: number, z: number,
    parent: THREE.Object3D,
    physics: PhysicsWorld
  ): THREE.Group {
    const config = NYC_BUILDING_TYPES[type % NYC_BUILDING_TYPES.length];
    const group = new THREE.Group();

    const W = config.width;
    const D = config.depth;
    const H = config.floors * FLOOR_HEIGHT;

    const materials = this.getMaterials(type, config);

    this.addInteriorFloors(group, x, z, W, D, config.floors, materials.floor, physics);
    this.addOuterShell(group, x, z, W, D, H, materials.facade, materials.base, materials.trim, physics);
    this.addInteriorRamps(group, x, z, W, D, config.floors, materials.ramp, materials.trim, physics);
    this.addWindows(group, W, D, config, materials.window);
    this.addFacadeDetails(group, W, D, H, config, materials.trim);
    this.addInteriorDetails(group, W, D, config.floors, materials.trim);
    this.addRooftop(group, W, D, H, config, materials.trim);

    const lobbyGlow = new THREE.Mesh(
      new THREE.PlaneGeometry(DOOR_WIDTH * 0.82, DOOR_HEIGHT * 0.72),
      new THREE.MeshBasicMaterial({ color: 0xffd8a2 })
    );
    lobbyGlow.position.set(0, DOOR_HEIGHT * 0.48, D / 2 - WALL_THICKNESS);
    group.add(lobbyGlow);

    group.position.set(x, 0, z);
    batchStaticMeshes(group);
    parent.add(group);

    this.buildings.push(group);
    this.vehicleObstacles.push({
      x,
      z,
      hx: W / 2 + 1.25,
      hz: D / 2 + 1.25,
    });
    return group;
  }

  private getMaterials(type: number, config: BuildingConfig): BuildingMaterialSet {
    const key = type % NYC_BUILDING_TYPES.length;
    const cached = this.materialCache.get(key);
    if (cached) return cached;

    const materials = {
      facade: new THREE.MeshStandardMaterial({ color: config.facade, emissive: 0x090807, emissiveIntensity: 0.08, roughness: 0.86 }),
      base: new THREE.MeshStandardMaterial({ color: config.base, emissive: 0x080807, emissiveIntensity: 0.08, roughness: 0.75 }),
      trim: new THREE.MeshStandardMaterial({ color: config.trim, roughness: 0.7, metalness: 0.15 }),
      floor: new THREE.MeshStandardMaterial({ color: 0x4a4741, emissive: 0x151411, emissiveIntensity: 0.45, roughness: 0.92 }),
      ramp: new THREE.MeshStandardMaterial({ color: 0x5b5a54, emissive: 0x171714, emissiveIntensity: 0.35, roughness: 0.9 }),
      window: new THREE.MeshStandardMaterial({
        color: config.window,
        emissive: config.windowEmissive ?? config.window,
        emissiveIntensity: 0.55,
        roughness: 0.25,
        metalness: 0.15,
      }),
    };
    this.materialCache.set(key, materials);
    return materials;
  }

  getVehicleObstacles(): BuildingBounds[] {
    return this.vehicleObstacles.map((b) => ({ ...b }));
  }

  private addInteriorFloors(
    group: THREE.Group,
    worldX: number,
    worldZ: number,
    W: number,
    D: number,
    floors: number,
    floorMat: THREE.Material,
    physics: PhysicsWorld
  ) {
    const shaft = this.getRampShaft(W, D);

    // Ground floor visual: the global ground collider handles walking at y=0.
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(W - WALL_THICKNESS * 2, D - WALL_THICKNESS * 2), floorMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.015;
    ground.receiveShadow = true;
    group.add(ground);

    for (let floor = 1; floor < floors; floor++) {
      const y = floor * FLOOR_HEIGHT;
      this.addSplitFloorSlab(group, worldX, worldZ, W, D, y, shaft, floorMat, physics);
    }

    // Flat roof slab. It is solid because the ramps stop at the top floor.
    this.addSolidSlab(group, worldX, worldZ, W, D, floors * FLOOR_HEIGHT, floorMat, physics);
  }

  private addOuterShell(
    group: THREE.Group,
    worldX: number,
    worldZ: number,
    W: number,
    D: number,
    H: number,
    facadeMat: THREE.Material,
    baseMat: THREE.Material,
    trimMat: THREE.Material,
    physics: PhysicsWorld
  ) {
    // Back wall.
    this.addWall(group, worldX, worldZ - D / 2, 0, H / 2, -D / 2, W, H, WALL_THICKNESS, facadeMat, physics);

    // Side walls.
    this.addWall(group, worldX - W / 2, worldZ, -W / 2, H / 2, 0, WALL_THICKNESS, H, D, facadeMat, physics);
    this.addWall(group, worldX + W / 2, worldZ, W / 2, H / 2, 0, WALL_THICKNESS, H, D, facadeMat, physics);

    // Front wall: street-level lobby opening plus continuous facade above.
    const sideW = (W - DOOR_WIDTH) / 2;
    const groundWallH = FLOOR_HEIGHT;
    for (const side of [-1, 1]) {
      const localX = side * (DOOR_WIDTH / 2 + sideW / 2);
      this.addWall(
        group,
        worldX + localX,
        worldZ + D / 2,
        localX,
        groundWallH / 2,
        D / 2,
        sideW,
        groundWallH,
        WALL_THICKNESS,
        baseMat,
        physics
      );
    }

    const lintelH = groundWallH - DOOR_HEIGHT;
    this.addWall(
      group,
      worldX,
      worldZ + D / 2,
      0,
      DOOR_HEIGHT + lintelH / 2,
      D / 2,
      DOOR_WIDTH,
      lintelH,
      WALL_THICKNESS,
      baseMat,
      physics
    );

    const upperH = H - groundWallH;
    if (upperH > 0) {
      this.addWall(
        group,
        worldX,
        worldZ + D / 2,
        0,
        groundWallH + upperH / 2,
        D / 2,
        W,
        upperH,
        WALL_THICKNESS,
        facadeMat,
        physics
      );
    }

    // Lobby frame and roll-up metal trim.
    const frameDepth = WALL_THICKNESS + 0.04;
    const frameTop = new THREE.Mesh(
      new THREE.BoxGeometry(DOOR_WIDTH + 0.22, 0.12, frameDepth),
      trimMat
    );
    frameTop.position.set(0, DOOR_HEIGHT + 0.06, D / 2 + EXTERIOR_OFFSET);
    group.add(frameTop);

    for (const side of [-1, 1]) {
      const frameSide = new THREE.Mesh(new THREE.BoxGeometry(0.12, DOOR_HEIGHT, frameDepth), trimMat);
      frameSide.position.set(side * (DOOR_WIDTH / 2 + 0.06), DOOR_HEIGHT / 2, D / 2 + EXTERIOR_OFFSET);
      group.add(frameSide);
    }
  }

  private addInteriorRamps(
    group: THREE.Group,
    worldX: number,
    worldZ: number,
    W: number,
    D: number,
    floors: number,
    rampMat: THREE.Material,
    railMat: THREE.Material,
    physics: PhysicsWorld
  ) {
    const shaft = this.getRampShaft(W, D);
    const run = shaft.zMax - shaft.zMin;
    const rise = FLOOR_HEIGHT;
    const angle = -Math.atan2(rise, run);
    const rampLength = Math.sqrt(run * run + rise * rise);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0));

    for (let floor = 0; floor < floors - 1; floor++) {
      const y0 = floor * FLOOR_HEIGHT + 0.06;
      const y1 = (floor + 1) * FLOOR_HEIGHT + 0.04;
      const centerY = (y0 + y1) / 2;
      const centerZ = (shaft.zMin + shaft.zMax) / 2;

      const ramp = new THREE.Mesh(new THREE.BoxGeometry(RAMP_WIDTH, 0.16, rampLength), rampMat);
      ramp.position.set(shaft.xCenter, centerY, centerZ);
      ramp.rotation.x = angle;
      ramp.castShadow = true;
      ramp.receiveShadow = true;
      group.add(ramp);

      physics.createFixedCuboidRotated(
        worldX + shaft.xCenter,
        centerY,
        worldZ + centerZ,
        RAMP_WIDTH / 2,
        0.08,
        rampLength / 2,
        quat
      );

      // Simple railings mark the stairwell without blocking traversal.
      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.72, rampLength), railMat);
        rail.position.set(shaft.xCenter + side * (RAMP_WIDTH / 2 + 0.18), centerY + 0.38, centerZ);
        rail.rotation.x = angle;
        group.add(rail);
      }
    }
  }

  private addWindows(
    group: THREE.Group,
    W: number,
    D: number,
    config: BuildingConfig,
    windowMat: THREE.Material
  ) {
    const glassRatio = config.glassRatio ?? 0.35;
    const colsFront = Math.max(3, Math.floor(W / 2.2));
    const colsSide = Math.max(3, Math.floor(D / 2.4));
    const winWidth = glassRatio > 0.6 ? 1.15 : 0.82;
    const winHeight = glassRatio > 0.6 ? 1.75 : 1.2;
    const windows: InstanceTransform[] = [];

    for (let floor = 0; floor < config.floors; floor++) {
      const y = floor * FLOOR_HEIGHT + 1.85;

      for (const side of [1, -1]) {
        for (let col = 0; col < colsFront; col++) {
          const x = (col - (colsFront - 1) / 2) * (W / (colsFront + 0.8));
          if (side > 0 && floor === 0 && Math.abs(x) < DOOR_WIDTH / 2 + winWidth / 2) continue;
          windows.push({
            position: [x, y, side * (D / 2 + EXTERIOR_OFFSET)],
            rotation: [0, side < 0 ? Math.PI : 0, 0],
            scale: [winWidth, winHeight, 1],
          });
        }
      }

      for (const side of [1, -1]) {
        for (let col = 0; col < colsSide; col++) {
          const z = (col - (colsSide - 1) / 2) * (D / (colsSide + 0.8));
          windows.push({
            position: [side * (W / 2 + EXTERIOR_OFFSET), y, z],
            rotation: [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
            scale: [winWidth * 0.95, winHeight, 1],
          });
        }
      }
    }

    group.add(createInstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      windowMat,
      windows,
      { name: 'Building Windows' }
    ));
  }

  private addFacadeDetails(
    group: THREE.Group,
    W: number,
    D: number,
    H: number,
    config: BuildingConfig,
    trimMat: THREE.Material
  ) {
    // Horizontal cornices at each floor read as New York masonry bands.
    const trimInstances: InstanceTransform[] = [];
    for (let floor = 1; floor <= config.floors; floor++) {
      const y = floor * FLOOR_HEIGHT;
      for (const side of [1, -1]) {
        trimInstances.push({
          position: [0, y, side * (D / 2 + WALL_THICKNESS / 2 + 0.06)],
          scale: [W + 0.12, 0.08, 0.12],
        });
      }
      for (const side of [1, -1]) {
        trimInstances.push({
          position: [side * (W / 2 + WALL_THICKNESS / 2 + 0.06), y, 0],
          scale: [0.12, 0.08, D + 0.12],
        });
      }
    }

    // Slim vertical pilasters break up the long block faces.
    const pilasterCount = Math.max(2, Math.floor(W / 4));
    for (let i = 0; i < pilasterCount; i++) {
      const x = (i - (pilasterCount - 1) / 2) * (W / pilasterCount);
      for (const side of [1, -1]) {
        trimInstances.push({
          position: [x, H / 2, side * (D / 2 + WALL_THICKNESS / 2 + 0.06)],
          scale: [0.12, H, 0.08],
        });
      }
    }

    group.add(createInstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      trimMat,
      trimInstances,
      { name: 'Building Facade Trim' }
    ));

    if (config.fireEscape) {
      this.addFireEscape(group, W, D, H, trimMat);
    }
  }

  private addInteriorDetails(
    group: THREE.Group,
    W: number,
    D: number,
    floors: number,
    trimMat: THREE.Material
  ) {
    const columnPositions = [
      [-W * 0.24, -D * 0.18],
      [W * 0.24, -D * 0.18],
      [-W * 0.24, D * 0.18],
      [W * 0.24, D * 0.18],
    ];
    const columnInstances: InstanceTransform[] = columnPositions.map(([cx, cz]) => ({
      position: [cx, floors * FLOOR_HEIGHT / 2, cz],
      scale: [0.28, floors * FLOOR_HEIGHT, 0.28],
    }));
    group.add(createInstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      trimMat,
      columnInstances,
      { name: 'Building Interior Columns', castShadow: true }
    ));

    const lightStripInstances: InstanceTransform[] = [];
    for (let floor = 0; floor < floors; floor++) {
      const y = floor * FLOOR_HEIGHT + 2.75;
      for (const z of [-D * 0.18, D * 0.18]) {
        lightStripInstances.push({
          position: [W * 0.12, y, z],
          scale: [W * 0.34, 0.035, 0.08],
        });
      }
    }
    group.add(createInstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      this.lightStripMat,
      lightStripInstances,
      { name: 'Building Interior Light Strips' }
    ));
  }

  private addRooftop(
    group: THREE.Group,
    W: number,
    D: number,
    H: number,
    config: BuildingConfig,
    trimMat: THREE.Material
  ) {
    const parapetH = 0.65;
    const parapets = [
      { x: 0, z: D / 2, sx: W, sz: WALL_THICKNESS },
      { x: 0, z: -D / 2, sx: W, sz: WALL_THICKNESS },
      { x: W / 2, z: 0, sx: WALL_THICKNESS, sz: D },
      { x: -W / 2, z: 0, sx: WALL_THICKNESS, sz: D },
    ];
    group.add(createInstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      trimMat,
      parapets.map((p) => ({
        position: [p.x, H + parapetH / 2, p.z],
        scale: [p.sx, parapetH, p.sz],
      })),
      { name: 'Building Rooftop Parapets' }
    ));

    for (const [x, z, sx, sz] of [
      [-W * 0.2, -D * 0.2, 1.5, 1.0],
      [W * 0.22, D * 0.16, 1.0, 1.4],
    ]) {
      const hvac = new THREE.Mesh(new THREE.BoxGeometry(sx, 0.55, sz), this.hvacMat);
      hvac.position.set(x, H + 0.28, z);
      hvac.castShadow = true;
      group.add(hvac);
    }

    if (config.waterTower) {
      this.addWaterTower(group, W, D, H);
    }
  }

  private addFireEscape(group: THREE.Group, W: number, D: number, H: number, mat: THREE.Material) {
    const platformW = Math.min(4, W * 0.42);
    const platformD = 0.55;
    const x = W * 0.18;
    const z = D / 2 + WALL_THICKNESS / 2 + 0.36;

    for (let floor = 1; floor < Math.floor(H / FLOOR_HEIGHT); floor++) {
      const y = floor * FLOOR_HEIGHT + 0.65;
      const platform = new THREE.Mesh(new THREE.BoxGeometry(platformW, 0.08, platformD), mat);
      platform.position.set(x, y, z);
      group.add(platform);

      const rail = new THREE.Mesh(new THREE.BoxGeometry(platformW, 0.38, 0.04), mat);
      rail.position.set(x, y + 0.23, z + platformD / 2);
      group.add(rail);

      if (floor > 1) {
        const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.08, FLOOR_HEIGHT - 0.35, 0.05), mat);
        ladder.position.set(x - platformW / 2 + 0.22, y - FLOOR_HEIGHT / 2, z + platformD / 2);
        ladder.rotation.z = 0.16;
        group.add(ladder);
      }
    }
  }

  private addWaterTower(group: THREE.Group, W: number, D: number, H: number) {
    const tower = new THREE.Group();
    tower.position.set(-W * 0.25, H + 1.25, -D * 0.25);

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.15, 16), this.waterTowerWoodMat);
    tank.castShadow = true;
    tower.add(tank);

    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.36, 16), this.waterTowerMetalMat);
    cap.position.y = 0.74;
    tower.add(cap);

    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1.4, 6), this.waterTowerMetalMat);
        leg.position.set(sx * 0.55, -0.92, sz * 0.55);
        tower.add(leg);
      }
    }

    group.add(tower);
  }

  private addWall(
    group: THREE.Group,
    worldX: number,
    worldZ: number,
    localX: number,
    localY: number,
    localZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number,
    mat: THREE.Material,
    physics: PhysicsWorld
  ) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(sizeX, sizeY, sizeZ), mat);
    wall.position.set(localX, localY, localZ);
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);
    physics.createFixedCuboid(worldX, localY, worldZ, sizeX / 2, sizeY / 2, sizeZ / 2);
  }

  private addSolidSlab(
    group: THREE.Group,
    worldX: number,
    worldZ: number,
    W: number,
    D: number,
    y: number,
    mat: THREE.Material,
    physics: PhysicsWorld
  ) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W, SLAB_THICKNESS, D), mat);
    slab.position.set(0, y - SLAB_THICKNESS / 2, 0);
    slab.receiveShadow = true;
    group.add(slab);
    physics.createFixedCuboid(worldX, y - SLAB_THICKNESS / 2, worldZ, W / 2, SLAB_THICKNESS / 2, D / 2);
  }

  private addSplitFloorSlab(
    group: THREE.Group,
    worldX: number,
    worldZ: number,
    W: number,
    D: number,
    y: number,
    shaft: ReturnType<BuildingFactory['getRampShaft']>,
    mat: THREE.Material,
    physics: PhysicsWorld
  ) {
    const pieces = [
      {
        cx: (-W / 2 + shaft.xMin) / 2,
        cz: 0,
        sx: shaft.xMin + W / 2,
        sz: D,
      },
      {
        cx: (shaft.xMax + W / 2) / 2,
        cz: 0,
        sx: W / 2 - shaft.xMax,
        sz: D,
      },
      {
        cx: shaft.xCenter,
        cz: (-D / 2 + shaft.zMin) / 2,
        sx: shaft.xMax - shaft.xMin,
        sz: shaft.zMin + D / 2,
      },
      {
        cx: shaft.xCenter,
        cz: (shaft.zMax + D / 2) / 2,
        sx: shaft.xMax - shaft.xMin,
        sz: D / 2 - shaft.zMax,
      },
    ];

    for (const piece of pieces) {
      if (piece.sx <= 0.05 || piece.sz <= 0.05) continue;
      const slab = new THREE.Mesh(new THREE.BoxGeometry(piece.sx, SLAB_THICKNESS, piece.sz), mat);
      slab.position.set(piece.cx, y - SLAB_THICKNESS / 2, piece.cz);
      slab.receiveShadow = true;
      group.add(slab);
      physics.createFixedCuboid(
        worldX + piece.cx,
        y - SLAB_THICKNESS / 2,
        worldZ + piece.cz,
        piece.sx / 2,
        SLAB_THICKNESS / 2,
        piece.sz / 2
      );
    }
  }

  private getRampShaft(W: number, D: number) {
    const xCenter = -W / 2 + 2.35;
    const halfW = RAMP_WIDTH / 2 + 0.35;
    return {
      xCenter,
      xMin: xCenter - halfW,
      xMax: xCenter + halfW,
      zMin: -D / 2 + 1.35,
      zMax: D / 2 - 1.35,
    };
  }

  placeCity(scene: THREE.Scene, physics: PhysicsWorld) {
    // Dense Manhattan-like blocks: all footprints are multi-floor buildings.
    // Doors face +Z and open toward streets, shared courtyards, or narrow alleys.
    const cityGroup = new THREE.Group();
    cityGroup.name = 'City Building Batch Root';
    scene.add(cityGroup);

    for (const p of CITY_BUILDING_PLACEMENTS) {
      this.createBuilding(p.type, p.x, p.z, cityGroup, physics);
    }
    batchStaticMeshes(cityGroup);
    batchInstancedMeshes(cityGroup);
  }
}
