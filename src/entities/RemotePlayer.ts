import * as THREE from 'three';
import { buildCharacter, colorsForSession } from './CharacterBuilder';
import { AK47Parts, buildAK47 } from './AK47';
import { RocketLauncherParts, buildRocketLauncher } from './RocketLauncher';
import { PistolParts, buildPistol } from './Pistol';
import { FLAG_MOVING, FLAG_SPRINTING, RemotePlayerSnapshot, WEAPON_AK47, WEAPON_PISTOL, WEAPON_ROCKET_LAUNCHER, WeaponId } from '../network/types';
import { PlayerLabel } from '../utils/PlayerLabel';
import { shortAddress } from '../web3/WalletManager';

const PLAYER_HEIGHT = 1.8;
const POSITION_LERP = 14;     // mesh position smoothing (rad/s)
const ROTATION_LERP = 14;     // yaw smoothing
const INTERP_DELAY_MS = 100;  // render N ms in the past for smooth interpolation

interface Snapshot {
  x: number; y: number; z: number; yaw: number;
  moving: boolean; sprinting: boolean;
  receivedAt: number; // local time when received (ms)
}

export class RemotePlayer {
  readonly sessionId: string;
  mesh: THREE.Group;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private leftLeg: THREE.Group;
  private rightLeg: THREE.Group;
  private pistol: PistolParts;
  private ak47: AK47Parts;
  private rocketLauncher: RocketLauncherParts;
  private activeWeapon: WeaponId = WEAPON_PISTOL;
  private muzzleFlashUntil = 0;
  private label: PlayerLabel;
  private currentWallet = '';
  health = 100;
  dead = false;

  private buffer: Snapshot[] = [];
  private walkCycle = 0;
  private renderedYaw = 0;

  constructor(sessionId: string, scene: THREE.Scene) {
    this.sessionId = sessionId;
    const parts = buildCharacter(colorsForSession(sessionId));
    this.mesh = parts.group;
    this.leftArm = parts.leftArm;
    this.rightArm = parts.rightArm;
    this.leftLeg = parts.leftLeg;
    this.rightLeg = parts.rightLeg;

    this.pistol = buildPistol();
    this.pistol.group.position.set(0.04, -0.66, -0.10);
    this.pistol.group.rotation.set(0.05, 0, 0);
    this.rightArm.add(this.pistol.group);

    this.ak47 = buildAK47();
    this.ak47.group.position.set(0.04, -0.66, -0.18);
    this.ak47.group.rotation.set(0.1, 0, 0);
    this.ak47.group.visible = false;
    this.rightArm.add(this.ak47.group);

    this.rocketLauncher = buildRocketLauncher();
    this.rocketLauncher.group.position.set(0.05, -0.14, -0.08);
    this.rocketLauncher.group.rotation.set(0.04, 0, 0);
    this.rocketLauncher.group.visible = false;
    this.rightArm.add(this.rocketLauncher.group);

    // Floating address label above head — set later via applySnapshot.
    this.label = new PlayerLabel();
    this.label.setText(shortAddress(sessionId)); // fallback until wallet arrives
    this.mesh.add(this.label.sprite);

    scene.add(this.mesh);
  }

  showMuzzleFlash() {
    const weapon = this.getActiveWeaponParts();
    const isRocket = this.activeWeapon === WEAPON_ROCKET_LAUNCHER;
    weapon.muzzleFlash.visible = true;
    weapon.muzzleFlash.scale.setScalar(isRocket ? 1.15 + Math.random() * 0.25 : 0.8 + Math.random() * 0.4);
    this.muzzleFlashUntil = performance.now() + (isRocket ? 95 : 50);
  }

  getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.getActiveWeaponParts().muzzle.getWorldPosition(out);
  }

  setWeapon(weapon: WeaponId) {
    this.activeWeapon =
      weapon === WEAPON_ROCKET_LAUNCHER ? WEAPON_ROCKET_LAUNCHER :
      weapon === WEAPON_AK47 ? WEAPON_AK47 :
      WEAPON_PISTOL;
    this.pistol.group.visible = this.activeWeapon === WEAPON_PISTOL;
    this.ak47.group.visible = this.activeWeapon === WEAPON_AK47;
    this.rocketLauncher.group.visible = this.activeWeapon === WEAPON_ROCKET_LAUNCHER;
  }

  applyHealth(newHealth: number, newDead: boolean) {
    this.health = newHealth;
    this.dead = newDead;
    this.mesh.visible = !newDead;
  }

  applySnapshot(snap: RemotePlayerSnapshot) {
    this.setWeapon(snap.weapon);
    if (snap.wallet && snap.wallet !== this.currentWallet) {
      this.currentWallet = snap.wallet;
      this.label.setText(shortAddress(snap.wallet));
    }
    this.buffer.push({
      x: snap.x, y: snap.y, z: snap.z, yaw: snap.yaw,
      moving: (snap.flags & FLAG_MOVING) !== 0,
      sprinting: (snap.flags & FLAG_SPRINTING) !== 0,
      receivedAt: performance.now(),
    });
    // Keep buffer small
    if (this.buffer.length > 12) this.buffer.shift();
  }

  update(delta: number) {
    if (this.buffer.length === 0) return;

    const renderTime = performance.now() - INTERP_DELAY_MS;

    // Find the two snapshots straddling renderTime
    let prev = this.buffer[0];
    let next = this.buffer[this.buffer.length - 1];
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].receivedAt <= renderTime && this.buffer[i + 1].receivedAt >= renderTime) {
        prev = this.buffer[i];
        next = this.buffer[i + 1];
        break;
      }
    }

    let targetX: number, targetY: number, targetZ: number, targetYaw: number;
    if (prev === next) {
      targetX = next.x; targetY = next.y; targetZ = next.z; targetYaw = next.yaw;
    } else {
      const span = next.receivedAt - prev.receivedAt;
      const alpha = span > 0 ? Math.max(0, Math.min(1, (renderTime - prev.receivedAt) / span)) : 1;
      targetX = prev.x + (next.x - prev.x) * alpha;
      targetY = prev.y + (next.y - prev.y) * alpha;
      targetZ = prev.z + (next.z - prev.z) * alpha;
      // Shortest-arc yaw
      let yawDiff = next.yaw - prev.yaw;
      while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
      while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
      targetYaw = prev.yaw + yawDiff * alpha;
    }

    // Server position is the capsule center; mesh root sits at the feet
    const targetMeshY = targetY - PLAYER_HEIGHT / 2;

    const posLerp = 1 - Math.exp(-POSITION_LERP * delta);
    this.mesh.position.x += (targetX - this.mesh.position.x) * posLerp;
    this.mesh.position.y += (targetMeshY - this.mesh.position.y) * posLerp;
    this.mesh.position.z += (targetZ - this.mesh.position.z) * posLerp;

    // Yaw smoothing (shortest path)
    let yawDiff = targetYaw - this.renderedYaw;
    while (yawDiff > Math.PI) yawDiff -= Math.PI * 2;
    while (yawDiff < -Math.PI) yawDiff += Math.PI * 2;
    const rotLerp = 1 - Math.exp(-ROTATION_LERP * delta);
    this.renderedYaw += yawDiff * rotLerp;
    this.mesh.rotation.y = this.renderedYaw;

    // Auto-hide muzzle flash
    if (this.muzzleFlashUntil > 0 && performance.now() > this.muzzleFlashUntil) {
      this.getActiveWeaponParts().muzzleFlash.visible = false;
      this.muzzleFlashUntil = 0;
    }

    // Walk animation driven by latest known state
    const latest = this.buffer[this.buffer.length - 1];
    if (latest.moving) {
      const animSpeed = latest.sprinting ? 12 : 8;
      this.walkCycle += delta * animSpeed;
      const swing = Math.sin(this.walkCycle) * 0.5;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;
    } else {
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
      this.leftArm.rotation.x *= 0.85;
      this.rightArm.rotation.x *= 0.85;
    }
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.label.dispose();
    this.mesh.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  private getActiveWeaponParts(): AK47Parts | RocketLauncherParts | PistolParts {
    if (this.activeWeapon === WEAPON_PISTOL) return this.pistol;
    if (this.activeWeapon === WEAPON_ROCKET_LAUNCHER) return this.rocketLauncher;
    return this.ak47;
  }
}
