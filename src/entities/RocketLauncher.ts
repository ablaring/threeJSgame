import * as THREE from 'three';

// Rocket launcher dimensions in meters. It points along -Z when held.
const TUBE_LENGTH = 0.95;       // 95cm
const TUBE_RADIUS = 0.065;      // 13cm diameter
const SIGHT_HEIGHT = 0.12;      // 12cm
const GRIP_HEIGHT = 0.16;       // 16cm

export interface RocketLauncherParts {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
}

export function buildRocketLauncher(): RocketLauncherParts {
  const group = new THREE.Group();

  const tubeMat = new THREE.MeshStandardMaterial({
    color: 0x566b52,
    emissive: 0x101a10,
    emissiveIntensity: 0.18,
    roughness: 0.55,
    metalness: 0.35,
  });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0x141817, roughness: 0.4, metalness: 0.75 });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.65, metalness: 0.2 });
  const rocketMat = new THREE.MeshStandardMaterial({ color: 0x6f7f70, roughness: 0.45, metalness: 0.25 });
  const warheadMat = new THREE.MeshStandardMaterial({ color: 0xb63b2e, roughness: 0.45, metalness: 0.15 });

  // Main launch tube.
  const tube = new THREE.Mesh(
    new THREE.CylinderGeometry(TUBE_RADIUS, TUBE_RADIUS, TUBE_LENGTH, 18),
    tubeMat
  );
  tube.rotation.x = Math.PI / 2;
  tube.position.set(0, 0, -TUBE_LENGTH / 2 + 0.08);
  tube.castShadow = true;
  group.add(tube);

  // Front and rear reinforced rims.
  for (const z of [-TUBE_LENGTH + 0.08, 0.08]) {
    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(TUBE_RADIUS * 1.18, TUBE_RADIUS * 1.18, 0.055, 18),
      rimMat
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, 0, z);
    rim.castShadow = true;
    group.add(rim);
  }

  // Small visible rocket nose tucked into the front opening.
  const rocketBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.033, 0.033, 0.22, 12),
    rocketMat
  );
  rocketBody.rotation.x = Math.PI / 2;
  rocketBody.position.set(0, 0, -TUBE_LENGTH + 0.19);
  rocketBody.castShadow = true;
  group.add(rocketBody);

  const warhead = new THREE.Mesh(
    new THREE.ConeGeometry(0.045, 0.12, 12),
    warheadMat
  );
  warhead.rotation.x = -Math.PI / 2;
  warhead.position.set(0, 0, -TUBE_LENGTH + 0.04);
  warhead.castShadow = true;
  group.add(warhead);

  // Top sight rail.
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.025, 0.42),
    rimMat
  );
  rail.position.set(0, TUBE_RADIUS + 0.025, -0.36);
  rail.castShadow = true;
  group.add(rail);

  const rearSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, SIGHT_HEIGHT, 0.04),
    rimMat
  );
  rearSight.position.set(0, TUBE_RADIUS + SIGHT_HEIGHT / 2, -0.12);
  rearSight.castShadow = true;
  group.add(rearSight);

  const frontSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, SIGHT_HEIGHT * 0.8, 0.035),
    rimMat
  );
  frontSight.position.set(0, TUBE_RADIUS + SIGHT_HEIGHT * 0.4, -0.72);
  frontSight.castShadow = true;
  group.add(frontSight);

  // Shoulder pad at the rear.
  const shoulderPad = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.16, 0.055),
    gripMat
  );
  shoulderPad.position.set(0, 0, 0.125);
  shoulderPad.castShadow = true;
  group.add(shoulderPad);

  // Underside trigger grip.
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.055, GRIP_HEIGHT, 0.08),
    gripMat
  );
  grip.position.set(0, -TUBE_RADIUS - GRIP_HEIGHT / 2 + 0.015, -0.24);
  grip.rotation.x = 0.12;
  grip.castShadow = true;
  group.add(grip);

  const trigger = new THREE.Mesh(
    new THREE.TorusGeometry(0.025, 0.004, 6, 12, Math.PI),
    rimMat
  );
  trigger.rotation.x = Math.PI / 2;
  trigger.position.set(0, -TUBE_RADIUS - 0.035, -0.16);
  group.add(trigger);

  // Muzzle marker at the front of the tube.
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, -TUBE_LENGTH - 0.04);
  group.add(muzzle);

  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff8a22, transparent: true, opacity: 0.9 })
  );
  muzzleFlash.scale.set(1, 1, 1.8);
  muzzleFlash.visible = false;
  muzzle.add(muzzleFlash);

  return { group, muzzle, muzzleFlash };
}
