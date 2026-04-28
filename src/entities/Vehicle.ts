import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InputManager } from '../core/InputManager';
import { Player } from './Player';

const CAR_LENGTH = 4.5;       // 4.5m
const CAR_WIDTH = 2.0;        // 2m
const CAR_HEIGHT = 1.5;       // 1.5m
const CAR_MASS = 1200;        // 1200kg
const CAR_SPEED = 20;         // 20 m/s max
const CAR_TURN_SPEED = 2.5;   // rad/s
const ENTER_DISTANCE = 3;     // 3m to enter

// Camera settings when driving
const DRIVE_CAM_DIST = 10;
const DRIVE_CAM_HEIGHT = 5;
const DRIVE_CAM_SMOOTH = 6;

export class Vehicle {
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  private occupied = false;
  private steerAngle = 0;
  private currentSpeed = 0;

  constructor(
    x: number, z: number,
    color: number,
    private scene: THREE.Scene,
    private physics: PhysicsWorld
  ) {
    this.mesh = new THREE.Group();

    // Car body
    const bodyGeo = new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT * 0.6, CAR_LENGTH);
    const bodyMat = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.3 });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = CAR_HEIGHT * 0.3;
    bodyMesh.castShadow = true;
    this.mesh.add(bodyMesh);

    // Cabin / roof
    const cabinGeo = new THREE.BoxGeometry(CAR_WIDTH * 0.85, CAR_HEIGHT * 0.4, CAR_LENGTH * 0.5);
    const cabinMat = new THREE.MeshStandardMaterial({
      color: 0x88AACC,
      metalness: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.6,
    });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.y = CAR_HEIGHT * 0.8;
    cabin.position.z = -CAR_LENGTH * 0.05;
    cabin.castShadow = true;
    this.mesh.add(cabin);

    // Wheels
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.2, 12);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const wheelPositions = [
      [-CAR_WIDTH / 2 - 0.1, 0.35, CAR_LENGTH * 0.3],
      [CAR_WIDTH / 2 + 0.1, 0.35, CAR_LENGTH * 0.3],
      [-CAR_WIDTH / 2 - 0.1, 0.35, -CAR_LENGTH * 0.3],
      [CAR_WIDTH / 2 + 0.1, 0.35, -CAR_LENGTH * 0.3],
    ];
    for (const [wx, wy, wz] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, wheelMat);
      wheel.position.set(wx, wy, wz);
      wheel.rotation.z = Math.PI / 2;
      this.mesh.add(wheel);
    }

    // Headlights
    const lightGeo = new THREE.SphereGeometry(0.15, 8, 8);
    const lightMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFAA,
      emissive: 0xFFFFAA,
      emissiveIntensity: 0.5,
    });
    for (const side of [-0.7, 0.7]) {
      const headlight = new THREE.Mesh(lightGeo, lightMat);
      headlight.position.set(side, CAR_HEIGHT * 0.3, -CAR_LENGTH / 2 - 0.05);
      this.mesh.add(headlight);
    }

    // Taillights
    const tailMat = new THREE.MeshStandardMaterial({
      color: 0xFF0000,
      emissive: 0xFF0000,
      emissiveIntensity: 0.3,
    });
    for (const side of [-0.7, 0.7]) {
      const taillight = new THREE.Mesh(lightGeo, tailMat);
      taillight.position.set(side, CAR_HEIGHT * 0.3, CAR_LENGTH / 2 + 0.05);
      this.mesh.add(taillight);
    }

    this.mesh.position.set(x, 0, z);
    scene.add(this.mesh);

    // Physics body
    this.body = physics.createDynamicCuboid(
      x, CAR_HEIGHT / 2 + 0.1, z,
      CAR_WIDTH / 2, CAR_HEIGHT / 2, CAR_LENGTH / 2,
      CAR_MASS
    );
    // Prevent the car from flipping easily
    this.body.setAngularDamping(5.0);
    this.body.setLinearDamping(1.0);
  }

  canEnter(playerPos: THREE.Vector3): boolean {
    const carPos = this.body.translation();
    const dx = playerPos.x - carPos.x;
    const dz = playerPos.z - carPos.z;
    return Math.sqrt(dx * dx + dz * dz) < ENTER_DISTANCE;
  }

  enter() {
    this.occupied = true;
  }

  exit(): { x: number; y: number; z: number } {
    this.occupied = false;
    this.currentSpeed = 0;
    const pos = this.body.translation();
    // Exit to the left side of the car
    const rot = this.body.rotation();
    const angle = 2 * Math.atan2(rot.y, rot.w);
    return {
      x: pos.x + Math.cos(angle) * (CAR_WIDTH + 1),
      y: pos.y + 1,
      z: pos.z + Math.sin(angle) * (CAR_WIDTH + 1),
    };
  }

  isOccupied(): boolean {
    return this.occupied;
  }

  update(delta: number, input: InputManager, camera: THREE.PerspectiveCamera) {
    if (!this.occupied) {
      // Sync mesh to physics even when not driven
      this.syncMesh();
      return;
    }

    // --- Driving controls ---
    let acceleration = 0;
    let steering = 0;

    if (input.isKeyDown('KeyW')) acceleration = 1;
    if (input.isKeyDown('KeyS')) acceleration = -0.6;
    if (input.isKeyDown('KeyA')) steering = 1;
    if (input.isKeyDown('KeyD')) steering = -1;

    // Accelerate / brake
    this.currentSpeed += acceleration * CAR_SPEED * delta * 2;
    this.currentSpeed *= (1 - 2 * delta); // friction
    this.currentSpeed = Math.max(-CAR_SPEED * 0.4, Math.min(CAR_SPEED, this.currentSpeed));

    // Steering
    if (Math.abs(this.currentSpeed) > 0.5) {
      this.steerAngle = steering * CAR_TURN_SPEED * delta * Math.sign(this.currentSpeed);
    } else {
      this.steerAngle = 0;
    }

    // Apply forces
    const rot = this.body.rotation();
    const angle = 2 * Math.atan2(rot.y, rot.w);
    const newAngle = angle + this.steerAngle;

    const forwardX = -Math.sin(newAngle);
    const forwardZ = -Math.cos(newAngle);

    this.body.setLinvel(
      {
        x: forwardX * this.currentSpeed,
        y: this.body.linvel().y,
        z: forwardZ * this.currentSpeed,
      },
      true
    );

    // Set rotation
    this.body.setRotation(
      { x: 0, y: Math.sin(newAngle / 2), z: 0, w: Math.cos(newAngle / 2) },
      true
    );

    this.syncMesh();

    // --- Camera follow car ---
    const pos = this.body.translation();
    const camOffset = new THREE.Vector3(
      Math.sin(newAngle) * DRIVE_CAM_DIST,
      DRIVE_CAM_HEIGHT,
      Math.cos(newAngle) * DRIVE_CAM_DIST
    );
    const targetPos = new THREE.Vector3(pos.x, pos.y, pos.z).add(camOffset);
    const lerpFactor = 1 - Math.exp(-DRIVE_CAM_SMOOTH * delta);
    camera.position.lerp(targetPos, lerpFactor);
    camera.lookAt(pos.x, pos.y + 1, pos.z);
  }

  private syncMesh() {
    const pos = this.body.translation();
    const rot = this.body.rotation();
    this.mesh.position.set(pos.x, pos.y - CAR_HEIGHT / 2, pos.z);
    this.mesh.quaternion.set(rot.x, rot.y, rot.z, rot.w);
  }
}
