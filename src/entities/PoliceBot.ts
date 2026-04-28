import * as THREE from 'three';
import { buildCharacter } from './CharacterBuilder';
import { BuildingBounds } from '../world/BuildingFactory';

const POLICE_HP = 50;
const CAR_LENGTH = 4.8;       // 4.8m
const CAR_WIDTH = 2.1;        // 2.1m
const CAR_HEIGHT = 1.45;      // 1.45m
const STOP_DISTANCE = 11;     // 11m from target before shooting
const SHOOT_RANGE = 38;       // 38m
const BULLET_DAMAGE = 6;
const CAR_COLLISION_RADIUS = 1.55;

export interface PoliceShotEvent {
  origin: THREE.Vector3;
  end: THREE.Vector3;
  hitPlayer: boolean;
  damage: number;
}

export class PoliceBot {
  readonly id: string;
  readonly group = new THREE.Group();
  readonly hitObjects: THREE.Object3D[] = [];
  hp = POLICE_HP;
  dead = false;

  private speed = 9;
  private lastShotAt = 0;
  private despawnAt = 0;
  private muzzle = new THREE.Object3D();
  private sirenPhase = Math.random() * Math.PI * 2;
  private redSiren?: THREE.Mesh;
  private blueSiren?: THREE.Mesh;

  constructor(id: string, position: THREE.Vector3, scene: THREE.Scene) {
    this.id = id;
    this.group.position.copy(position);
    this.group.position.y = 0;
    this.buildPoliceCar();
    scene.add(this.group);
  }

  update(
    delta: number,
    playerPos: THREE.Vector3,
    wantedLevel: number,
    obstacles: BuildingBounds[],
    onShot: (event: PoliceShotEvent) => void,
    chaseTarget: THREE.Vector3 = playerPos
  ) {
    if (this.dead) return;

    const toPlayer = chaseTarget.clone().sub(this.group.position);
    toPlayer.y = 0;
    const distance = toPlayer.length();
    if (distance > 0.001) {
      toPlayer.normalize();
      const targetYaw = Math.atan2(-toPlayer.x, -toPlayer.z);
      this.group.rotation.y = this.lerpAngle(this.group.rotation.y, targetYaw, 1 - Math.exp(-5 * delta));
    }

    const chaseSpeed = this.speed + wantedLevel * 1.2;
    if (distance > STOP_DISTANCE) {
      this.moveAvoidingBuildings(toPlayer, chaseSpeed * delta, obstacles);
    }

    this.animateSiren(delta);
    this.tryShoot(playerPos, wantedLevel, onShot);
  }

