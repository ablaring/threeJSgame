import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { BuildingBounds } from './BuildingFactory';
import { InstanceTransform, createInstancedMesh } from './InstancedMeshBuilder';
import { batchInstancedMeshes, batchStaticMeshes } from './StaticGeometryBatcher';

const BASE_WIDTH = 20;          // 20m lower footprint
const BASE_DEPTH = 24;          // 24m lower footprint
const LOBBY_HEIGHT = 6.2;       // 6.2m public lobby
const TOWER_HEIGHT = 58;        // 58m stylized tower shaft
const WALL_THICKNESS = 0.28;    // 28cm facade shell
const DOOR_WIDTH = 4.4;         // 4.4m Fifth Avenue entrance
const DOOR_HEIGHT = 3.45;       // 3.45m entrance clearance
const EXTERIOR_OFFSET = WALL_THICKNESS / 2 + 0.045;

export class TrumpTower {
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

  getObstacle(): BuildingBounds {
    return {
      x: this.x,
      z: this.z,
      hx: BASE_WIDTH / 2 + 1.5,
      hz: BASE_DEPTH / 2 + 1.5,
    };
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Trump Tower';
    group.position.set(this.x, 0, this.z);

    const blackGlassMat = new THREE.MeshStandardMaterial({
      color: 0x101820,
      emissive: 0x02070a,
      emissiveIntensity: 0.16,
      roughness: 0.22,
      metalness: 0.48,
    });
    const blueGlassMat = new THREE.MeshStandardMaterial({
      color: 0x0d3a58,
      emissive: 0x05243c,
      emissiveIntensity: 0.72,
      roughness: 0.2,
      metalness: 0.36,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd2a64f,
      emissive: 0x6b3b08,
      emissiveIntensity: 0.34,
      roughness: 0.34,
      metalness: 0.62,
    });
    const lobbyMat = new THREE.MeshStandardMaterial({
      color: 0xf0c46a,
      emissive: 0x5c3108,
      emissiveIntensity: 0.48,
      roughness: 0.38,
      metalness: 0.42,
    });
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x3e3325,
      emissive: 0x241607,
      emissiveIntensity: 0.42,
      roughness: 0.78,
    });

    this.addLobby(group, blackGlassMat, lobbyMat, goldMat, floorMat);
    this.addTowerMass(group, blackGlassMat, goldMat);
    this.addWindows(group, blueGlassMat, goldMat);
    this.addGeometricSign(group, goldMat);

    batchStaticMeshes(group);
    batchInstancedMeshes(group);
    return group;
  }

  private createColliders(physics: PhysicsWorld) {
    const W = BASE_WIDTH;
    const D = BASE_DEPTH;
    const H = LOBBY_HEIGHT;

    this.addCollider(physics, 0, H / 2, -D / 2, W, H, WALL_THICKNESS);
    this.addCollider(physics, -W / 2, H / 2, 0, WALL_THICKNESS, H, D);
    this.addCollider(physics, W / 2, H / 2, 0, WALL_THICKNESS, H, D);

    const sideW = (W - DOOR_WIDTH) / 2;
    for (const side of [-1, 1]) {
      const localX = side * (DOOR_WIDTH / 2 + sideW / 2);
      this.addCollider(physics, localX, H / 2, D / 2, sideW, H, WALL_THICKNESS);
    }

    const lintelH = H - DOOR_HEIGHT;
    this.addCollider(physics, 0, DOOR_HEIGHT + lintelH / 2, D / 2, DOOR_WIDTH, lintelH, WALL_THICKNESS);

    // Upper floors are scenic massing, while the lobby remains walkable.
    this.addCollider(physics, 0, LOBBY_HEIGHT + TOWER_HEIGHT / 2, 0, 14, TOWER_HEIGHT, 17);
    this.addCollider(physics, 0, LOBBY_HEIGHT + TOWER_HEIGHT + 3, 0, 10, 6, 12);
  }

  private addLobby(
    group: THREE.Group,
    facadeMat: THREE.Material,
    lobbyMat: THREE.Material,
    goldMat: THREE.Material,
    floorMat: THREE.Material
  ) {
    const W = BASE_WIDTH;
    const D = BASE_DEPTH;
    const H = LOBBY_HEIGHT;

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(W - WALL_THICKNESS * 2, D - WALL_THICKNESS * 2), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.02;
    floor.receiveShadow = true;
    group.add(floor);

    this.addBox(group, 0, H / 2, -D / 2, W, H, WALL_THICKNESS, facadeMat);
    this.addBox(group, -W / 2, H / 2, 0, WALL_THICKNESS, H, D, facadeMat);
    this.addBox(group, W / 2, H / 2, 0, WALL_THICKNESS, H, D, facadeMat);

    const sideW = (W - DOOR_WIDTH) / 2;
    for (const side of [-1, 1]) {
      const x = side * (DOOR_WIDTH / 2 + sideW / 2);
      this.addBox(group, x, H / 2, D / 2, sideW, H, WALL_THICKNESS, facadeMat);
    }

    this.addBox(group, 0, DOOR_HEIGHT + (H - DOOR_HEIGHT) / 2, D / 2, DOOR_WIDTH, H - DOOR_HEIGHT, WALL_THICKNESS, lobbyMat);
    this.addBox(group, 0, DOOR_HEIGHT + 0.12, D / 2 + 0.62, DOOR_WIDTH + 1.2, 0.22, 1.05, goldMat);

    const glow = new THREE.Mesh(new THREE.PlaneGeometry(DOOR_WIDTH * 0.82, DOOR_HEIGHT * 0.7), new THREE.MeshBasicMaterial({ color: 0xffc86a }));
    glow.position.set(0, DOOR_HEIGHT * 0.48, D / 2 - WALL_THICKNESS);
    group.add(glow);

    const columns: InstanceTransform[] = [];
    for (const x of [-W * 0.32, W * 0.32]) {
      for (const z of [-D * 0.22, D * 0.18]) {
        columns.push({ position: [x, H / 2, z], scale: [0.28, H, 0.28] });
      }
    }
    group.add(createInstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 10), goldMat, columns, { name: 'Trump Lobby Columns', castShadow: true }));
  }

  private addTowerMass(group: THREE.Group, glassMat: THREE.Material, goldMat: THREE.Material) {
    this.addBox(group, 0, LOBBY_HEIGHT + 18, 0, 16.8, 36, 20.8, glassMat);
    this.addBox(group, 0, LOBBY_HEIGHT + 43, 0, 13.8, 26, 17.6, glassMat);
    this.addBox(group, 0, LOBBY_HEIGHT + TOWER_HEIGHT + 1.3, 0, 10, 2.6, 12, goldMat);
    this.addBox(group, 0, LOBBY_HEIGHT + TOWER_HEIGHT + 5.0, 0, 7.5, 4.8, 8.8, glassMat);
  }

  private addWindows(group: THREE.Group, glassMat: THREE.Material, goldMat: THREE.Material) {
    const windowTransforms: InstanceTransform[] = [];
    const goldTransforms: InstanceTransform[] = [];
    const tiers = [
      { w: 16.8, d: 20.8, y0: LOBBY_HEIGHT, h: 36, colsW: 8, colsD: 10, rows: 13 },
      { w: 13.8, d: 17.6, y0: LOBBY_HEIGHT + 30, h: 26, colsW: 7, colsD: 8, rows: 10 },
    ];

    for (const tier of tiers) {
      for (let row = 0; row < tier.rows; row++) {
        const y = tier.y0 + 1.6 + row * ((tier.h - 2.7) / Math.max(1, tier.rows - 1));
        for (const side of [1, -1]) {
          for (let col = 0; col < tier.colsW; col++) {
            const x = (col - (tier.colsW - 1) / 2) * (tier.w / (tier.colsW + 0.8));
            windowTransforms.push({
              position: [x, y, side * (tier.d / 2 + EXTERIOR_OFFSET)],
              rotation: [0, side < 0 ? Math.PI : 0, 0],
              scale: [0.62, 1.25, 1],
            });
          }
        }
        for (const side of [1, -1]) {
          for (let col = 0; col < tier.colsD; col++) {
            const z = (col - (tier.colsD - 1) / 2) * (tier.d / (tier.colsD + 0.9));
            windowTransforms.push({
              position: [side * (tier.w / 2 + EXTERIOR_OFFSET), y, z],
              rotation: [0, side > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
              scale: [0.56, 1.18, 1],
            });
          }
        }
      }

      for (const x of [-tier.w * 0.32, -tier.w * 0.16, 0, tier.w * 0.16, tier.w * 0.32]) {
        goldTransforms.push(
          { position: [x, tier.y0 + tier.h / 2, tier.d / 2 + 0.16], scale: [0.08, tier.h, 0.06] },
          { position: [x, tier.y0 + tier.h / 2, -tier.d / 2 - 0.16], scale: [0.08, tier.h, 0.06] }
        );
      }
    }

    group.add(createInstancedMesh(new THREE.PlaneGeometry(1, 1), glassMat, windowTransforms, { name: 'Trump Tower Blue Glass Windows' }));
    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), goldMat, goldTransforms, { name: 'Trump Tower Gold Mullions' }));
  }

  private addGeometricSign(group: THREE.Group, mat: THREE.Material) {
    const patterns: Record<string, string[]> = {
      T: ['111', '010', '010', '010', '010'],
      R: ['110', '101', '110', '101', '101'],
      U: ['101', '101', '101', '101', '111'],
      M: ['101', '111', '111', '101', '101'],
      P: ['110', '101', '110', '100', '100'],
    };
    const letters = 'TRUMP';
    const cells: InstanceTransform[] = [];
    const cell = 0.26;
    const gap = 0.08;
    const letterW = 3 * cell + 2 * gap;
    const totalW = letters.length * letterW + (letters.length - 1) * 0.18;
    const originX = -totalW / 2 + cell / 2;
    const yTop = 5.35;
    const z = BASE_DEPTH / 2 + 0.22;

    for (let li = 0; li < letters.length; li++) {
      const pattern = patterns[letters[li]];
      const x0 = originX + li * (letterW + 0.18);
      for (let row = 0; row < pattern.length; row++) {
        for (let col = 0; col < pattern[row].length; col++) {
          if (pattern[row][col] !== '1') continue;
          cells.push({
            position: [x0 + col * (cell + gap), yTop - row * (cell + gap), z],
            scale: [cell, cell, 0.07],
          });
        }
      }
    }

    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, cells, { name: 'Trump Tower Geometric Sign' }));
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
