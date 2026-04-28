import * as THREE from 'three';

export interface CharacterParts {
  group: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  headGroup: THREE.Group;
}

export interface CharacterColors {
  skin?: number;
  shirt?: number;
  pants?: number;
  shoes?: number;
  hair?: number;
  cap?: number;
}

export interface CharacterOptions {
  showCap?: boolean;
}

const DEFAULTS: Required<CharacterColors> = {
  skin: 0xE8B88A,
  shirt: 0x2255CC,
  pants: 0x333344,
  shoes: 0x222222,
  hair: 0x3B2314,
  cap: 0xCC2222,
};

export function buildCharacter(colors: CharacterColors = {}, options: CharacterOptions = {}): CharacterParts {
  const c = { ...DEFAULTS, ...colors };
  const showCap = options.showCap ?? true;
  const group = new THREE.Group();

  // === MATERIALS ===
  const skinMat = new THREE.MeshStandardMaterial({ color: c.skin, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: c.shirt, roughness: 0.6 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: c.pants, roughness: 0.7 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: c.shoes, roughness: 0.8 });
  const hairMat = new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.9 });
  const capMat = new THREE.MeshStandardMaterial({ color: c.cap, roughness: 0.5 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x2266AA });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  const lipMat = new THREE.MeshStandardMaterial({ color: 0xCC7766, roughness: 0.6 });
  const noseMat = new THREE.MeshStandardMaterial({ color: 0xD9A679, roughness: 0.7 });
  const browMat = new THREE.MeshStandardMaterial({ color: c.hair, roughness: 0.9 });

  // === TORSO ===
  const torsoH = 0.55, torsoW = 0.40, torsoD = 0.22;
  const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), shirtMat);
  torso.position.y = 1.05;
  torso.castShadow = true;
  group.add(torso);

  // === HIPS ===
  const hips = new THREE.Mesh(new THREE.BoxGeometry(torsoW + 0.04, 0.1, torsoD + 0.01), pantsMat);
  hips.position.y = 0.78;
  hips.castShadow = true;
  group.add(hips);

  // === LEGS ===
  const legW = 0.15, legH = 0.45, legD = 0.17, footH = 0.08, legOffsetX = 0.11;

  const buildLeg = (sideX: number): THREE.Group => {
    const leg = new THREE.Group();
    leg.position.set(sideX, 0.73, 0);

    const thigh = new THREE.Mesh(new THREE.BoxGeometry(legW, legH, legD), pantsMat);
    thigh.position.y = -legH / 2;
    thigh.castShadow = true;
    leg.add(thigh);

    const shin = new THREE.Mesh(new THREE.BoxGeometry(legW - 0.02, legH - 0.05, legD - 0.02), pantsMat);
    shin.position.y = -legH - (legH - 0.05) / 2 + 0.02;
    shin.castShadow = true;
    leg.add(shin);

    const shoe = new THREE.Mesh(new THREE.BoxGeometry(legW + 0.02, footH, legD + 0.06), shoeMat);
    shoe.position.set(0, -legH * 2 + 0.07, 0.02);
    shoe.castShadow = true;
    leg.add(shoe);

    return leg;
  };

  const leftLeg = buildLeg(-legOffsetX);
  const rightLeg = buildLeg(legOffsetX);
  group.add(leftLeg);
  group.add(rightLeg);

  // === ARMS ===
  const armW = 0.12, armH = 0.35, armD = 0.12, forearmH = 0.30;

  const buildArm = (sideX: number): THREE.Group => {
    const arm = new THREE.Group();
    arm.position.set(sideX, 1.28, 0);

    const upper = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, armD), shirtMat);
    upper.position.y = -armH / 2;
    upper.castShadow = true;
    arm.add(upper);

    const fore = new THREE.Mesh(new THREE.BoxGeometry(armW - 0.02, forearmH, armD - 0.02), skinMat);
    fore.position.y = -armH - forearmH / 2 + 0.02;
    fore.castShadow = true;
    arm.add(fore);

    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skinMat);
    hand.position.y = -armH - forearmH + 0.01;
    arm.add(hand);

    return arm;
  };

  const leftArm = buildArm(-(torsoW / 2 + armW / 2));
  const rightArm = buildArm(torsoW / 2 + armW / 2);
  group.add(leftArm);
  group.add(rightArm);

  // === NECK ===
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.08, 8), skinMat);
  neck.position.y = 1.36;
  group.add(neck);

  // === HEAD ===
  const headGroup = new THREE.Group();
  headGroup.position.y = 1.52;

  const headGeo = new THREE.SphereGeometry(0.16, 12, 10);
  headGeo.scale(1, 1.15, 0.95);
  const head = new THREE.Mesh(headGeo, skinMat);
  head.castShadow = true;
  headGroup.add(head);

  // Eyes / brows
  const eyeSpacing = 0.065, eyeY = 0.02, eyeZ = -0.13;
  for (const side of [-1, 1]) {
    const eyeWhite = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), eyeWhiteMat);
    eyeWhite.position.set(side * eyeSpacing, eyeY, eyeZ);
    eyeWhite.scale.set(1.3, 1, 0.6);
    headGroup.add(eyeWhite);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), irisMat);
    iris.position.set(side * eyeSpacing, eyeY, eyeZ - 0.02);
    headGroup.add(iris);

    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.009, 6, 6), pupilMat);
    pupil.position.set(side * eyeSpacing, eyeY, eyeZ - 0.028);
    headGroup.add(pupil);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.015), browMat);
    brow.position.set(side * eyeSpacing, eyeY + 0.045, eyeZ - 0.005);
    brow.rotation.z = side * -0.15;
    headGroup.add(brow);
  }

  // Nose
  const noseGroup = new THREE.Group();
  noseGroup.position.set(0, -0.02, -0.15);
  const noseBridge = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.05, 0.03), noseMat);
  noseBridge.position.y = 0.01;
  noseGroup.add(noseBridge);
  const noseTip = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), noseMat);
  noseTip.position.set(0, -0.015, -0.008);
  noseGroup.add(noseTip);
  for (const side of [-1, 1]) {
    const nostril = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), noseMat);
    nostril.position.set(side * 0.018, -0.02, -0.002);
    noseGroup.add(nostril);
  }
  headGroup.add(noseGroup);

  // Mouth
  const upperLip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, 0.02), lipMat);
  upperLip.position.set(0, -0.06, -0.135);
  headGroup.add(upperLip);
  const lowerLip = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.015, 0.018), lipMat);
  lowerLip.position.set(0, -0.075, -0.133);
  headGroup.add(lowerLip);

  // Ears
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), skinMat);
    ear.scale.set(0.4, 1, 0.7);
    ear.position.set(side * 0.155, 0.0, -0.02);
    headGroup.add(ear);
  }

  // Hair
  const hairTop = new THREE.Mesh(
    new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hairTop.position.set(0, 0.03, 0.01);
  hairTop.castShadow = true;
  headGroup.add(hairTop);

  const hairSide = new THREE.Mesh(new THREE.SphereGeometry(0.165, 12, 8), hairMat);
  hairSide.scale.set(1.02, 0.4, 1.02);
  hairSide.position.set(0, 0.1, 0.01);
  headGroup.add(hairSide);

  const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.12, 0.08), hairMat);
  hairBack.position.set(0, 0.04, 0.12);
  headGroup.add(hairBack);

  if (showCap) {
    const capGroup = new THREE.Group();
    capGroup.position.set(0, 0.12, 0);

    const capDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.175, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.45),
      capMat
    );
    capDome.castShadow = true;
    capGroup.add(capDome);

    const capBand = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.178, 0.03, 16), capMat);
    capBand.position.y = -0.01;
    capGroup.add(capBand);

    const visorShape = new THREE.Shape();
    visorShape.moveTo(-0.12, 0);
    visorShape.quadraticCurveTo(-0.12, -0.1, 0, -0.12);
    visorShape.quadraticCurveTo(0.12, -0.1, 0.12, 0);
    visorShape.lineTo(-0.12, 0);

    const visorGeo = new THREE.ExtrudeGeometry(visorShape, { depth: 0.015, bevelEnabled: false });
    const visor = new THREE.Mesh(visorGeo, capMat);
    visor.rotation.x = -Math.PI / 2 + 0.2;
    visor.position.set(0, -0.02, -0.15);
    visor.castShadow = true;
    capGroup.add(visor);

    const capButton = new THREE.Mesh(
      new THREE.SphereGeometry(0.02, 8, 6),
      new THREE.MeshStandardMaterial({ color: 0xEEEEEE })
    );
    capButton.position.y = 0.14;
    capGroup.add(capButton);

    headGroup.add(capGroup);
  }
  group.add(headGroup);

  return { group, leftArm, rightArm, leftLeg, rightLeg, headGroup };
}

// Deterministic color palette so each remote player gets a stable look
const REMOTE_PALETTE: CharacterColors[] = [
  { shirt: 0xCC2222, cap: 0x222266 },
  { shirt: 0x22AA44, cap: 0xEEAA22 },
  { shirt: 0xEEAA22, cap: 0x22AA44 },
  { shirt: 0x9933CC, cap: 0xFFFFFF },
  { shirt: 0x111111, cap: 0xCC2222 },
  { shirt: 0xFF6688, cap: 0x222222 },
];

export function colorsForSession(sessionId: string): CharacterColors {
  let hash = 0;
  for (let i = 0; i < sessionId.length; i++) hash = (hash * 31 + sessionId.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % REMOTE_PALETTE.length;
  return REMOTE_PALETTE[idx];
}