  applyDamage(damage: number): boolean {
    if (this.dead) return false;
    this.hp = Math.max(0, this.hp - damage);
    if (this.hp > 0) return false;

    this.dead = true;
    this.despawnAt = performance.now() + 3000;
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mat = obj.material;
        if (mat instanceof THREE.MeshStandardMaterial) {
          mat.color.multiplyScalar(0.45);
          mat.emissive.setHex(0x000000);
        }
      }
    });
    this.group.rotation.z = 0.08;
    return true;
  }

  shouldDespawn(): boolean {
    return this.dead && performance.now() > this.despawnAt;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.muzzle.getWorldPosition(out);
  }

  private buildPoliceCar() {
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf4f4ee, roughness: 0.36, metalness: 0.35 });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x101214, roughness: 0.5, metalness: 0.45 });
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x7fb4d8,
      emissive: 0x123047,
      emissiveIntensity: 0.25,
      roughness: 0.12,
      metalness: 0.45,
      transparent: true,
      opacity: 0.72,
    });
    const redMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 0.7 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x2064ff, emissive: 0x1040ff, emissiveIntensity: 0.7 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x090909, roughness: 0.82 });

    const body = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH, CAR_HEIGHT * 0.58, CAR_LENGTH), whiteMat);
    body.position.y = CAR_HEIGHT * 0.33;
    body.castShadow = true;
    this.group.add(body);
    this.hitObjects.push(body);

    const blackDoorLeft = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.55, 1.25), blackMat);
    blackDoorLeft.position.set(-CAR_WIDTH / 2 - 0.025, CAR_HEIGHT * 0.38, -0.15);
    this.group.add(blackDoorLeft);

    const blackDoorRight = blackDoorLeft.clone();
    blackDoorRight.position.x = CAR_WIDTH / 2 + 0.025;
    this.group.add(blackDoorRight);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH * 0.92, 0.08, 1.05), blackMat);
    hood.position.set(0, CAR_HEIGHT * 0.65, -CAR_LENGTH * 0.3);
    this.group.add(hood);

    const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR_WIDTH * 0.82, CAR_HEIGHT * 0.44, CAR_LENGTH * 0.48), glassMat);
    cabin.position.set(0, CAR_HEIGHT * 0.82, -CAR_LENGTH * 0.02);
    cabin.castShadow = true;
    this.group.add(cabin);
    this.hitObjects.push(cabin);

    const labelTexture = this.createPoliceLabel();
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, transparent: true });
    for (const side of [-1, 1]) {
      const label = new THREE.Mesh(new THREE.PlaneGeometry(1.25, 0.34), labelMat);
      label.position.set(side * (CAR_WIDTH / 2 + 0.032), CAR_HEIGHT * 0.48, -0.12);
      label.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      this.group.add(label);
    }

    this.redSiren = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.22), redMat);
    this.redSiren.position.set(-0.18, CAR_HEIGHT * 1.08, -0.05);
    this.group.add(this.redSiren);

    this.blueSiren = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.22), blueMat);
    this.blueSiren.position.set(0.18, CAR_HEIGHT * 1.08, -0.05);
    this.group.add(this.blueSiren);

    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14);
    const wheelPositions = [
      [-CAR_WIDTH / 2 - 0.08, 0.34, CAR_LENGTH * 0.31],
      [CAR_WIDTH / 2 + 0.08, 0.34, CAR_LENGTH * 0.31],
      [-CAR_WIDTH / 2 - 0.08, 0.34, -CAR_LENGTH * 0.31],
      [CAR_WIDTH / 2 + 0.08, 0.34, -CAR_LENGTH * 0.31],
    ];
    for (const [x, y, z] of wheelPositions) {
      const wheel = new THREE.Mesh(wheelGeo, tireMat);
      wheel.position.set(x, y, z);
      wheel.rotation.z = Math.PI / 2;
      this.group.add(wheel);
    }

    const officer = buildCharacter({
      shirt: 0x18284a,
      pants: 0x111820,
      cap: 0x111820,
      skin: 0xd2a070,
    }).group;
    officer.scale.setScalar(0.7);
    officer.position.set(-0.35, 0.55, -0.15);
    officer.rotation.y = 0.05;
    this.group.add(officer);
    this.hitObjects.push(officer);

    const pistol = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.35), blackMat);
    pistol.position.set(-CAR_WIDTH / 2 - 0.16, 1.18, -0.58);
    pistol.rotation.y = 0.08;
    this.group.add(pistol);

    this.muzzle.position.set(-CAR_WIDTH / 2 - 0.2, 1.18, -0.82);
    this.group.add(this.muzzle);
  }

  private tryShoot(
    playerPos: THREE.Vector3,
    wantedLevel: number,
    onShot: (event: PoliceShotEvent) => void
  ) {
    const origin = this.getMuzzleWorldPosition(new THREE.Vector3());
    const target = playerPos.clone().add(new THREE.Vector3(0, 0.45, 0));
    const distance = origin.distanceTo(target);
    if (distance > SHOOT_RANGE) return;

    const now = performance.now();
    const cooldown = Math.max(520, 1450 - wantedLevel * 150);
    if (now - this.lastShotAt < cooldown) return;
    this.lastShotAt = now + Math.random() * 160;

    const miss = new THREE.Vector3(
      (Math.random() - 0.5) * Math.max(0.35, distance * 0.035),
      (Math.random() - 0.5) * 0.55,
      (Math.random() - 0.5) * Math.max(0.35, distance * 0.035)
    );
    const accuracy = Math.min(0.82, 0.32 + wantedLevel * 0.09 + Math.max(0, 18 - distance) * 0.015);
    const hitPlayer = Math.random() < accuracy;
    const end = hitPlayer ? target : target.clone().add(miss);

    onShot({
      origin,
      end,
      hitPlayer,
      damage: BULLET_DAMAGE,
    });
  }

  private moveAvoidingBuildings(dir: THREE.Vector3, distance: number, obstacles: BuildingBounds[]) {
    const current = this.group.position;
    const resolved = this.resolveOutsideBuildings(current, obstacles);
    if (resolved) current.copy(resolved);

    const desired = current.clone().addScaledVector(dir, distance);
    if (this.isDriveable(desired, obstacles)) {
      current.copy(desired);
      return;
    }

    const blocker = this.findBlockingObstacle(desired, obstacles);
    if (blocker) {
      const tangentSign = Math.abs(current.z - blocker.z) < 0.2
        ? 1
        : Math.sign(current.z - blocker.z);
      const tangent = new THREE.Vector3(0, 0, tangentSign || 1);
      const tangentStep = current.clone().addScaledVector(tangent, distance);
      if (this.isDriveable(tangentStep, obstacles)) {
        current.copy(tangentStep);
        return;
      }

      const oppositeStep = current.clone().addScaledVector(tangent, -distance);
      if (this.isDriveable(oppositeStep, obstacles)) {
        current.copy(oppositeStep);
        return;
      }
    }

    const xOnly = current.clone();
    xOnly.x += dir.x * distance;
    if (this.isDriveable(xOnly, obstacles)) {
      current.copy(xOnly);
      return;
    }

    const zOnly = current.clone();
    zOnly.z += dir.z * distance;
    if (this.isDriveable(zOnly, obstacles)) {
      current.copy(zOnly);
      return;
    }

    const side = new THREE.Vector3(-dir.z, 0, dir.x);
    for (const sign of [1, -1]) {
      const sidestep = current.clone().addScaledVector(side, distance * sign);
      if (this.isDriveable(sidestep, obstacles)) {
        current.copy(sidestep);
        return;
      }
    }
  }

  private isDriveable(position: THREE.Vector3, obstacles: BuildingBounds[]): boolean {
    return this.findBlockingObstacle(position, obstacles) === null;
  }

  private findBlockingObstacle(position: THREE.Vector3, obstacles: BuildingBounds[]): BuildingBounds | null {
    for (const obstacle of obstacles) {
      const dx = Math.abs(position.x - obstacle.x);
      const dz = Math.abs(position.z - obstacle.z);
      if (dx < obstacle.hx + CAR_COLLISION_RADIUS + 0.03 && dz < obstacle.hz + CAR_COLLISION_RADIUS + 0.03) {
        return obstacle;
      }
    }
    return null;
  }

  private resolveOutsideBuildings(position: THREE.Vector3, obstacles: BuildingBounds[]): THREE.Vector3 | null {
    const blocker = this.findBlockingObstacle(position, obstacles);
    if (!blocker) return null;

    const minX = blocker.x - blocker.hx - CAR_COLLISION_RADIUS - 0.08;
    const maxX = blocker.x + blocker.hx + CAR_COLLISION_RADIUS + 0.08;
    const minZ = blocker.z - blocker.hz - CAR_COLLISION_RADIUS - 0.08;
    const maxZ = blocker.z + blocker.hz + CAR_COLLISION_RADIUS + 0.08;

    const toLeft = Math.abs(position.x - minX);
    const toRight = Math.abs(maxX - position.x);
    const toBack = Math.abs(position.z - minZ);
    const toFront = Math.abs(maxZ - position.z);
    const min = Math.min(toLeft, toRight, toBack, toFront);
    const resolved = position.clone();

    if (min === toLeft) resolved.x = minX;
    else if (min === toRight) resolved.x = maxX;
    else if (min === toBack) resolved.z = minZ;
    else resolved.z = maxZ;

    return resolved;
  }

  private animateSiren(delta: number) {
    this.sirenPhase += delta * 10;
    if (this.redSiren && this.redSiren.material instanceof THREE.MeshStandardMaterial) {
      this.redSiren.material.emissiveIntensity = Math.sin(this.sirenPhase) > 0 ? 1.8 : 0.25;
    }
    if (this.blueSiren && this.blueSiren.material instanceof THREE.MeshStandardMaterial) {
      this.blueSiren.material.emissiveIntensity = Math.sin(this.sirenPhase + Math.PI) > 0 ? 1.8 : 0.25;
    }
  }

  private lerpAngle(current: number, target: number, alpha: number): number {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * alpha;
  }

  private createPoliceLabel(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0d1d3a';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', canvas.width / 2, canvas.height / 2 + 2);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }
}
