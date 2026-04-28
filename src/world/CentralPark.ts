import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InstanceTransform, createInstancedMesh } from './InstancedMeshBuilder';
import { batchInstancedMeshes, batchStaticMeshes } from './StaticGeometryBatcher';

const PARK_WIDTH = 158;        // 158m stylized Central Park width
const PARK_DEPTH = 98;         // 98m stylized Central Park depth
const SURFACE_Y = 0.052;       // above road planes to visually replace them
const TREE_TRUNK_HEIGHT = 2.35;
const TREE_TRUNK_RADIUS = 0.18;

type TreeVariant = 'round' | 'tall' | 'young';

interface ParkTreeConfig {
  x: number;
  z: number;
  scale: number;
  variant: TreeVariant;
  color: number;
}

export class CentralPark {
  mesh: THREE.Group;
  treeCount = 0;

  constructor(
    private x: number,
    private z: number,
    scene: THREE.Scene,
    physics: PhysicsWorld
  ) {
    this.mesh = this.createMesh(physics);
    scene.add(this.mesh);
  }

  private createMesh(physics: PhysicsWorld): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Central Park';
    group.position.set(this.x, 0, this.z);

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x315f34,
      roughness: 0.96,
      metalness: 0.0,
    });
    const pathMat = new THREE.MeshStandardMaterial({
      color: 0xb09b6e,
      roughness: 0.9,
    });
    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x2b6f86,
      emissive: 0x082532,
      emissiveIntensity: 0.22,
      roughness: 0.34,
      metalness: 0.06,
      transparent: true,
      opacity: 0.9,
    });
    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x77756a,
      roughness: 0.88,
    });
    const metalMat = new THREE.MeshStandardMaterial({
      color: 0x1f241f,
      roughness: 0.7,
      metalness: 0.28,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x6f4f2b,
      roughness: 0.84,
    });
    const lampMat = new THREE.MeshStandardMaterial({
      color: 0xffd994,
      emissive: 0xffb756,
      emissiveIntensity: 0.85,
      roughness: 0.48,
    });

    this.addGround(group, grassMat);
    this.addPaths(group, pathMat);
    this.addLake(group, waterMat, stoneMat);
    this.addFountain(group, physics, waterMat, stoneMat);
    this.addBoundaryFence(group, metalMat);
    this.addBenches(group, woodMat, metalMat);
    this.addLamps(group, metalMat, lampMat);
    this.addRocks(group, physics, stoneMat);
    this.addParkTrees(group, physics);

    batchStaticMeshes(group);
    batchInstancedMeshes(group);
    return group;
  }

  private addGround(group: THREE.Group, grassMat: THREE.Material) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(PARK_WIDTH, PARK_DEPTH), grassMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = SURFACE_Y;
    ground.receiveShadow = true;
    group.add(ground);
  }

  private addPaths(group: THREE.Group, pathMat: THREE.Material) {
    const paths: InstanceTransform[] = [
      { position: [0, SURFACE_Y + 0.012, 0], rotation: [-Math.PI / 2, 0, 0], scale: [PARK_WIDTH * 0.9, 4.2, 1] },
      { position: [0, SURFACE_Y + 0.014, -PARK_DEPTH * 0.28], rotation: [-Math.PI / 2, 0, 0], scale: [PARK_WIDTH * 0.78, 2.4, 1] },
      { position: [0, SURFACE_Y + 0.014, PARK_DEPTH * 0.28], rotation: [-Math.PI / 2, 0, 0], scale: [PARK_WIDTH * 0.78, 2.4, 1] },
      { position: [-PARK_WIDTH * 0.28, SURFACE_Y + 0.016, 0], rotation: [-Math.PI / 2, 0, Math.PI / 2], scale: [PARK_DEPTH * 0.78, 2.8, 1] },
      { position: [PARK_WIDTH * 0.28, SURFACE_Y + 0.016, 0], rotation: [-Math.PI / 2, 0, Math.PI / 2], scale: [PARK_DEPTH * 0.78, 2.8, 1] },
    ];

    group.add(createInstancedMesh(new THREE.PlaneGeometry(1, 1), pathMat, paths, { name: 'Central Park Paths', receiveShadow: true }));
  }

  private addLake(group: THREE.Group, waterMat: THREE.Material, stoneMat: THREE.Material) {
    const lake = new THREE.Mesh(new THREE.CircleGeometry(1, 48), waterMat);
    lake.scale.set(22, 11, 1);
    lake.rotation.x = -Math.PI / 2;
    lake.rotation.z = -0.28;
    lake.position.set(PARK_WIDTH * 0.22, SURFACE_Y + 0.026, PARK_DEPTH * 0.17);
    group.add(lake);

    const shore = new THREE.Mesh(new THREE.TorusGeometry(1, 0.055, 8, 64), stoneMat);
    shore.scale.set(22, 11, 1);
    shore.rotation.x = Math.PI / 2;
    shore.rotation.z = -0.28;
    shore.position.set(PARK_WIDTH * 0.22, SURFACE_Y + 0.038, PARK_DEPTH * 0.17);
    group.add(shore);
  }

  private addFountain(
    group: THREE.Group,
    physics: PhysicsWorld,
    waterMat: THREE.Material,
    stoneMat: THREE.Material
  ) {
    const fountain = new THREE.Group();
    fountain.position.set(-PARK_WIDTH * 0.18, SURFACE_Y, 0);

    const base = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.3, 0.32, 28), stoneMat);
    base.position.y = 0.16;
    base.receiveShadow = true;
    fountain.add(base);

    const water = new THREE.Mesh(new THREE.CylinderGeometry(1.72, 1.72, 0.06, 28), waterMat);
    water.position.y = 0.35;
    fountain.add(water);

    const center = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.34, 1.15, 14), stoneMat);
    center.position.y = 0.78;
    fountain.add(center);

    group.add(fountain);
    physics.createFixedCuboid(this.x - PARK_WIDTH * 0.18, 0.32, this.z, 2.2, 0.32, 2.2);
  }

  private addBoundaryFence(group: THREE.Group, metalMat: THREE.Material) {
    const rails: InstanceTransform[] = [];
    const posts: InstanceTransform[] = [];
    const halfW = PARK_WIDTH / 2;
    const halfD = PARK_DEPTH / 2;

    for (const side of [-1, 1]) {
      rails.push(
        { position: [0, 0.46, side * halfD], scale: [PARK_WIDTH, 0.08, 0.08] },
        { position: [side * halfW, 0.46, 0], scale: [0.08, 0.08, PARK_DEPTH] }
      );
    }

    for (let x = -halfW; x <= halfW; x += 8) {
      if (Math.abs(x) < 7) continue;
      posts.push({ position: [x, 0.38, -halfD], scale: [0.1, 0.76, 0.1] });
      posts.push({ position: [x, 0.38, halfD], scale: [0.1, 0.76, 0.1] });
    }
    for (let z = -halfD; z <= halfD; z += 8) {
      if (Math.abs(z) < 7) continue;
      posts.push({ position: [-halfW, 0.38, z], scale: [0.1, 0.76, 0.1] });
      posts.push({ position: [halfW, 0.38, z], scale: [0.1, 0.76, 0.1] });
    }

    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), metalMat, rails, { name: 'Central Park Fence Rails' }));
    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), metalMat, posts, { name: 'Central Park Fence Posts' }));
  }

  private addBenches(group: THREE.Group, woodMat: THREE.Material, metalMat: THREE.Material) {
    const seats: InstanceTransform[] = [];
    const legs: InstanceTransform[] = [];
    for (let i = 0; i < 16; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const x = -PARK_WIDTH * 0.38 + (i % 8) * (PARK_WIDTH * 0.76 / 7);
      const z = side * (PARK_DEPTH * 0.13 + Math.floor(i / 8) * PARK_DEPTH * 0.22);
      seats.push({
        position: [x, 0.33, z],
        rotation: [0, side > 0 ? Math.PI : 0, 0],
        scale: [1.65, 0.12, 0.42],
      });
      for (const lx of [-0.55, 0.55]) {
        legs.push({ position: [x + lx, 0.16, z - side * 0.12], scale: [0.08, 0.32, 0.08] });
        legs.push({ position: [x + lx, 0.16, z + side * 0.12], scale: [0.08, 0.32, 0.08] });
      }
    }
    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), woodMat, seats, { name: 'Central Park Benches' }));
    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), metalMat, legs, { name: 'Central Park Bench Legs' }));
  }

  private addLamps(group: THREE.Group, metalMat: THREE.Material, lampMat: THREE.Material) {
    const poles: InstanceTransform[] = [];
    const bulbs: InstanceTransform[] = [];
    for (let i = 0; i < 18; i++) {
      const x = -PARK_WIDTH * 0.42 + (i % 9) * (PARK_WIDTH * 0.84 / 8);
      const z = (i < 9 ? -1 : 1) * PARK_DEPTH * 0.08;
      poles.push({ position: [x, 1.25, z], scale: [0.055, 2.5, 0.055] });
      bulbs.push({ position: [x, 2.62, z], scale: [0.18, 0.18, 0.18] });
    }
    group.add(createInstancedMesh(new THREE.CylinderGeometry(1, 1, 1, 8), metalMat, poles, { name: 'Central Park Lamp Poles' }));
    group.add(createInstancedMesh(new THREE.SphereGeometry(1, 8, 6), lampMat, bulbs, { name: 'Central Park Lamp Bulbs' }));
  }

  private addRocks(group: THREE.Group, physics: PhysicsWorld, stoneMat: THREE.Material) {
    const rocks: InstanceTransform[] = [];
    for (let i = 0; i < 14; i++) {
      const seed = this.hash(i * 17.2, i * 9.1);
      const x = (seed - 0.5) * PARK_WIDTH * 0.72;
      const z = (this.hash(i * 5.9, i * 21.3) - 0.5) * PARK_DEPTH * 0.68;
      const scale = 0.55 + this.hash(i, 4) * 0.75;
      rocks.push({
        position: [x, 0.22, z],
        rotation: [this.hash(i, 1) * 0.4, this.hash(i, 2) * Math.PI, this.hash(i, 3) * 0.25],
        scale: [scale * 1.4, scale * 0.55, scale],
      });
      physics.createFixedCuboid(this.x + x, 0.28, this.z + z, scale * 0.72, 0.28, scale * 0.52);
    }
    group.add(createInstancedMesh(new THREE.IcosahedronGeometry(1, 1), stoneMat, rocks, { name: 'Central Park Rocks', castShadow: true, receiveShadow: true }));
  }

  private addParkTrees(group: THREE.Group, physics: PhysicsWorld) {
    const trees = this.createTreeConfigs();
    this.treeCount = trees.length;

    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5b422d, roughness: 0.94 });
    const leafPalette = new Map<number, InstanceTransform[]>();
    const trunks: InstanceTransform[] = [];

    for (const tree of trees) {
      const trunkH = TREE_TRUNK_HEIGHT * tree.scale;
      const trunkRadius = TREE_TRUNK_RADIUS * tree.scale;
      trunks.push({
        position: [tree.x, trunkH / 2, tree.z],
        scale: [trunkRadius, trunkH, trunkRadius],
      });

      const leafTransforms = leafPalette.get(tree.color) ?? [];
      const y = trunkH + 1.0 * tree.scale;
      if (tree.variant === 'young') {
        leafTransforms.push({ position: [tree.x, y, tree.z], scale: [0.85 * tree.scale, 1.08 * tree.scale, 0.85 * tree.scale] });
      } else {
        leafTransforms.push({ position: [tree.x, y, tree.z], scale: [1.15 * tree.scale, tree.variant === 'tall' ? 1.42 * tree.scale : 0.92 * tree.scale, 1.08 * tree.scale] });
      }
      leafPalette.set(tree.color, leafTransforms);

      physics.createFixedCuboid(this.x + tree.x, trunkH / 2, this.z + tree.z, trunkRadius * 0.9, trunkH / 2, trunkRadius * 0.9);
    }

    group.add(createInstancedMesh(new THREE.CylinderGeometry(0.72, 1, 1, 8), trunkMat, trunks, { name: 'Central Park Tree Trunks', castShadow: true }));
    for (const [color, transforms] of leafPalette) {
      const leafMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
      group.add(createInstancedMesh(new THREE.SphereGeometry(1.1, 10, 8), leafMat, transforms, { name: `Central Park Tree Crowns ${color.toString(16)}` }));
    }
  }

  private createTreeConfigs(): ParkTreeConfig[] {
    const trees: ParkTreeConfig[] = [];
    const palette = [0x2f6b3c, 0x3f7d3d, 0x4f8b3d, 0x285a33];
    for (let x = -PARK_WIDTH * 0.43; x <= PARK_WIDTH * 0.43; x += 10) {
      for (let z = -PARK_DEPTH * 0.38; z <= PARK_DEPTH * 0.38; z += 10) {
        if (Math.abs(z) < 6 || Math.abs(x - PARK_WIDTH * 0.22) < 25 && Math.abs(z - PARK_DEPTH * 0.17) < 15) continue;
        const seed = this.hash(x, z);
        if (seed < 0.32) continue;
        const variant: TreeVariant = seed > 0.82 ? 'tall' : seed < 0.45 ? 'young' : 'round';
        trees.push({
          x: x + (seed - 0.5) * 2.2,
          z: z + (this.hash(z, x) - 0.5) * 2.2,
          scale: 0.82 + seed * 0.42,
          variant,
          color: palette[Math.floor(this.hash(x + 11, z - 3) * palette.length)],
        });
      }
    }
    return trees;
  }

  private hash(x: number, z: number): number {
    const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
}
