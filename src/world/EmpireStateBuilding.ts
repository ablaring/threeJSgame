import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InstanceTransform, createInstancedMesh } from './InstancedMeshBuilder';
import { batchInstancedMeshes, batchStaticMeshes } from './StaticGeometryBatcher';

const FLOOR_HEIGHT = 3.4;          // 3.4m per accessible interior floor
const ACCESSIBLE_FLOORS = 6;       // lobby + 5 upper walkable floors
const WALL_THICKNESS = 0.28;       // 28cm exterior shell
const SLAB_THICKNESS = 0.16;       // 16cm concrete slab
const DOOR_WIDTH = 3.2;            // 3.2m main Art Deco entrance
const DOOR_HEIGHT = 3.0;           // 3.0m entrance clearance
const RAMP_WIDTH = 1.65;           // 1.65m interior ramp width
const EXTERIOR_OFFSET = WALL_THICKNESS / 2 + 0.04;

const BASE_WIDTH = 24;             // 24m lower footprint
const BASE_DEPTH = 30;             // 30m lower footprint
const ACCESSIBLE_HEIGHT = ACCESSIBLE_FLOORS * FLOOR_HEIGHT; // 20.4m playable base
const SHAFT_HEIGHT = 38;           // stylized tower shaft height
const CROWN_HEIGHT = 18;           // upper setback crown height
const SPIRE_HEIGHT = 16;           // antenna mast height

export class EmpireStateBuilding {
  mesh: THREE.Group;

