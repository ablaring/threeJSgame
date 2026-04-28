import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CITY_ALLEY_PLACEMENTS, CityAlleyPlacement } from './CityLayout';
import { batchStaticMeshes } from './StaticGeometryBatcher';

const SURFACE_Y = 0.032;            // 3.2cm above ground to avoid z-fighting
const DUMPSTER_LENGTH = 2.2;        // 2.2m long street dumpster
const DUMPSTER_DEPTH = 1.05;        // 1.05m deep
const DUMPSTER_HEIGHT = 1.15;       // 1.15m high
const TRASH_CAN_RADIUS = 0.32;      // 32cm metal trash can radius
const TRASH_CAN_HEIGHT = 0.82;      // 82cm high

export class AlleyFactory {
  alleys: THREE.Group[] = [];

  private alleyMat = new THREE.MeshStandardMaterial({
    color: 0x20201d,
    roughness: 0.96,
    metalness: 0.0,
  });

  private grimeMat = new THREE.MeshStandardMaterial({
    color: 0x171512,
    transparent: true,
    opacity: 0.48,
    roughness: 1.0,
    depthWrite: false,
  });

  private wetPatchMat = new THREE.MeshStandardMaterial({
    color: 0x0f1112,
    transparent: true,
    opacity: 0.62,
    roughness: 0.42,
    metalness: 0.08,
    depthWrite: false,
  });

  private dumpsterGreenMat = new THREE.MeshStandardMaterial({
    color: 0x244236,
    roughness: 0.78,
    metalness: 0.22,
  });

  private dumpsterBlueMat = new THREE.MeshStandardMaterial({
    color: 0x25384c,
    roughness: 0.76,
    metalness: 0.24,
  });

  private blackPlasticMat = new THREE.MeshStandardMaterial({
    color: 0x080807,
    roughness: 0.68,
    metalness: 0.02,
  });

  private cardboardMat = new THREE.MeshStandardMaterial({
    color: 0x8f6a3f,
    roughness: 0.92,
  });

  private paperMat = new THREE.MeshStandardMaterial({
    color: 0xd3c9ad,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });

  private metalMat = new THREE.MeshStandardMaterial({
    color: 0x5f6666,
    roughness: 0.62,
    metalness: 0.5,
  });

  private bulbMat = new THREE.MeshStandardMaterial({
    color: 0xffc978,
    emissive: 0xffa43a,
    emissiveIntensity: 1.15,
    roughness: 0.35,
  });

  private graffitiMats = [
    new THREE.MeshBasicMaterial({ color: 0xe04b38, transparent: true, opacity: 0.74 }),
    new THREE.MeshBasicMaterial({ color: 0x2e8ecf, transparent: true, opacity: 0.72 }),
    new THREE.MeshBasicMaterial({ color: 0xf0d24a, transparent: true, opacity: 0.7 }),
  ];

  placeAlleys(scene: THREE.Scene, physics: PhysicsWorld) {
    for (const config of CITY_ALLEY_PLACEMENTS) {
      const alley = this.createAlleyMesh(config, physics);
      scene.add(alley);
      this.alleys.push(alley);
    }
  }

  private createAlleyMesh(config: CityAlleyPlacement, physics: PhysicsWorld): THREE.Group {
    const group = new THREE.Group();
    group.name = 'Dirty NYC Alley';

    this.addAlleySurface(group, config);
    this.addWallGrime(group, config);
    this.addCablesAndLights(group, config);
    this.addProps(group, config, physics);
    this.addLooseTrash(group, config);
    batchStaticMeshes(group);

    return group;
  }

