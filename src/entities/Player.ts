import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { InputManager } from '../core/InputManager';
import { buildCharacter } from './CharacterBuilder';
import { AK47Parts, buildAK47 } from './AK47';
import { RocketLauncherParts, buildRocketLauncher } from './RocketLauncher';
import { PistolParts, buildPistol } from './Pistol';
import { WEAPON_AK47, WEAPON_PISTOL, WEAPON_ROCKET_LAUNCHER, WeaponId } from '../network/types';

const PLAYER_HEIGHT = 1.8;       // 1.80m
const PLAYER_RADIUS = 0.3;       // capsule radius
const MOVE_SPEED = 6;            // 6 m/s walk
const SPRINT_SPEED = 12;         // 12 m/s sprint
const JUMP_FORCE = 5;            // jump impulse
const MOUSE_SENSITIVITY = 0.002;

// Third-person camera settings
const CAM_DISTANCE = 6;          // 6m behind
const CAM_HEIGHT = 3;            // 3m above player
const CAM_SMOOTH = 8;            // lerp speed
const BODY_ROT_SPEED = 12;       // body turn responsiveness (rad/s lerp)

type WeaponMount = {
  position: [number, number, number];
  rotation: [number, number, number];
  scale?: number;
};

const THIRD_PERSON_WEAPON_MOUNTS: Record<WeaponId, WeaponMount> = {
  [WEAPON_PISTOL]: { position: [0.04, -0.66, -0.10], rotation: [0.05, 0, 0] },
  [WEAPON_AK47]: { position: [0.04, -0.66, -0.18], rotation: [0.1, 0, 0] },
  [WEAPON_ROCKET_LAUNCHER]: { position: [0.05, -0.14, -0.08], rotation: [0.04, 0, 0] },
};

const FIRST_PERSON_WEAPON_MOUNTS: Record<WeaponId, WeaponMount> = {
  [WEAPON_PISTOL]: {
    position: [0.22, -0.21, -0.55],
    rotation: [-0.06, -0.46, -0.04],
    scale: 2.3,
  },
  [WEAPON_AK47]: {
    position: [0.26, -0.30, -0.74],
    rotation: [-0.05, -0.23, -0.03],
    scale: 1.25,
  },
  [WEAPON_ROCKET_LAUNCHER]: {
    position: [0.31, -0.33, -0.84],
    rotation: [-0.04, -0.19, -0.02],
    scale: 1.08,
  },
};

export class Player {
  mesh: THREE.Group;
  body: RAPIER.RigidBody;
  private yaw = 0;
  private pitch = 0.3;     // slight downward look
  private isGrounded = false;
  visible = true;          // can hide when in vehicle

  // Animated limbs
  private leftArm!: THREE.Group;
  private rightArm!: THREE.Group;
  private leftLeg!: THREE.Group;
  private rightLeg!: THREE.Group;
  private headGroup!: THREE.Group;
  private walkCycle = 0;

  // Camera mode
  firstPerson = false;

  // Input flags from last frame (for network sync). Public so the audio
  // layer can poll whether to play a footstep this frame.
  lastMoving = false;
  lastSprinting = false;
  lastJumping = false;
  isGroundedNow = false;

  onJump: (() => void) | null = null;
  private spaceWasDown = false;

  // Combat
  health = 100;
  dead = false;
  private firstPersonWeaponRoot = new THREE.Group();
  private pistol: PistolParts;
  private ak47: AK47Parts;
  private rocketLauncher: RocketLauncherParts;
  private activeWeapon: WeaponId = WEAPON_PISTOL;
  private hasAk47 = false;
  private hasRocketLauncher = false;
  private lastFireTime = 0;
  private muzzleFlashUntil = 0;
  // Callback fired when local player decides to shoot. Network layer can hook in.
  onFire: ((weapon: WeaponId, origin: THREE.Vector3, dir: THREE.Vector3, hitTargetId: string | null, hitPoint: THREE.Vector3 | null) => void) | null = null;
  onWeaponChanged: ((weapon: WeaponId) => void) | null = null;
  onWeaponUnlocked: ((weapon: WeaponId) => void) | null = null;

