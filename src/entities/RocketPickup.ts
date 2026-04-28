import * as THREE from 'three';
import { buildRocketLauncher } from './RocketLauncher';

const PICKUP_RADIUS = 2.2;      // 2.2m
const PICKUP_HEIGHT = 0.23;     // grip rests just above the floor

export class RocketPickup {
  readonly mesh: THREE.Group;
  private collected = false;
  private ring: THREE.Mesh;

  constructor(
    x: number,
    z: number,
    scene: THREE.Scene,
    rotationY = 0
  ) {
    this.mesh = new THREE.Group();
    this.mesh.position.set(x, 0, z);

    const launcher = buildRocketLauncher();
    launcher.group.position.y = PICKUP_HEIGHT;
    launcher.group.rotation.y = rotationY;
    launcher.group.rotation.z = -0.08;
    this.mesh.add(launcher.group);

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffc64a,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    });
    this.ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.52, 0.012, 8, 48),
      ringMat
    );
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.y = 0.035;
    this.mesh.add(this.ring);

    scene.add(this.mesh);
  }

  canPickup(playerPos: THREE.Vector3): boolean {
    if (this.collected) return false;
    const dx = playerPos.x - this.mesh.position.x;
    const dz = playerPos.z - this.mesh.position.z;
    return Math.sqrt(dx * dx + dz * dz) <= PICKUP_RADIUS;
  }

  pickup(): boolean {
    if (this.collected) return false;
    this.collected = true;
    this.mesh.visible = false;
    return true;
  }

  update(delta: number) {
    if (this.collected) return;
    this.ring.rotation.z += delta * 1.8;
  }
}