  private addAlleySurface(group: THREE.Group, config: CityAlleyPlacement) {
    const surface = new THREE.Mesh(
      config.orientation === 'northSouth'
        ? new THREE.PlaneGeometry(config.width, config.length)
        : new THREE.PlaneGeometry(config.length, config.width),
      this.alleyMat
    );
    surface.rotation.x = -Math.PI / 2;
    surface.position.set(config.x, SURFACE_Y, config.z);
    surface.receiveShadow = true;
    group.add(surface);

    for (let i = 0; i < 4; i++) {
      const along = this.random(config.seed, i) * config.length - config.length / 2;
      const cross = (this.random(config.seed + 3, i) - 0.5) * config.width * 0.44;
      const pos = this.toWorld(config, along, cross);
      const patch = new THREE.Mesh(
        new THREE.PlaneGeometry(0.9 + this.random(config.seed + 5, i) * 1.6, 0.28 + this.random(config.seed + 6, i) * 0.45),
        this.wetPatchMat
      );
      patch.rotation.x = -Math.PI / 2;
      patch.rotation.z = this.random(config.seed + 8, i) * Math.PI;
      patch.position.set(pos.x, SURFACE_Y + 0.006, pos.z);
      group.add(patch);
    }
  }

  private addWallGrime(group: THREE.Group, config: CityAlleyPlacement) {
    for (const side of [-1, 1]) {
      const panel = new THREE.Mesh(new THREE.PlaneGeometry(config.length * 0.92, 2.8), this.grimeMat);
      if (config.orientation === 'northSouth') {
        panel.position.set(config.x + side * (config.width / 2 + 0.035), 1.4, config.z);
        panel.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        panel.position.set(config.x, 1.4, config.z + side * (config.width / 2 + 0.035));
        panel.rotation.y = side > 0 ? Math.PI : 0;
      }
      group.add(panel);

      for (let i = 0; i < 3; i++) {
        const along = (this.random(config.seed + side * 17, i) - 0.5) * config.length * 0.72;
        const pos = this.toWorld(config, along, side * (config.width / 2 + 0.042));
        const tag = new THREE.Mesh(
          new THREE.PlaneGeometry(0.55 + this.random(config.seed + 9, i) * 0.7, 0.22 + this.random(config.seed + 10, i) * 0.32),
          this.graffitiMats[(config.seed + i + (side > 0 ? 1 : 0)) % this.graffitiMats.length]
        );
        tag.position.set(pos.x, 0.85 + this.random(config.seed + 11, i) * 1.15, pos.z);
        if (config.orientation === 'northSouth') {
          tag.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
        } else {
          tag.rotation.y = side > 0 ? Math.PI : 0;
        }
        group.add(tag);
      }
    }
  }

