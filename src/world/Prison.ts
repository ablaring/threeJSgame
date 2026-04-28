import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { BuildingBounds } from './BuildingFactory';
import { InstanceTransform, createInstancedMesh } from './InstancedMeshBuilder';
import { batchInstancedMeshes, batchStaticMeshes } from './StaticGeometryBatcher';

const PRISON_WIDTH = 42;       // 42m compound width
const PRISON_DEPTH = 38;       // 38m compound depth
const WALL_HEIGHT = 4.2;       // 4.2m exterior security wall
const WALL_THICKNESS = 0.36;   // 36cm concrete wall
const GATE_WIDTH = 7.0;        // 7m vehicle gate

export class Prison {
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
      hx: PRISON_WIDTH / 2 + 1.6,
      hz: PRISON_DEPTH / 2 + 1.6,
    };
  }

  getGatePosition(): THREE.Vector3 {
    return new THREE.Vector3(this.x, 0, this.z + PRISON_DEPTH / 2 + 2.4);
  }

  getDropOffPosition(): THREE.Vector3 {
    return new THREE.Vector3(this.x, 0, this.z + PRISON_DEPTH / 2 - 5.8);
  }

  getCellPosition(index: number): THREE.Vector3 {
    const cellX = index % 2 === 0 ? -4.4 : 4.4;
    return new THREE.Vector3(this.x + cellX, 0, this.z + 1.7);
  }

  private createMesh(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'City Prison';
    group.position.set(this.x, 0, this.z);

    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x5f6468, roughness: 0.86 });
    const darkConcreteMat = new THREE.MeshStandardMaterial({ color: 0x34383c, roughness: 0.9 });
    const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x25272a, roughness: 0.92 });
    const barMat = new THREE.MeshStandardMaterial({ color: 0x11161b, metalness: 0.45, roughness: 0.42 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x89b8d0,
      emissive: 0x183345,
      emissiveIntensity: 0.25,
      roughness: 0.28,
      metalness: 0.2,
    });
    const warningMat = new THREE.MeshStandardMaterial({
      color: 0xf4c542,
      emissive: 0x5b3a00,
      emissiveIntensity: 0.28,
      roughness: 0.5,
    });

    const yard = new THREE.Mesh(new THREE.PlaneGeometry(PRISON_WIDTH, PRISON_DEPTH), asphaltMat);
    yard.rotation.x = -Math.PI / 2;
    yard.position.y = 0.035;
    yard.receiveShadow = true;
    group.add(yard);

    this.addPerimeter(group, concreteMat, barMat, warningMat);
    this.addCellBlock(group, darkConcreteMat, concreteMat, barMat, glassMat);
    this.addGuardTowers(group, concreteMat, barMat, glassMat);
    this.addRoadApron(group, asphaltMat, warningMat);
    this.addPrisonSign(group);

    batchStaticMeshes(group);
    batchInstancedMeshes(group);
    return group;
  }

  private createColliders(physics: PhysicsWorld) {
    const sideDepth = PRISON_DEPTH;
    const frontSideW = (PRISON_WIDTH - GATE_WIDTH) / 2;
    this.addCollider(physics, -PRISON_WIDTH / 2, WALL_HEIGHT / 2, 0, WALL_THICKNESS, WALL_HEIGHT, sideDepth);
    this.addCollider(physics, PRISON_WIDTH / 2, WALL_HEIGHT / 2, 0, WALL_THICKNESS, WALL_HEIGHT, sideDepth);
    this.addCollider(physics, 0, WALL_HEIGHT / 2, -PRISON_DEPTH / 2, PRISON_WIDTH, WALL_HEIGHT, WALL_THICKNESS);

    for (const side of [-1, 1]) {
      const x = side * (GATE_WIDTH / 2 + frontSideW / 2);
      this.addCollider(physics, x, WALL_HEIGHT / 2, PRISON_DEPTH / 2, frontSideW, WALL_HEIGHT, WALL_THICKNESS);
    }

    // Cell block shell, open on the north side so players can see the cells.
    this.addCollider(physics, 0, 2.6, -7.4, 18, 5.2, WALL_THICKNESS);
    this.addCollider(physics, -9, 2.6, -1.2, WALL_THICKNESS, 5.2, 12.4);
    this.addCollider(physics, 9, 2.6, -1.2, WALL_THICKNESS, 5.2, 12.4);
  }

  private addPerimeter(
    group: THREE.Group,
    concreteMat: THREE.Material,
    barMat: THREE.Material,
    warningMat: THREE.Material
  ) {
    this.addBox(group, -PRISON_WIDTH / 2, WALL_HEIGHT / 2, 0, WALL_THICKNESS, WALL_HEIGHT, PRISON_DEPTH, concreteMat);
    this.addBox(group, PRISON_WIDTH / 2, WALL_HEIGHT / 2, 0, WALL_THICKNESS, WALL_HEIGHT, PRISON_DEPTH, concreteMat);
    this.addBox(group, 0, WALL_HEIGHT / 2, -PRISON_DEPTH / 2, PRISON_WIDTH, WALL_HEIGHT, WALL_THICKNESS, concreteMat);

    const frontSideW = (PRISON_WIDTH - GATE_WIDTH) / 2;
    for (const side of [-1, 1]) {
      const x = side * (GATE_WIDTH / 2 + frontSideW / 2);
      this.addBox(group, x, WALL_HEIGHT / 2, PRISON_DEPTH / 2, frontSideW, WALL_HEIGHT, WALL_THICKNESS, concreteMat);
    }

    const bars: InstanceTransform[] = [];
    for (let x = -GATE_WIDTH / 2 + 0.5; x <= GATE_WIDTH / 2 - 0.5; x += 0.9) {
      bars.push({ position: [x, 2.2, PRISON_DEPTH / 2 + 0.05], scale: [0.08, 3.9, 0.08] });
    }
    for (let x = -PRISON_WIDTH / 2 + 1.1; x <= PRISON_WIDTH / 2 - 1.1; x += 1.35) {
      bars.push({ position: [x, WALL_HEIGHT + 0.58, -PRISON_DEPTH / 2], scale: [0.07, 1.15, 0.07] });
    }
    for (let z = -PRISON_DEPTH / 2 + 1.1; z <= PRISON_DEPTH / 2 - 1.1; z += 1.35) {
      bars.push(
        { position: [-PRISON_WIDTH / 2, WALL_HEIGHT + 0.58, z], scale: [0.07, 1.15, 0.07] },
        { position: [PRISON_WIDTH / 2, WALL_HEIGHT + 0.58, z], scale: [0.07, 1.15, 0.07] }
      );
    }
    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), barMat, bars, { name: 'Prison Bars', castShadow: true }));

    this.addBox(group, 0, WALL_HEIGHT + 1.25, -PRISON_DEPTH / 2, PRISON_WIDTH + 1.2, 0.16, 0.18, barMat);
    this.addBox(group, -PRISON_WIDTH / 2, WALL_HEIGHT + 1.25, 0, 0.18, 0.16, PRISON_DEPTH + 1.2, barMat);
    this.addBox(group, PRISON_WIDTH / 2, WALL_HEIGHT + 1.25, 0, 0.18, 0.16, PRISON_DEPTH + 1.2, barMat);

    this.addBox(group, 0, 0.07, PRISON_DEPTH / 2 + 2.6, GATE_WIDTH + 2.0, 0.08, 0.28, warningMat);
  }

  private addCellBlock(
    group: THREE.Group,
    wallMat: THREE.Material,
    trimMat: THREE.Material,
    barMat: THREE.Material,
    glassMat: THREE.Material
  ) {
    this.addBox(group, 0, 2.6, -7.4, 18, 5.2, 0.36, wallMat);
    this.addBox(group, -9, 2.6, -1.2, 0.36, 5.2, 12.4, wallMat);
    this.addBox(group, 9, 2.6, -1.2, 0.36, 5.2, 12.4, wallMat);
    this.addBox(group, 0, 5.25, -1.2, 18.4, 0.34, 12.6, trimMat);

    const bars: InstanceTransform[] = [];
    for (const cellX of [-4.4, 4.4]) {
      for (let x = cellX - 2.4; x <= cellX + 2.4; x += 0.6) {
        bars.push({ position: [x, 2.15, 4.95], scale: [0.07, 3.4, 0.07] });
      }
      bars.push(
        { position: [cellX, 3.82, 4.95], scale: [5.6, 0.08, 0.08] },
        { position: [cellX, 0.52, 4.95], scale: [5.6, 0.08, 0.08] }
      );
      this.addBox(group, cellX, 0.08, 1.8, 5.8, 0.08, 6.2, trimMat);
    }
    group.add(createInstancedMesh(new THREE.BoxGeometry(1, 1, 1), barMat, bars, { name: 'Cell Door Bars', castShadow: true }));

    const windows: InstanceTransform[] = [];
    for (const x of [-5.4, -1.8, 1.8, 5.4]) {
      windows.push({ position: [x, 3.45, -7.61], scale: [1.1, 0.72, 1] });
    }
    group.add(createInstancedMesh(new THREE.PlaneGeometry(1, 1), glassMat, windows, { name: 'Prison Cell Windows' }));
  }

  private addGuardTowers(
    group: THREE.Group,
    concreteMat: THREE.Material,
    barMat: THREE.Material,
    glassMat: THREE.Material
  ) {
    const towerPositions = [
      [-PRISON_WIDTH / 2 + 3.2, -PRISON_DEPTH / 2 + 3.2],
      [PRISON_WIDTH / 2 - 3.2, -PRISON_DEPTH / 2 + 3.2],
      [-PRISON_WIDTH / 2 + 3.2, PRISON_DEPTH / 2 - 3.2],
      [PRISON_WIDTH / 2 - 3.2, PRISON_DEPTH / 2 - 3.2],
    ];

    for (const [x, z] of towerPositions) {
      this.addBox(group, x, 2.7, z, 2.2, 5.4, 2.2, concreteMat);
      this.addBox(group, x, 6.0, z, 3.3, 1.3, 3.3, glassMat);
      this.addBox(group, x, 6.85, z, 4.0, 0.28, 4.0, barMat);
    }
  }

  private addRoadApron(group: THREE.Group, asphaltMat: THREE.Material, warningMat: THREE.Material) {
    const apron = new THREE.Mesh(new THREE.PlaneGeometry(11, 13), asphaltMat);
    apron.rotation.x = -Math.PI / 2;
    apron.position.set(0, 0.04, PRISON_DEPTH / 2 + 6.5);
    apron.receiveShadow = true;
    group.add(apron);

    for (const x of [-2.2, 2.2]) {
      this.addBox(group, x, 0.09, PRISON_DEPTH / 2 + 4.2, 0.28, 0.06, 5.4, warningMat);
    }
  }

  private addPrisonSign(group: THREE.Group) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1b2026';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#f2f4f7';
    ctx.lineWidth = 7;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
    ctx.fillStyle = '#f2f4f7';
    ctx.font = '800 58px Arial, Helvetica, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('PRISON', canvas.width / 2, canvas.height / 2 + 4);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(7.8, 1.95),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true })
    );
    sign.position.set(0, 5.6, PRISON_DEPTH / 2 + 0.21);
    group.add(sign);
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
