import * as THREE from 'three';

// AK47 dimensions (rough but recognizable)
// Total length ~88cm, mostly along -Z when held
const STOCK_LEN = 0.30;
const RECEIVER_LEN = 0.22;
const BARREL_LEN = 0.36;
const MAG_LEN = 0.18;

export interface AK47Parts {
  group: THREE.Group;
  muzzle: THREE.Object3D; // empty marker at the tip of the barrel
  muzzleFlash: THREE.Mesh; // hidden by default; flashes when firing
}

export function buildAK47(): AK47Parts {
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6B3F1D, roughness: 0.7 });
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.4, metalness: 0.7 });
  const magMat = new THREE.MeshStandardMaterial({ color: 0x2A2A2A, roughness: 0.6, metalness: 0.5 });

  // === STOCK (wooden, behind hand) ===
  const stock = new THREE.Mesh(
    new THREE.BoxGeometry(0.045, 0.07, STOCK_LEN),
    woodMat
  );
  stock.position.set(0, 0, STOCK_LEN / 2);
  stock.castShadow = true;
  group.add(stock);

  // Stock comb taper
  const stockComb = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.025, 0.08),
    woodMat
  );
  stockComb.position.set(0, 0.04, STOCK_LEN - 0.04);
  group.add(stockComb);

  // === RECEIVER (metal body) ===
  const receiver = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.08, RECEIVER_LEN),
    metalMat
  );
  receiver.position.set(0, 0, -RECEIVER_LEN / 2);
  receiver.castShadow = true;
  group.add(receiver);

  // === MAGAZINE (curved AK shape — approximated with box + tilt) ===
  const magazine = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, MAG_LEN, 0.08),
    magMat
  );
  magazine.position.set(0, -0.10, -RECEIVER_LEN / 2 + 0.02);
  magazine.rotation.x = -0.15; // signature AK forward curve
  magazine.castShadow = true;
  group.add(magazine);

  // === HANDGUARD (wooden, around barrel base) ===
  const handguard = new THREE.Mesh(
    new THREE.BoxGeometry(0.05, 0.055, 0.18),
    woodMat
  );
  handguard.position.set(0, -0.005, -RECEIVER_LEN - 0.09);
  handguard.castShadow = true;
  group.add(handguard);

  // === BARREL ===
  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, BARREL_LEN, 8),
    metalMat
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.005, -RECEIVER_LEN - BARREL_LEN / 2);
  barrel.castShadow = true;
  group.add(barrel);

  // === FRONT SIGHT POST ===
  const frontSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.012, 0.04, 0.02),
    metalMat
  );
  frontSight.position.set(0, 0.035, -RECEIVER_LEN - BARREL_LEN + 0.05);
  group.add(frontSight);

  // === REAR SIGHT ===
  const rearSight = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.025, 0.025),
    metalMat
  );
  rearSight.position.set(0, 0.05, -RECEIVER_LEN + 0.02);
  group.add(rearSight);

  // === MUZZLE BRAKE ===
  const muzzleBrake = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.04, 8),
    metalMat
  );
  muzzleBrake.rotation.x = Math.PI / 2;
  muzzleBrake.position.set(0, 0.005, -RECEIVER_LEN - BARREL_LEN - 0.01);
  group.add(muzzleBrake);

  // === PISTOL GRIP ===
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.035, 0.10, 0.045),
    woodMat
  );
  grip.position.set(0, -0.075, -0.01);
  grip.rotation.x = 0.2;
  grip.castShadow = true;
  group.add(grip);

  // === TRIGGER GUARD ===
  const triggerGuard = new THREE.Mesh(
    new THREE.TorusGeometry(0.018, 0.004, 6, 12, Math.PI),
    metalMat
  );
  triggerGuard.rotation.x = Math.PI / 2;
  triggerGuard.position.set(0, -0.04, -0.01);
  group.add(triggerGuard);

  // === MUZZLE MARKER (used for tracer origin and flash) ===
  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.005, -RECEIVER_LEN - BARREL_LEN - 0.04);
  group.add(muzzle);

  // === MUZZLE FLASH (hidden; toggled by Player on fire) ===
  const muzzleFlash = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 6, 6),
    new THREE.MeshBasicMaterial({ color: 0xFFCC44, transparent: true, opacity: 0.9 })
  );
  muzzleFlash.scale.set(1, 1, 1.6);
  muzzleFlash.visible = false;
  muzzle.add(muzzleFlash);

  return { group, muzzle, muzzleFlash };
}
