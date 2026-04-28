import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CITY_BUILDING_NO_TREE_ZONES } from './CityLayout';
import { InstanceTransform, createInstancedMesh } from './InstancedMeshBuilder';

const TREE_TRUNK_RADIUS = 0.18;    // 18cm street tree trunk
const TREE_TRUNK_HEIGHT = 2.2;     // 2.2m average trunk before foliage
const TREE_SPACING = 16;           // 16m between sidewalk trees
const ROAD_WIDTH = 8;              // 8m roads, matching Environment
const SIDEWALK_OFFSET = ROAD_WIDTH / 2 + 3.0;

type TreeVariant = 'round' | 'tall' | 'young';

interface TreeConfig {
  x: number;
  z: number;
  scale: number;
  variant: TreeVariant;
  leafColor: number;
}

const NO_TREE_ZONES = [
  ...CITY_BUILDING_NO_TREE_ZONES,
  { x: 95, z: 60, w: 34, d: 42 },
  { x: -105, z: 84, w: 34, d: 38 },
  { x: 80, z: -126, w: 58, d: 58 },
];

export class TreeFactory {
  trees: THREE.Object3D[] = [];
  treeCount = 0;

  placeStreetTrees(scene: THREE.Scene, physics: PhysicsWorld) {
    const configs = this.createStreetTreeConfigs();
    const treeBatch = this.createTreeBatch(configs);

    scene.add(treeBatch);
    this.trees = [treeBatch];
    this.treeCount = configs.length;

    for (const config of configs) {
      this.createTreeCollider(config, physics);
    }
  }

  private createTreeBatch(configs: TreeConfig[]): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Street Tree Batch';

    const trunkMat = new THREE.MeshStandardMaterial({
      color: 0x5c4530,
      roughness: 0.94,
      metalness: 0.0,
    });
    const barkBandMat = new THREE.MeshStandardMaterial({
      color: 0x392d22,
      roughness: 0.96,
    });
    const planterMat = new THREE.MeshStandardMaterial({
      color: 0x2b2b29,
      roughness: 0.78,
      metalness: 0.12,
    });

    const trunkTransforms: InstanceTransform[] = [];
    const barkTransforms: InstanceTransform[] = [];
    const grateTransforms: InstanceTransform[] = [];
    const roundCrownTransforms: InstanceTransform[] = [];
    const tallCrownTransforms: InstanceTransform[] = [];
    const youngCrownTransforms: InstanceTransform[] = [];
    const leafClumpTransforms: InstanceTransform[] = [];

    for (const config of configs) {
      const trunkH = TREE_TRUNK_HEIGHT * config.scale;
      const trunkRadius = TREE_TRUNK_RADIUS * config.scale;

      trunkTransforms.push({
        position: [config.x, trunkH / 2, config.z],
        scale: [trunkRadius, trunkH, trunkRadius],
      });

      for (let i = 0; i < 3; i++) {
        barkTransforms.push({
          position: [config.x, trunkH * (0.28 + i * 0.22), config.z],
          scale: [trunkRadius, 1, trunkRadius],
        });
      }

      grateTransforms.push({
        position: [config.x, 0.028, config.z],
        scale: [1.25 * config.scale, 0.035, 1.25 * config.scale],
      });

      if (config.variant === 'young') {
        youngCrownTransforms.push({
          position: [config.x, trunkH + 0.92 * config.scale, config.z],
          scale: [config.scale, config.scale, config.scale],
          color: config.leafColor,
        });
        continue;
      }

      if (config.variant === 'tall') {
        tallCrownTransforms.push({
          position: [config.x, trunkH + 1.03 * config.scale, config.z],
          scale: [0.82 * config.scale, 1.35 * config.scale, 0.82 * config.scale],
          color: config.leafColor,
        });
      } else {
        roundCrownTransforms.push({
          position: [config.x, trunkH + 1.03 * config.scale, config.z],
          scale: [1.08 * config.scale, 0.92 * config.scale, 1.02 * config.scale],
          color: config.leafColor,
        });
      }

      const clumps = [
        [-0.72, 0.05, -0.18, 0.78],
        [0.68, 0.0, 0.14, 0.72],
        [0.0, 0.34, 0.62, 0.62],
      ];
      for (const [x, y, z, radius] of clumps) {
        leafClumpTransforms.push({
          position: [
            config.x + x * config.scale,
            trunkH + (1.06 + y) * config.scale,
            config.z + z * config.scale,
          ],
          scale: [radius * config.scale, radius * config.scale, radius * config.scale],
          color: config.leafColor,
        });
      }
    }