  constructor(
    private scene: THREE.Scene,
    physics: PhysicsWorld,
    private camera: THREE.PerspectiveCamera
  ) {
    const parts = buildCharacter();
    this.mesh = parts.group;
    this.leftArm = parts.leftArm;
    this.rightArm = parts.rightArm;
    this.leftLeg = parts.leftLeg;
    this.rightLeg = parts.rightLeg;
    this.headGroup = parts.headGroup;
    this.scene.add(this.mesh);

    this.firstPersonWeaponRoot.name = 'FirstPersonWeaponRoot';
    this.firstPersonWeaponRoot.visible = false;
    const weaponFillLight = new THREE.PointLight(0xffffff, 1.4, 2.4);
    weaponFillLight.position.set(-0.15, 0.18, 0.12);
    this.firstPersonWeaponRoot.add(weaponFillLight);
    const weaponAmbient = new THREE.HemisphereLight(0xffffff, 0x303036, 0.55);
    this.firstPersonWeaponRoot.add(weaponAmbient);
    this.scene.add(this.firstPersonWeaponRoot);

    // Pistol — default starter weapon (always owned).
    this.pistol = buildPistol();

    // AK47 — locked until purchased.
    this.ak47 = buildAK47();

    // Rocket launcher — locked until purchased / picked up.
    this.rocketLauncher = buildRocketLauncher();
    this.syncWeaponVisuals();

    // --- Physics body: capsule ---
    const capsuleHalfHeight = (PLAYER_HEIGHT - 2 * PLAYER_RADIUS) / 2;
    this.body = physics.createDynamicCapsule(
      0, PLAYER_HEIGHT / 2 + 0.5, 0,
      capsuleHalfHeight,
      PLAYER_RADIUS
    );
  }


  // Raycast helper for hit detection. Provided externally so Player doesn't need
  // direct knowledge of remote players. Returns { sessionId, point } or null.
  raycastTargets:
    | ((origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number) => { sessionId: string; point: THREE.Vector3 } | null)
    | null = null;

