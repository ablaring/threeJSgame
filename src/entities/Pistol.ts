import * as THREE from 'three';

// Compact semi-auto pistol — small, low cadence, low damage.
const SLIDE_LEN = 0.18;
const FRAME_LEN = 0.16;

export interface PistolParts {
  group: THREE.Group;
  muzzle: THREE.Object3D;
  muzzleFlash: THREE.Mesh;
}

export function buildPistol(): PistolParts {
  const group = new THREE.Group();

  const slideMat = new THREE.MeshStandardMaterial({
    color: 0x3a3a42,
    emissive: 0x08080a,
    emissiveIntensity: 0.25,
    roughness: 0.3,
    metalness: 0.85,
  });
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x26262e,
    emissive: 0x07070a,
    emissiveIntensity: 0.2,
    roughness: 0.5,
    metalness: 0.45,
  });
  const gripMat = new THREE.MeshStandardMaterial({
    color: 0x24242a,
    emissive: 0x060608,
    emissiveIntensity: 0.18,
    roughness: 0.85,
  });

  // === SLIDE (top, where the action is) ===
  const slide = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.046, SLIDE_LEN), slideMat);
  slide.position.set(0, 0.02, -SLIDE_LEN / 2);
  slide.castShadow = true;
  group.add(slide);

  // === FRAME (below slide) ===
  const frame = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, FRAME_LEN), frameMat);
  frame.position.set(0, -0.022, -FRAME_LEN / 2);
  frame.castShadow = true;
  group.add(frame);

  // === GRIP ===
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.038, 0.10, 0.05), gripMat);
  grip.position.set(0, -0.09, -0.04);
  grip.rotation.x = 0.18;
  grip.castShadow = true;
  group.add(grip);

  // === TRIGGER GUARD ===
  const triggerGuard = new THREE.Mesh(
    new THREE.TorusGeometry(0.018, 0.0035, 6, 14, Math.PI),
    frameMat
  );
  triggerGuard.rotation.x = Math.PI / 2;
  triggerGuard.position.set(0, -0.04, -0.06);
  group.add(triggerGuard);

  // === FRONT SIGHT ===
  const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.01, 0.012), slideMat);
  frontSight.position.set(0, 0.05, -SLIDE_LEN + 0.018);
  group.add(frontSight);

  // === REAR SIGHT ===
  const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.012, 0.014), slideMat);
  rearSight.position.set(0, 0.052, -0.018);
  group.add(rearSight);

  // === MUZZLE MARKER ===
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.02, -SLIDE_LEN - 0.005);
  group.add(muzzle);

  // === MUZZLE FLASH ===
  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xFFCC44, transparent: true, opacity: 0.9 })
  );
  muzzleFlash.scale.set(1, 1, 1.4);
  muzzleFlash.visible = false;
  muzzle.add(muzzleFlash);

  return { group, muzzle, muzzleFlash };
}
