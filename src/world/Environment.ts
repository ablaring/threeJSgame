import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';

const GROUND_SIZE = 500;    // 500m x 500m
const ROAD_WIDTH = 8;       // 8m (2 lanes)

export class Environment {
  ground!: THREE.Mesh;
  roads: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, physics: PhysicsWorld) {
    this.createLights(scene);
    this.createGround(scene, physics);
    this.createRoads(scene);
  }

  private createLights(scene: THREE.Scene) {
    // Ambient light for base illumination
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    scene.add(ambient);

    // Hemisphere light for sky/ground color bleed
    const hemi = new THREE.HemisphereLight(0x87CEEB, 0x556B2F, 0.3);
    scene.add(hemi);

    // Directional light (sun) with shadows
    const sun = new THREE.DirectionalLight(0xffffff, 1.2);
    sun.position.set(50, 100, 50);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 300;
    sun.shadow.camera.left = -100;
    sun.shadow.camera.right = 100;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -100;
    sun.shadow.bias = -0.001;
    scene.add(sun);
  }

  private createGround(scene: THREE.Scene, physics: PhysicsWorld) {
    // Visual ground
    const groundGeo = new THREE.PlaneGeometry(GROUND_SIZE, GROUND_SIZE);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x464640,    // city concrete instead of open grass
      roughness: 0.94,
      metalness: 0.0,
    });
    this.ground = new THREE.Mesh(groundGeo, groundMat);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.receiveShadow = true;
    scene.add(this.ground);

    // Physics ground — thin cuboid
    physics.createFixedCuboid(0, -0.1, 0, GROUND_SIZE / 2, 0.1, GROUND_SIZE / 2);
  }

  private createRoads(scene: THREE.Scene) {
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x242424,
      roughness: 0.88,
    });

    // Main road N-S
    const road1 = new THREE.Mesh(
      new THREE.PlaneGeometry(ROAD_WIDTH, GROUND_SIZE),
      roadMat
    );
    road1.rotation.x = -Math.PI / 2;
    road1.position.y = 0.01; // slightly above ground to avoid z-fighting
    scene.add(road1);
    this.roads.push(road1);

    // Main road E-W
    const road2 = new THREE.Mesh(
      new THREE.PlaneGeometry(GROUND_SIZE, ROAD_WIDTH),
      roadMat
    );
    road2.rotation.x = -Math.PI / 2;
    road2.position.y = 0.01;
    scene.add(road2);
    this.roads.push(road2);

    // Parallel streets
    for (let offset of [-40, 40, -80, 80]) {
      const roadNS = new THREE.Mesh(
        new THREE.PlaneGeometry(ROAD_WIDTH, GROUND_SIZE),
        roadMat
      );
      roadNS.rotation.x = -Math.PI / 2;
      roadNS.position.set(offset, 0.01, 0);
      scene.add(roadNS);
      this.roads.push(roadNS);

      const roadEW = new THREE.Mesh(
        new THREE.PlaneGeometry(GROUND_SIZE, ROAD_WIDTH),
        roadMat
      );
      roadEW.rotation.x = -Math.PI / 2;
      roadEW.position.set(0, 0.01, offset);
      scene.add(roadEW);
      this.roads.push(roadEW);
    }

    // Road markings — dashed center lines on the whole street grid.
    for (const offset of [0, -40, 40, -80, 80]) {
      this.addCenterLine(scene, offset, 0, true);
      this.addCenterLine(scene, 0, offset, false);
    }
  }

  private addCenterLine(scene: THREE.Scene, x: number, z: number, northSouth: boolean) {
    const lineMat = new THREE.MeshStandardMaterial({ color: 0xFFFF00 });
    const dashLength = 3;
    const gapLength = 2;

    for (let i = -GROUND_SIZE / 2; i < GROUND_SIZE / 2; i += dashLength + gapLength) {
      const dash = new THREE.Mesh(
        new THREE.PlaneGeometry(
          northSouth ? 0.15 : dashLength,
          northSouth ? dashLength : 0.15
        ),
        lineMat
      );
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(
        northSouth ? x : i + dashLength / 2,
        0.02,
        northSouth ? i + dashLength / 2 : z
      );
      scene.add(dash);
    }
  }
}