  update(delta: number, input: InputManager, physics: PhysicsWorld) {
    if (!this.visible) return;

    // --- Combat: fire ---
    if (!this.dead && input.isMouseDown(0)) {
      this.tryFire(physics);
    }
    // Auto-hide muzzle flash after its lifetime
    if (this.muzzleFlashUntil > 0 && performance.now() > this.muzzleFlashUntil) {
      this.getActiveWeaponParts().muzzleFlash.visible = false;
      this.muzzleFlashUntil = 0;
    }

    // --- Mouse look ---
    // Convention: positive pitch = looking down. Mouse moves down (movementY > 0)
    // increases pitch, so the view tilts down (standard FPS).
    if (input.isPointerLocked) {
      const mouseDelta = input.consumeMouseDelta();
      this.yaw -= mouseDelta.x * MOUSE_SENSITIVITY;
      this.pitch += mouseDelta.y * MOUSE_SENSITIVITY;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch));
    }

    // --- Ground check ---
    const pos = this.body.translation();
    const groundHit = physics.castRay(
      { x: pos.x, y: pos.y, z: pos.z },
      { x: 0, y: -1, z: 0 },
      PLAYER_HEIGHT / 2 + 0.2
    );
    this.isGrounded = groundHit !== null;
    this.isGroundedNow = this.isGrounded;

    // --- Movement ---
    const speed = input.isKeyDown('ShiftLeft') ? SPRINT_SPEED : MOVE_SPEED;
    let moveX = 0;
    let moveZ = 0;

    if (input.isKeyDown('KeyW')) moveZ -= 1;
    if (input.isKeyDown('KeyS')) moveZ += 1;
    if (input.isKeyDown('KeyA')) moveX -= 1;
    if (input.isKeyDown('KeyD')) moveX += 1;

    // Normalize diagonal movement
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0) {
      moveX /= len;
      moveZ /= len;
    }

    // Rotate input by camera yaw so W is always the camera's forward direction.
    // Camera forward (world) = (-sin yaw, 0, -cos yaw); right = (cos yaw, 0, -sin yaw).
    // worldDir = moveX * right + (-moveZ) * forward
    const sinYaw = Math.sin(this.yaw);
    const cosYaw = Math.cos(this.yaw);
    const worldX = moveX * cosYaw + moveZ * sinYaw;
    const worldZ = -moveX * sinYaw + moveZ * cosYaw;

    // Apply velocity (keep existing Y velocity for gravity)
    const currentVel = this.body.linvel();
    this.body.setLinvel(
      { x: worldX * speed, y: currentVel.y, z: worldZ * speed },
      true
    );

    // Jump (edge-triggered: only on the frame Space goes from up→down)
    const spaceDown = input.isKeyDown('Space');
    let jumped = false;
    if (spaceDown && !this.spaceWasDown && this.isGrounded) {
      this.body.setLinvel(
        { x: currentVel.x, y: JUMP_FORCE, z: currentVel.z },
        true
      );
      jumped = true;
      this.onJump?.();
    }
    this.spaceWasDown = spaceDown;

    // --- Walk animation ---
    const isMoving = len > 0;
    this.lastMoving = isMoving;
    this.lastSprinting = isMoving && input.isKeyDown('ShiftLeft');
    this.lastJumping = jumped;
    if (isMoving) {
      const animSpeed = input.isKeyDown('ShiftLeft') ? 12 : 8;
      this.walkCycle += delta * animSpeed;
      const swing = Math.sin(this.walkCycle) * 0.5;
      this.leftLeg.rotation.x = swing;
      this.rightLeg.rotation.x = -swing;
      this.leftArm.rotation.x = -swing * 0.7;
      this.rightArm.rotation.x = swing * 0.7;
    } else {
      // Idle — smoothly return to rest
      this.leftLeg.rotation.x *= 0.85;
      this.rightLeg.rotation.x *= 0.85;
      this.leftArm.rotation.x *= 0.85;
      this.rightArm.rotation.x *= 0.85;
    }

    // --- Sync mesh to physics ---
    const translation = this.body.translation();
    this.mesh.position.set(translation.x, translation.y - PLAYER_HEIGHT / 2, translation.z);

    // Body rotation
    // - First-person: body always faces camera yaw (FPS feel)
    // - Third-person: body follows movement direction (mesh forward = -Z when rotation.y = 0)
    if (this.firstPerson) {
      this.mesh.rotation.y = this.yaw;
    } else if (isMoving) {
      const targetYaw = Math.atan2(-worldX, -worldZ);
      let diff = targetYaw - this.mesh.rotation.y;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const rotLerp = 1 - Math.exp(-BODY_ROT_SPEED * delta);
      this.mesh.rotation.y += diff * rotLerp;
    }

    // --- Camera ---
    if (this.firstPerson) {
      // Eye position = mesh root + head local Y + small forward offset to clear the skull
      const eyeY = this.mesh.position.y + 1.54;
      const forwardX = -Math.sin(this.yaw) * Math.cos(this.pitch);
      const forwardY = -Math.sin(this.pitch);
      const forwardZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

      this.camera.position.set(translation.x, eyeY, translation.z);
      this.camera.lookAt(
        translation.x + forwardX,
        eyeY + forwardY,
        translation.z + forwardZ
      );
      this.updateFirstPersonWeaponRoot();
    } else {
      // Third-person follow
      const idealOffset = new THREE.Vector3(
        Math.sin(this.yaw) * CAM_DISTANCE,
        CAM_HEIGHT + this.pitch * 3,
        Math.cos(this.yaw) * CAM_DISTANCE
      );

      const idealTarget = new THREE.Vector3(
        translation.x,
        translation.y + 1,
        translation.z
      );

      const idealPosition = idealTarget.clone().add(idealOffset);

      const lerpFactor = 1 - Math.exp(-CAM_SMOOTH * delta);
      this.camera.position.lerp(idealPosition, lerpFactor);
      this.camera.lookAt(idealTarget);
    }
  }

  toggleFirstPerson() {
    this.firstPerson = !this.firstPerson;
    this.syncLocalModelVisibility();
    this.syncWeaponVisuals();
  }

  getPosition(): THREE.Vector3 {
    const t = this.body.translation();
    return new THREE.Vector3(t.x, t.y, t.z);
  }

  setVisible(v: boolean) {
    this.visible = v;
    this.syncLocalModelVisibility();
  }

  teleport(x: number, y: number, z: number) {
    this.body.setTranslation({ x, y, z }, true);
    this.body.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  pickupRocketLauncher(): boolean {
    if (this.hasRocketLauncher) {
      this.setWeapon(WEAPON_ROCKET_LAUNCHER);
      return false;
    }
    this.unlockWeapon(WEAPON_ROCKET_LAUNCHER);
    this.setWeapon(WEAPON_ROCKET_LAUNCHER);
    return true;
  }

  /** Grants ownership of a weapon (from shop purchase or world pickup). */
  unlockWeapon(weapon: WeaponId): boolean {
    let unlocked = false;
    if (weapon === WEAPON_AK47 && !this.hasAk47) {
      this.hasAk47 = true;
      unlocked = true;
    } else if (weapon === WEAPON_ROCKET_LAUNCHER && !this.hasRocketLauncher) {
      this.hasRocketLauncher = true;
      unlocked = true;
    }
    if (unlocked) this.onWeaponUnlocked?.(weapon);
    return unlocked;
  }

  ownsWeapon(weapon: WeaponId): boolean {
    if (weapon === WEAPON_PISTOL) return true;
    if (weapon === WEAPON_AK47) return this.hasAk47;
    if (weapon === WEAPON_ROCKET_LAUNCHER) return this.hasRocketLauncher;
    return false;
  }

  /** Revoke ownership (e.g. NFT transferred or burned). Switches back to pistol if needed. */
  lockWeapon(weapon: WeaponId): boolean {
    let locked = false;
    if (weapon === WEAPON_AK47 && this.hasAk47) {
      this.hasAk47 = false;
      locked = true;
    } else if (weapon === WEAPON_ROCKET_LAUNCHER && this.hasRocketLauncher) {
      this.hasRocketLauncher = false;
      locked = true;
    }
    if (locked) {
      if (this.activeWeapon === weapon) this.setWeapon(WEAPON_PISTOL);
      this.onWeaponUnlocked?.(weapon); // reuse to refresh HUD
    }
    return locked;
  }

  setWeapon(weapon: WeaponId): boolean {
    if (!this.ownsWeapon(weapon)) return false;
    if (this.activeWeapon === weapon) return true;
    this.activeWeapon = weapon;
    this.syncWeaponVisuals();
    this.onWeaponChanged?.(weapon);
    return true;
  }

  getWeapon(): WeaponId {
    return this.activeWeapon;
  }

  getWeaponLabel(): string {
    if (this.activeWeapon === WEAPON_PISTOL) return 'Pistol';
    if (this.activeWeapon === WEAPON_AK47) return 'AK47';
    return 'Rocket Launcher';
  }

  private tryFire(physics: PhysicsWorld) {
    const isRocket = this.activeWeapon === WEAPON_ROCKET_LAUNCHER;
    const isPistol = this.activeWeapon === WEAPON_PISTOL;
    // Per-weapon fire rate. Pistol is intentionally slow (~2.5 shots/sec).
    const FIRE_COOLDOWN =
      isRocket ? 1100 :
      isPistol ? 400 :
      100;
    const MAX_RANGE =
      isRocket ? 85 :
      isPistol ? 70 :
      100;
    const now = performance.now();
    if (now - this.lastFireTime < FIRE_COOLDOWN) return;
    this.lastFireTime = now;

    // Direction = camera forward for both weapons.
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    dir.normalize();

    let origin: THREE.Vector3;
    let hitTargetId: string | null = null;
    let hitPoint: THREE.Vector3 | null = null;

    if (isRocket) {
      const muzzle = this.getMuzzleWorldPosition(new THREE.Vector3());
      origin = muzzle.clone().addScaledVector(dir, 0.35);

      const directHit = this.raycastTargets ? this.raycastTargets(origin, dir, MAX_RANGE) : null;
      let bestDist = MAX_RANGE;
      hitPoint = origin.clone().addScaledVector(dir, MAX_RANGE);

      if (directHit) {
        bestDist = directHit.point.distanceTo(origin);
        hitTargetId = directHit.sessionId;
        hitPoint = directHit.point.clone();
      }

      const worldToi = physics.castRay(
        { x: origin.x, y: origin.y, z: origin.z },
        { x: dir.x, y: dir.y, z: dir.z },
        MAX_RANGE
      );
      if (worldToi !== null && worldToi < bestDist) {
        bestDist = worldToi;
        hitTargetId = null;
        hitPoint = origin.clone().addScaledVector(dir, bestDist);
      }
    } else {
      // AK origin = camera position for precise crosshair hits.
      origin = this.camera.position.clone();
      const hit = this.raycastTargets ? this.raycastTargets(origin, dir, MAX_RANGE) : null;
      hitTargetId = hit?.sessionId ?? null;
      hitPoint = hit?.point ?? null;
    }

    // Show local muzzle flash
    const weaponParts = this.getActiveWeaponParts();
    weaponParts.muzzleFlash.visible = true;
    weaponParts.muzzleFlash.scale.setScalar(isRocket ? 1.15 + Math.random() * 0.25 : 0.8 + Math.random() * 0.4);
    this.muzzleFlashUntil = now + (isRocket ? 95 : 50);

    // Notify network
    if (this.onFire) {
      this.onFire(this.activeWeapon, origin, dir, hitTargetId, hitPoint);
    }
  }

  getMuzzleWorldPosition(out: THREE.Vector3): THREE.Vector3 {
    return this.getActiveWeaponParts().muzzle.getWorldPosition(out);
  }

  private getActiveWeaponParts(): AK47Parts | RocketLauncherParts | PistolParts {
    if (this.activeWeapon === WEAPON_PISTOL) return this.pistol;
    if (this.activeWeapon === WEAPON_ROCKET_LAUNCHER) return this.rocketLauncher;
    return this.ak47;
  }

  applyDamage(newHealth: number, newDead: boolean) {
    this.health = newHealth;
    this.dead = newDead;
    this.syncLocalModelVisibility();
  }

  respawn(x: number, y: number, z: number) {
    this.health = 100;
    this.dead = false;
    this.syncLocalModelVisibility();
    this.teleport(x, y, z);
  }

  getNetworkState() {
    const t = this.body.translation();
    return {
      x: t.x,
      y: t.y,
      z: t.z,
      yaw: this.mesh.rotation.y,
      weapon: this.activeWeapon,
      moving: this.lastMoving,
      sprinting: this.lastSprinting,
      jumping: this.lastJumping,
    };
  }

  private syncLocalModelVisibility() {
    const showFirstPersonWeapon = this.visible && !this.dead && this.firstPerson;
    const showBody = this.visible && !this.dead && !this.firstPerson;

    this.mesh.visible = showBody;
    this.headGroup.visible = showBody;
    this.leftArm.visible = showBody;
    this.rightArm.visible = showBody;
    this.firstPersonWeaponRoot.visible = showFirstPersonWeapon;
  }

  private syncWeaponVisuals() {
    const parent = this.firstPerson ? this.firstPersonWeaponRoot : this.rightArm;
    const mounts = this.firstPerson ? FIRST_PERSON_WEAPON_MOUNTS : THIRD_PERSON_WEAPON_MOUNTS;

    this.applyWeaponMount(this.pistol.group, parent, mounts[WEAPON_PISTOL]);
    this.applyWeaponMount(this.ak47.group, parent, mounts[WEAPON_AK47]);
    this.applyWeaponMount(this.rocketLauncher.group, parent, mounts[WEAPON_ROCKET_LAUNCHER]);

    this.pistol.group.visible = this.activeWeapon === WEAPON_PISTOL;
    this.ak47.group.visible = this.activeWeapon === WEAPON_AK47;
    this.rocketLauncher.group.visible = this.activeWeapon === WEAPON_ROCKET_LAUNCHER;
  }

  private applyWeaponMount(group: THREE.Group, parent: THREE.Group, mount: WeaponMount) {
    parent.add(group);
    group.position.set(...mount.position);
    group.rotation.set(...mount.rotation);
    group.scale.setScalar(mount.scale ?? 1);
  }

  private updateFirstPersonWeaponRoot() {
    if (!this.firstPerson) return;
    this.firstPersonWeaponRoot.position.copy(this.camera.position);
    this.firstPersonWeaponRoot.quaternion.copy(this.camera.quaternion);
  }
}