  private addCablesAndLights(group: THREE.Group, config: CityAlleyPlacement) {
    const cableMat = new THREE.MeshStandardMaterial({ color: 0x0b0b0a, roughness: 0.8, metalness: 0.25 });
    for (let i = 0; i < 3; i++) {
      const along = (-0.34 + i * 0.34 + (this.random(config.seed + 40, i) - 0.5) * 0.08) * config.length;
      const pos = this.toWorld(config, along, 0);
      const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, config.width + 0.9, 8), cableMat);
      cable.position.set(pos.x, 3.1 + i * 0.28, pos.z);
      if (config.orientation === 'northSouth') {
        cable.rotation.z = Math.PI / 2;
      } else {
        cable.rotation.x = Math.PI / 2;
      }
      group.add(cable);
    }

    const lightPos = this.toWorld(config, -config.length * 0.18, 0);
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.12, 0.18), this.metalMat);
    fixture.position.set(lightPos.x, 2.85, lightPos.z);
    fixture.rotation.y = config.orientation === 'northSouth' ? Math.PI / 2 : 0;
    group.add(fixture);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), this.bulbMat);
    bulb.position.set(lightPos.x, 2.72, lightPos.z);
    group.add(bulb);
  }

  private addProps(group: THREE.Group, config: CityAlleyPlacement, physics: PhysicsWorld) {
    const yaw = config.orientation === 'northSouth' ? Math.PI / 2 : 0;
    const sideA = this.random(config.seed, 100) > 0.5 ? 1 : -1;
    const sideB = -sideA;
    const dumpsterCross = sideA * (config.width / 2 - DUMPSTER_DEPTH / 2 - 0.1);
    const dumpsterPos = this.toWorld(config, -config.length * 0.27, dumpsterCross);
    this.addDumpster(group, physics, dumpsterPos.x, dumpsterPos.z, yaw, config.seed % 2 === 0);

    const canCross = sideB * (config.width / 2 - TRASH_CAN_RADIUS - 0.12);
    for (let i = 0; i < 2; i++) {
      const pos = this.toWorld(config, config.length * (0.04 + i * 0.23), canCross);
      this.addTrashCan(group, physics, pos.x, pos.z, config.seed + i * 13);
    }

    for (let i = 0; i < 6; i++) {
      const along = -config.length * 0.36 + i * config.length * 0.12 + (this.random(config.seed + 2, i) - 0.5) * 1.2;
      const cross = (i % 2 === 0 ? sideA : sideB) * (config.width / 2 - 0.32 - this.random(config.seed + 4, i) * 0.28);
      const pos = this.toWorld(config, along, cross);
      this.addTrashBag(group, pos.x, pos.z, config.seed + i);
    }

    for (let i = 0; i < 4; i++) {
      const along = config.length * (0.18 + i * 0.08) + (this.random(config.seed + 20, i) - 0.5) * 1.4;
      const cross = (this.random(config.seed + 21, i) - 0.5) * config.width * 0.48;
      const pos = this.toWorld(config, along, cross);
      this.addCardboard(group, pos.x, pos.z, this.random(config.seed + 22, i) * Math.PI);
    }
  }

  private addDumpster(
    group: THREE.Group,
    physics: PhysicsWorld,
    x: number,
    z: number,
    yaw: number,
    blueVariant: boolean
  ) {
    const dumpster = this.createDumpsterMesh(blueVariant);
    dumpster.position.set(x, 0, z);
    dumpster.rotation.y = yaw;
    group.add(dumpster);
    this.createDumpsterCollider(physics, x, z, yaw);
  }

  private createDumpsterMesh(blueVariant: boolean): THREE.Group {
    const group = new THREE.Group();
    const mat = blueVariant ? this.dumpsterBlueMat : this.dumpsterGreenMat;
    const trimMat = this.metalMat;

    const body = new THREE.Mesh(new THREE.BoxGeometry(DUMPSTER_LENGTH, DUMPSTER_HEIGHT, DUMPSTER_DEPTH), mat);
    body.position.y = DUMPSTER_HEIGHT / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(DUMPSTER_LENGTH * 0.94, 0.1, DUMPSTER_DEPTH * 0.58), trimMat);
    lid.position.set(0, DUMPSTER_HEIGHT + 0.08, -DUMPSTER_DEPTH * 0.18);
    lid.rotation.x = -0.18;
    lid.castShadow = true;
    group.add(lid);

    for (const x of [-0.72, 0, 0.72]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.08, DUMPSTER_HEIGHT * 0.86, DUMPSTER_DEPTH + 0.035), trimMat);
      rib.position.set(x, DUMPSTER_HEIGHT * 0.48, 0);
      rib.castShadow = true;
      group.add(rib);
    }

    for (const x of [-0.76, 0.76]) {
      for (const z of [-0.42, 0.42]) {
        const wheel = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), this.blackPlasticMat);
        wheel.position.set(x, 0.08, z);
        wheel.castShadow = true;
        group.add(wheel);
      }
    }

    return group;
  }

  private createDumpsterCollider(physics: PhysicsWorld, x: number, z: number, yaw: number) {
    const alongX = Math.abs(Math.cos(yaw)) > 0.5;
    physics.createFixedCuboid(
      x,
      DUMPSTER_HEIGHT / 2,
      z,
      alongX ? DUMPSTER_LENGTH / 2 : DUMPSTER_DEPTH / 2,
      DUMPSTER_HEIGHT / 2,
      alongX ? DUMPSTER_DEPTH / 2 : DUMPSTER_LENGTH / 2
    );
  }

  private addTrashCan(group: THREE.Group, physics: PhysicsWorld, x: number, z: number, seed: number) {
    const trashCan = this.createTrashCanMesh(seed);
    trashCan.position.set(x, 0, z);
    trashCan.rotation.y = this.random(seed, 3) * Math.PI * 2;
    group.add(trashCan);
    this.createTrashCanCollider(physics, x, z);
  }

  private createTrashCanMesh(seed: number): THREE.Group {
    const group = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(TRASH_CAN_RADIUS * 0.9, TRASH_CAN_RADIUS, TRASH_CAN_HEIGHT, 14),
      this.metalMat
    );
    body.position.y = TRASH_CAN_HEIGHT / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);

    const lid = new THREE.Mesh(new THREE.CylinderGeometry(TRASH_CAN_RADIUS * 1.04, TRASH_CAN_RADIUS * 0.92, 0.08, 14), this.metalMat);
    lid.position.y = TRASH_CAN_HEIGHT + 0.04;
    lid.rotation.z = (this.random(seed, 1) - 0.5) * 0.18;
    lid.castShadow = true;
    group.add(lid);

    return group;
  }

  private createTrashCanCollider(physics: PhysicsWorld, x: number, z: number) {
    physics.createFixedCuboid(x, TRASH_CAN_HEIGHT / 2, z, TRASH_CAN_RADIUS, TRASH_CAN_HEIGHT / 2, TRASH_CAN_RADIUS);
  }

  private addTrashBag(group: THREE.Group, x: number, z: number, seed: number) {
    const bag = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 1), this.blackPlasticMat);
    const scaleX = 0.75 + this.random(seed, 1) * 0.45;
    const scaleZ = 0.7 + this.random(seed, 2) * 0.48;
    bag.scale.set(scaleX, 0.58 + this.random(seed, 3) * 0.22, scaleZ);
    bag.position.set(x, 0.26, z);
    bag.rotation.set(this.random(seed, 4) * 0.26, this.random(seed, 5) * Math.PI * 2, this.random(seed, 6) * 0.16);
    bag.castShadow = true;
    bag.receiveShadow = true;
    group.add(bag);
  }

  private addCardboard(group: THREE.Group, x: number, z: number, yaw: number) {
    const stack = new THREE.Group();
    stack.position.set(x, 0, z);
    stack.rotation.y = yaw;

    const flat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.07, 0.56), this.cardboardMat);
    flat.position.y = 0.055;
    flat.castShadow = true;
    flat.receiveShadow = true;
    stack.add(flat);

    const leaning = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.04, 0.82), this.cardboardMat);
    leaning.position.set(0.18, 0.37, -0.16);
    leaning.rotation.x = 0.72;
    leaning.castShadow = true;
    stack.add(leaning);

    group.add(stack);
  }

  private addLooseTrash(group: THREE.Group, config: CityAlleyPlacement) {
    for (let i = 0; i < 18; i++) {
      const along = (this.random(config.seed + 90, i) - 0.5) * config.length * 0.9;
      const cross = (this.random(config.seed + 91, i) - 0.5) * config.width * 0.78;
      const pos = this.toWorld(config, along, cross);

      if (i % 5 === 0) {
        const can = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.16, 8), this.metalMat);
        can.position.set(pos.x, 0.08, pos.z);
        can.rotation.set(Math.PI / 2, this.random(config.seed + 92, i) * Math.PI, this.random(config.seed + 93, i) * Math.PI);
        can.castShadow = true;
        group.add(can);
        continue;
      }

      const paper = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16 + this.random(config.seed + 94, i) * 0.2, 0.11 + this.random(config.seed + 95, i) * 0.18),
        this.paperMat
      );
      paper.rotation.x = -Math.PI / 2;
      paper.rotation.z = this.random(config.seed + 96, i) * Math.PI * 2;
      paper.position.set(pos.x, SURFACE_Y + 0.012, pos.z);
      group.add(paper);
    }
  }

  private toWorld(config: CityAlleyPlacement, along: number, cross: number): { x: number; z: number } {
    if (config.orientation === 'northSouth') {
      return { x: config.x + cross, z: config.z + along };
    }
    return { x: config.x + along, z: config.z + cross };
  }

  private random(seed: number, index: number): number {
    const n = Math.sin(seed * 127.1 + index * 311.7) * 43758.5453123;
    return n - Math.floor(n);
  }
}