  constructor(
    private x: number,
    private z: number,
    scene: THREE.Scene,
    physics: PhysicsWorld
  ) {
    this.mesh = this.createMesh();
    this.createColliders(physics);
    scene.add(this.mesh);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Empire State Building';
    group.position.set(this.x, 0, this.z);

    const limestoneMat = new THREE.MeshStandardMaterial({
      color: 0xb8b09b,
      roughness: 0.82,
      metalness: 0.04,
    });
    const shadowStoneMat = new THREE.MeshStandardMaterial({
      color: 0x7d7768,
      roughness: 0.88,
      metalness: 0.02,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x514d43,
      roughness: 0.64,
      metalness: 0.18,
    });
    const lobbyMat = new THREE.MeshStandardMaterial({
      color: 0xc79749,
      roughness: 0.42,
      metalness: 0.36,
      emissive: 0x2d1804,
      emissiveIntensity: 0.28,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x7a7368,
      roughness: 0.92,
      emissive: 0x574531,
      emissiveIntensity: 0.7,
    });
    const rampMat = new THREE.MeshStandardMaterial({
      color: 0x8a8275,
      roughness: 0.88,
      emissive: 0x5b4934,
      emissiveIntensity: 0.65,
    });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x9fc3cf,
      roughness: 0.22,
      metalness: 0.22,
      emissive: 0x163847,
      emissiveIntensity: 0.42,
    });

    this.addPlayableInterior(group, floorMat, rampMat, trimMat);
    this.addBaseShell(group, limestoneMat, shadowStoneMat, trimMat, lobbyMat);
    this.addInteriorDetails(group, lobbyMat, trimMat);
    this.addSteppedTower(group, limestoneMat, shadowStoneMat, trimMat, glassMat);
    this.addFacadeTexture(group, glassMat, trimMat);
    this.addEntranceDetails(group, lobbyMat, trimMat);

    const lobbyLight = new THREE.PointLight(0xffd6a0, 1.2, 23, 2);
    lobbyLight.position.set(0, 2.5, BASE_DEPTH * 0.18);
    group.add(lobbyLight);

    const interiorLight = new THREE.PointLight(0xffd9a6, 1.2, 32, 2);
    interiorLight.position.set(-BASE_WIDTH * 0.16, ACCESSIBLE_HEIGHT * 0.46, BASE_DEPTH * 0.06);
    group.add(interiorLight);

    const crownLight = new THREE.PointLight(0xf2d18c, 0.7, 34, 2);
    crownLight.position.set(0, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT + CROWN_HEIGHT * 0.65, 0);
    group.add(crownLight);

    batchStaticMeshes(group);
    batchInstancedMeshes(group);
    return group;
  }

  private createColliders(physics: PhysicsWorld) {
    this.addBaseShellColliders(physics);
    this.addPlayableFloorColliders(physics);
    this.addRampColliders(physics);

    // Solid upper mass starts at the playable roofline, so players can enter the
    // lobby and floors below while the skyline silhouette still blocks movement.
    this.addSolidBlockCollider(physics, 0, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT / 2, 0, 15.8, SHAFT_HEIGHT, 19.8);
    this.addSolidBlockCollider(physics, 0, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT + 6, 0, 11.5, 12, 14.2);
    this.addSolidBlockCollider(physics, 0, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT + 15, 0, 7.5, 6, 9.2);
  }

  private addPlayableInterior(
    group: THREE.Group,
    floorMat: THREE.Material,
    rampMat: THREE.Material,
    railMat: THREE.Material
  ) {
    const shaft = this.getRampShaft();

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(BASE_WIDTH - WALL_THICKNESS * 2, BASE_DEPTH - WALL_THICKNESS * 2),
      floorMat
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = 0.018;
    ground.receiveShadow = true;
    group.add(ground);

    for (let floor = 1; floor < ACCESSIBLE_FLOORS; floor++) {
      this.addSplitSlabMesh(group, floor * FLOOR_HEIGHT, shaft, floorMat);
    }

    this.addSolidSlabMesh(group, ACCESSIBLE_HEIGHT, floorMat);
    this.addRampMeshes(group, shaft, rampMat, railMat);
  }

  private addBaseShell(
    group: THREE.Group,
    facadeMat: THREE.Material,
    baseMat: THREE.Material,
    trimMat: THREE.Material,
    lobbyMat: THREE.Material
  ) {
    const W = BASE_WIDTH;
    const D = BASE_DEPTH;
    const H = ACCESSIBLE_HEIGHT;

    this.addBox(group, 0, H / 2, -D / 2, W, H, WALL_THICKNESS, facadeMat);
    this.addBox(group, -W / 2, H / 2, 0, WALL_THICKNESS, H, D, facadeMat);
    this.addBox(group, W / 2, H / 2, 0, WALL_THICKNESS, H, D, facadeMat);

    const sideW = (W - DOOR_WIDTH) / 2;
    const groundWallH = FLOOR_HEIGHT;
    for (const side of [-1, 1]) {
      const localX = side * (DOOR_WIDTH / 2 + sideW / 2);
      this.addBox(group, localX, groundWallH / 2, D / 2, sideW, groundWallH, WALL_THICKNESS, baseMat);
    }

    const lintelH = groundWallH - DOOR_HEIGHT;
    this.addBox(group, 0, DOOR_HEIGHT + lintelH / 2, D / 2, DOOR_WIDTH, lintelH, WALL_THICKNESS, lobbyMat);

    const upperH = H - groundWallH;
    this.addBox(group, 0, groundWallH + upperH / 2, D / 2, W, upperH, WALL_THICKNESS, facadeMat);

    for (let floor = 1; floor <= ACCESSIBLE_FLOORS; floor++) {
      const y = floor * FLOOR_HEIGHT;
      this.addBox(group, 0, y, D / 2 + WALL_THICKNESS / 2 + 0.06, W + 0.2, 0.09, 0.12, trimMat);
      this.addBox(group, 0, y, -D / 2 - WALL_THICKNESS / 2 - 0.06, W + 0.2, 0.09, 0.12, trimMat);
      this.addBox(group, W / 2 + WALL_THICKNESS / 2 + 0.06, y, 0, 0.12, 0.09, D + 0.2, trimMat);
      this.addBox(group, -W / 2 - WALL_THICKNESS / 2 - 0.06, y, 0, 0.12, 0.09, D + 0.2, trimMat);
    }

    const parapetH = 0.72;
    this.addBox(group, 0, H + parapetH / 2, D / 2, W, parapetH, WALL_THICKNESS, trimMat);
    this.addBox(group, 0, H + parapetH / 2, -D / 2, W, parapetH, WALL_THICKNESS, trimMat);
    this.addBox(group, W / 2, H + parapetH / 2, 0, WALL_THICKNESS, parapetH, D, trimMat);
    this.addBox(group, -W / 2, H + parapetH / 2, 0, WALL_THICKNESS, parapetH, D, trimMat);
  }

  private addInteriorDetails(group: THREE.Group, lobbyMat: THREE.Material, trimMat: THREE.Material) {
    const columnPositions = [
      [-BASE_WIDTH * 0.32, BASE_DEPTH * 0.24],
      [BASE_WIDTH * 0.32, BASE_DEPTH * 0.24],
      [-BASE_WIDTH * 0.22, -BASE_DEPTH * 0.18],
      [BASE_WIDTH * 0.22, -BASE_DEPTH * 0.18],
    ];

    for (const [cx, cz] of columnPositions) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, ACCESSIBLE_HEIGHT, 10), trimMat);
      column.position.set(cx, ACCESSIBLE_HEIGHT / 2, cz);
      column.castShadow = true;
      column.receiveShadow = true;
      group.add(column);
    }

    const elevatorCore = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, ACCESSIBLE_HEIGHT - 0.4, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x36342e, roughness: 0.7, metalness: 0.25 })
    );
    elevatorCore.position.set(BASE_WIDTH * 0.18, (ACCESSIBLE_HEIGHT - 0.4) / 2, -BASE_DEPTH * 0.31);
    elevatorCore.castShadow = true;
    group.add(elevatorCore);

    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffd38c });
    for (let floor = 0; floor < ACCESSIBLE_FLOORS; floor++) {
      const y = floor * FLOOR_HEIGHT + 2.92;
      for (const x of [-BASE_WIDTH * 0.2, BASE_WIDTH * 0.2]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.035, 0.08), lightMat);
        strip.position.set(x, y, BASE_DEPTH * 0.12);
        group.add(strip);
      }
    }

    const lobbyGlow = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH * 0.85, 2.35, 0.04), lobbyMat);
    lobbyGlow.position.set(0, 1.45, BASE_DEPTH / 2 - 0.18);
    group.add(lobbyGlow);
  }

  private addSteppedTower(
    group: THREE.Group,
    limestoneMat: THREE.Material,
    shadowStoneMat: THREE.Material,
    trimMat: THREE.Material,
    glassMat: THREE.Material
  ) {
    this.addBox(group, 0, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT / 2, 0, 15.8, SHAFT_HEIGHT, 19.8, limestoneMat);
    this.addBox(group, 0, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT + 6, 0, 11.5, 12, 14.2, limestoneMat);
    this.addBox(group, 0, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT + 15, 0, 7.5, 6, 9.2, shadowStoneMat);

    const capY = ACCESSIBLE_HEIGHT + SHAFT_HEIGHT + CROWN_HEIGHT + 0.55;
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.0, 5.0, 1.1, 8), trimMat);
    cap.position.y = capY;
    cap.rotation.y = Math.PI / 8;
    cap.castShadow = true;
    group.add(cap);

    const mastBase = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.6, 4.5, 12), shadowStoneMat);
    mastBase.position.y = capY + 2.75;
    mastBase.castShadow = true;
    group.add(mastBase);

    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, SPIRE_HEIGHT, 12), trimMat);
    mast.position.y = capY + 5.0 + SPIRE_HEIGHT / 2;
    mast.castShadow = true;
    group.add(mast);

    const beacon = new THREE.Mesh(
      new THREE.SphereGeometry(0.45, 12, 8),
      new THREE.MeshStandardMaterial({
        color: 0xffe2a3,
        emissive: 0xffc65a,
        emissiveIntensity: 1.2,
        roughness: 0.35,
      })
    );
    beacon.position.y = capY + 5.0 + SPIRE_HEIGHT;
    group.add(beacon);

    this.addTierWindows(group, 15.8, 19.8, ACCESSIBLE_HEIGHT, SHAFT_HEIGHT, glassMat);
    this.addTierWindows(group, 11.5, 14.2, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT, 12, glassMat);
    this.addTierWindows(group, 7.5, 9.2, ACCESSIBLE_HEIGHT + SHAFT_HEIGHT + 12, 6, glassMat);
  }

  private addFacadeTexture(group: THREE.Group, glassMat: THREE.Material, trimMat: THREE.Material) {
    const W = BASE_WIDTH;
    const D = BASE_DEPTH;
    const colsFront = 8;
    const colsSide = 10;
    const windows: InstanceTransform[] = [];

    for (let floor = 0; floor < ACCESSIBLE_FLOORS; floor++) {
      const y = floor * FLOOR_HEIGHT + 1.92;
      for (const side of [1, -1]) {
        for (let col = 0; col < colsFront; col++) {
          const x = (col - (colsFront - 1) / 2) * (W / (colsFront + 1.0));
          if (side > 0 && floor === 0 && Math.abs(x) < DOOR_WIDTH / 2 + 0.6) continue;
          windows.push({
            position: [x, y, side * (D / 2 + EXTERIOR_OFFSET)],
            rotation: [0, side < 0 ? Math.PI : 0, 0],
            scale: [0.78, 1.34, 1],
          });
        }
      }

      for (const side of [1, -1]) {
        for (let col = 0; col < colsSide; col++) {
          const z = (col - (colsSide - 1) / 2) * (D / (colsSide + 0.9));
          windows.push({
            position: [side * (W / 2 + EXTERIOR_OFFSET), y, z],
            rotation: [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
            scale: [0.7, 1.24, 1],
          });
        }
      }
    }

    group.add(createInstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      glassMat,
      windows,
      { name: 'Empire State Base Windows' }
    ));

    const trimInstances: InstanceTransform[] = [];
    for (const x of [-W * 0.34, -W * 0.17, 0, W * 0.17, W * 0.34]) {
      trimInstances.push(
        {
          position: [x, ACCESSIBLE_HEIGHT / 2, D / 2 + WALL_THICKNESS / 2 + 0.065],
          scale: [0.12, ACCESSIBLE_HEIGHT, 0.08],
        },
        {
          position: [x, ACCESSIBLE_HEIGHT / 2, -D / 2 - WALL_THICKNESS / 2 - 0.065],
          scale: [0.12, ACCESSIBLE_HEIGHT, 0.08],
        }
      );
    }
    group.add(createInstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      trimMat,
      trimInstances,
      { name: 'Empire State Base Vertical Trim' }
    ));
  }

  private addEntranceDetails(group: THREE.Group, lobbyMat: THREE.Material, trimMat: THREE.Material) {
    const D = BASE_DEPTH;
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH + 1.4, 0.18, 1.25), lobbyMat);
    canopy.position.set(0, 2.85, D / 2 + 0.72);
    canopy.castShadow = true;
    group.add(canopy);

    for (const side of [-1, 1]) {
      const column = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.7, 10), trimMat);
      column.position.set(side * (DOOR_WIDTH / 2 + 0.42), 1.35, D / 2 + 0.16);
      column.castShadow = true;
      group.add(column);
    }

    const stepsMat = new THREE.MeshStandardMaterial({ color: 0x6c6558, roughness: 0.86 });
    for (let i = 0; i < 3; i++) {
      const step = new THREE.Mesh(new THREE.BoxGeometry(DOOR_WIDTH + 1.0 + i * 0.35, 0.08, 0.38), stepsMat);
      step.position.set(0, 0.04 + i * 0.08, D / 2 + 0.28 + i * 0.38);
      step.castShadow = true;
      step.receiveShadow = true;
      group.add(step);
    }
  }

  private addTierWindows(
    group: THREE.Group,
    W: number,
    D: number,
    yBase: number,
    H: number,
    glassMat: THREE.Material
  ) {
    const frontCols = Math.max(4, Math.floor(W / 1.35));
    const sideCols = Math.max(4, Math.floor(D / 1.55));
    const rows = Math.max(3, Math.floor(H / 2.6));
    const windows: InstanceTransform[] = [];

    for (let row = 0; row < rows; row++) {
      const y = yBase + 1.45 + row * (H - 2.4) / Math.max(1, rows - 1);

      for (const side of [1, -1]) {
        for (let col = 0; col < frontCols; col++) {
          const x = (col - (frontCols - 1) / 2) * (W / (frontCols + 0.8));
          windows.push({
            position: [x, y, side * (D / 2 + EXTERIOR_OFFSET)],
            rotation: [0, side < 0 ? Math.PI : 0, 0],
            scale: [0.5, 1.0, 1],
          });
        }
      }

      for (const side of [1, -1]) {
        for (let col = 0; col < sideCols; col++) {
          const z = (col - (sideCols - 1) / 2) * (D / (sideCols + 0.8));
          windows.push({
            position: [side * (W / 2 + EXTERIOR_OFFSET), y, z],
            rotation: [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
            scale: [0.48, 1.0, 1],
          });
        }
      }
    }

    group.add(createInstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      glassMat,
      windows,
      { name: 'Empire State Tower Windows' }
    ));
  }

  private addRampMeshes(
    group: THREE.Group,
    shaft: ReturnType<EmpireStateBuilding['getRampShaft']>,
    rampMat: THREE.Material,
    railMat: THREE.Material
  ) {
    const run = shaft.zMax - shaft.zMin;
    const rise = FLOOR_HEIGHT;
    const angle = -Math.atan2(rise, run);
    const rampLength = Math.sqrt(run * run + rise * rise);

    for (let floor = 0; floor < ACCESSIBLE_FLOORS - 1; floor++) {
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

      for (const side of [-1, 1]) {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.75, rampLength), railMat);
        rail.position.set(shaft.xCenter + side * (RAMP_WIDTH / 2 + 0.2), centerY + 0.42, centerZ);
        rail.rotation.x = angle;
        group.add(rail);
      }
    }
  }

  private addPlayableFloorColliders(physics: PhysicsWorld) {
    const shaft = this.getRampShaft();
    for (let floor = 1; floor < ACCESSIBLE_FLOORS; floor++) {
      this.addSplitSlabColliders(physics, floor * FLOOR_HEIGHT, shaft);
    }
    this.addSolidSlabCollider(physics, ACCESSIBLE_HEIGHT);
  }

  private addRampColliders(physics: PhysicsWorld) {
    const shaft = this.getRampShaft();
    const run = shaft.zMax - shaft.zMin;
    const rise = FLOOR_HEIGHT;
    const angle = -Math.atan2(rise, run);
    const rampLength = Math.sqrt(run * run + rise * rise);
    const quat = new THREE.Quaternion().setFromEuler(new THREE.Euler(angle, 0, 0));

    for (let floor = 0; floor < ACCESSIBLE_FLOORS - 1; floor++) {
      const y0 = floor * FLOOR_HEIGHT + 0.06;
      const y1 = (floor + 1) * FLOOR_HEIGHT + 0.04;
      physics.createFixedCuboidRotated(
        this.x + shaft.xCenter,
        (y0 + y1) / 2,
        this.z + (shaft.zMin + shaft.zMax) / 2,
        RAMP_WIDTH / 2,
        0.08,
        rampLength / 2,
        quat
      );
    }
  }

  private addBaseShellColliders(physics: PhysicsWorld) {
    const W = BASE_WIDTH;
    const D = BASE_DEPTH;
    const H = ACCESSIBLE_HEIGHT;
    this.addCollider(physics, 0, H / 2, -D / 2, W, H, WALL_THICKNESS);
    this.addCollider(physics, -W / 2, H / 2, 0, WALL_THICKNESS, H, D);
    this.addCollider(physics, W / 2, H / 2, 0, WALL_THICKNESS, H, D);

    const sideW = (W - DOOR_WIDTH) / 2;
    const groundWallH = FLOOR_HEIGHT;
    for (const side of [-1, 1]) {
      const localX = side * (DOOR_WIDTH / 2 + sideW / 2);
      this.addCollider(physics, localX, groundWallH / 2, D / 2, sideW, groundWallH, WALL_THICKNESS);
    }

    const lintelH = groundWallH - DOOR_HEIGHT;
    this.addCollider(physics, 0, DOOR_HEIGHT + lintelH / 2, D / 2, DOOR_WIDTH, lintelH, WALL_THICKNESS);
    this.addCollider(physics, 0, groundWallH + (H - groundWallH) / 2, D / 2, W, H - groundWallH, WALL_THICKNESS);
  }

  private addSplitSlabMesh(
    group: THREE.Group,
    y: number,
    shaft: ReturnType<EmpireStateBuilding['getRampShaft']>,
    mat: THREE.Material
  ) {
    for (const piece of this.getSplitSlabPieces(shaft)) {
      const slab = new THREE.Mesh(new THREE.BoxGeometry(piece.sx, SLAB_THICKNESS, piece.sz), mat);
      slab.position.set(piece.cx, y - SLAB_THICKNESS / 2, piece.cz);
      slab.receiveShadow = true;
      group.add(slab);
    }
  }

  private addSplitSlabColliders(
    physics: PhysicsWorld,
    y: number,
    shaft: ReturnType<EmpireStateBuilding['getRampShaft']>
  ) {
    for (const piece of this.getSplitSlabPieces(shaft)) {
      this.addCollider(physics, piece.cx, y - SLAB_THICKNESS / 2, piece.cz, piece.sx, SLAB_THICKNESS, piece.sz);
    }
  }

  private addSolidSlabMesh(group: THREE.Group, y: number, mat: THREE.Material) {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(BASE_WIDTH, SLAB_THICKNESS, BASE_DEPTH), mat);
    slab.position.set(0, y - SLAB_THICKNESS / 2, 0);
    slab.receiveShadow = true;
    group.add(slab);
  }

  private addSolidSlabCollider(physics: PhysicsWorld, y: number) {
    this.addCollider(physics, 0, y - SLAB_THICKNESS / 2, 0, BASE_WIDTH, SLAB_THICKNESS, BASE_DEPTH);
  }

  private getSplitSlabPieces(shaft: ReturnType<EmpireStateBuilding['getRampShaft']>) {
    const W = BASE_WIDTH;
    const D = BASE_DEPTH;
    return [
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
    ].filter((piece) => piece.sx > 0.05 && piece.sz > 0.05);
  }

  private getRampShaft() {
    const xCenter = -BASE_WIDTH / 2 + 2.8;
    const halfW = RAMP_WIDTH / 2 + 0.42;
    return {
      xCenter,
      xMin: xCenter - halfW,
      xMax: xCenter + halfW,
      zMin: -BASE_DEPTH / 2 + 1.8,
      zMax: BASE_DEPTH / 2 - 1.8,
    };
  }

  private addSolidBlockCollider(
    physics: PhysicsWorld,
    localX: number,
    localY: number,
    localZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number
  ) {
    this.addCollider(physics, localX, localY, localZ, sizeX, sizeY, sizeZ);
  }

  private addCollider(
    physics: PhysicsWorld,
    localX: number,
    localY: number,
    localZ: number,
    sizeX: number,
    sizeY: number,
    sizeZ: number
  ) {
    physics.createFixedCuboid(
      this.x + localX,
      localY,
      this.z + localZ,
      sizeX / 2,
      sizeY / 2,
      sizeZ / 2
    );
  }

  private addBox(
    group: THREE.Group,
    x: number,
    y: number,
    z: number,
    sx: number,
    sy: number,
    sz: number,
    mat: THREE.Material
  ) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
}