    group.add(createInstancedMesh(
      new THREE.CylinderGeometry(0.72, 1.0, 1, 8),
      trunkMat,
      trunkTransforms,
      { name: 'Street Tree Trunks', castShadow: true, receiveShadow: true }
    ));
    group.add(createInstancedMesh(
      new THREE.CylinderGeometry(0.76, 0.78, 0.035, 8),
      barkBandMat,
      barkTransforms,
      { name: 'Street Tree Bark Bands' }
    ));
    group.add(createInstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      planterMat,
      grateTransforms,
      { name: 'Street Tree Grates', receiveShadow: true }
    ));

    this.addLeafBatches(group, new THREE.SphereGeometry(1.25, 12, 10), roundCrownTransforms, 'Round Tree Crowns');
    this.addLeafBatches(group, new THREE.IcosahedronGeometry(1.25, 1), tallCrownTransforms, 'Tall Tree Crowns');
    this.addLeafBatches(group, new THREE.ConeGeometry(0.95, 2.15, 10), youngCrownTransforms, 'Young Tree Crowns');
    this.addLeafBatches(group, new THREE.SphereGeometry(1, 10, 8), leafClumpTransforms, 'Tree Crown Clumps');

    return group;
  }

  private addLeafBatches(
    group: THREE.Group,
    geometry: THREE.BufferGeometry,
    transforms: InstanceTransform[],
    name: string
  ) {
    if (transforms.length === 0) return;

    const byColor = new Map<number, InstanceTransform[]>();
    for (const transform of transforms) {
      const color = transform.color ?? 0x3f7d3d;
      const colorTransforms = byColor.get(color) ?? [];
      colorTransforms.push({
        position: transform.position,
        rotation: transform.rotation,
        scale: transform.scale,
      });
      byColor.set(color, colorTransforms);
    }

    for (const [color, colorTransforms] of byColor) {
      const leafMat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.88,
        metalness: 0.0,
      });
      group.add(createInstancedMesh(
        geometry,
        leafMat,
        colorTransforms,
        { name: `${name} ${color.toString(16)}`, castShadow: false }
      ));
    }
  }

  private createTreeCollider(config: TreeConfig, physics: PhysicsWorld) {
    const trunkH = TREE_TRUNK_HEIGHT * config.scale;
    const halfWidth = TREE_TRUNK_RADIUS * config.scale * 0.9;
    physics.createFixedCuboid(config.x, trunkH / 2, config.z, halfWidth, trunkH / 2, halfWidth);
  }

  private createStreetTreeConfigs(): TreeConfig[] {
    const roads = [-80, -40, 0, 40, 80];
    const linePositions: TreeConfig[] = [];
    const seen = new Set<string>();

    for (const roadX of roads) {
      for (const side of [-1, 1]) {
        const x = roadX + side * SIDEWALK_OFFSET;
        for (let z = -128; z <= 128; z += TREE_SPACING) {
          if (this.isNearIntersection(x, z, roads)) continue;
          this.pushTree(linePositions, seen, x, z);
        }
      }
    }

    for (const roadZ of roads) {
      for (const side of [-1, 1]) {
        const z = roadZ + side * SIDEWALK_OFFSET;
        for (let x = -128; x <= 128; x += TREE_SPACING) {
          if (this.isNearIntersection(x, z, roads)) continue;
          this.pushTree(linePositions, seen, x, z);
        }
      }
    }

    return linePositions;
  }

  private pushTree(configs: TreeConfig[], seen: Set<string>, x: number, z: number) {
    if (this.isInNoTreeZone(x, z)) return;
    const key = `${Math.round(x * 10)}:${Math.round(z * 10)}`;
    if (seen.has(key)) return;
    seen.add(key);

    const seed = this.hash2d(x, z);
    const variants: TreeVariant[] = ['round', 'round', 'tall', 'young'];
    const palette = [0x2f6b3c, 0x3f7d3d, 0x4d8839, 0x2d5f42];
    configs.push({
      x: x + (seed - 0.5) * 1.6,
      z: z + (this.hash2d(z, x) - 0.5) * 1.6,
      scale: 0.84 + seed * 0.34,
      variant: variants[Math.floor(seed * variants.length)],
      leafColor: palette[Math.floor(this.hash2d(x + 13, z - 7) * palette.length)],
    });
  }

  private isNearIntersection(x: number, z: number, roads: number[]): boolean {
    return roads.some((roadX) => Math.abs(x - roadX) < 11)
      && roads.some((roadZ) => Math.abs(z - roadZ) < 11);
  }

  private isInNoTreeZone(x: number, z: number): boolean {
    return NO_TREE_ZONES.some((zone) => {
      const halfW = zone.w / 2 + 2.2;
      const halfD = zone.d / 2 + 2.2;
      return Math.abs(x - zone.x) < halfW && Math.abs(z - zone.z) < halfD;
    });
  }

  private hash2d(x: number, z: number): number {
    const n = Math.sin(x * 12.9898 + z * 78.233) * 43758.5453;
    return n - Math.floor(n);
  }
}
