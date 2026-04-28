import * as THREE from 'three';
import { buildCharacter, CharacterParts } from './CharacterBuilder';
import { PlayerLabel } from '../utils/PlayerLabel';

type Brand = 'binance' | 'ftx';

interface SpawnBotConfig {
  id: string;
  label: string;
  brand: Brand;
  position: THREE.Vector3;
  rotationY: number;
  skin: number;
  hair: number;
  pants: number;
  accent: number;
  phase: number;
}

const BOT_HEIGHT_SCALE = 1.02; // ~1.84m, close to player height

export type SpawnBotArrestState = 'hidden' | 'police-called' | 'in-custody' | 'arrested';

const BOT_CONFIGS: SpawnBotConfig[] = [
  {
    id: 'cz-binance',
    label: 'CZ Binance',
    brand: 'binance',
    position: new THREE.Vector3(-108.7, 0, 82.4), // tucked inside Trump Tower lobby
    rotationY: -Math.PI * 0.35,
    skin: 0xd8ad83,
    hair: 0x101014,
    pants: 0x1b1c22,
    accent: 0xf3ba2f,
    phase: 0.15,
  },
  {
    id: 'sam-ftx',
    label: 'Sam FTX',
    brand: 'ftx',
    position: new THREE.Vector3(101.2, 3.4, 56.6), // second floor of Empire State Building
    rotationY: Math.PI * 0.25,
    skin: 0xe7b692,
    hair: 0x251713,
    pants: 0x20222b,
    accent: 0x25b4ff,
    phase: 1.3,
  },
];

export class SpawnBot {
  readonly id: string;
  readonly group: THREE.Group;
  readonly displayName: string;

  private label: PlayerLabel;
  private leftArm: THREE.Group;
  private rightArm: THREE.Group;
  private headGroup: THREE.Group;
  private idlePhase: number;
  private baseHeadY: number;
  private state: SpawnBotArrestState = 'hidden';

  constructor(config: SpawnBotConfig, scene: THREE.Scene) {
    this.id = config.id;
    this.displayName = config.label;
    this.idlePhase = config.phase;

    const parts = buildCharacter({
      skin: config.skin,
      shirt: 0x07080d,
      pants: config.pants,
      shoes: 0x080808,
      hair: config.hair,
      cap: 0x07080d,
    }, { showCap: false });

    this.group = parts.group;
    this.group.name = `spawn-bot-${config.id}`;
    this.group.position.copy(config.position);
    this.group.rotation.y = config.rotationY;
    this.group.scale.setScalar(BOT_HEIGHT_SCALE);

    this.leftArm = parts.leftArm;
    this.rightArm = parts.rightArm;
    this.headGroup = parts.headGroup;
    this.baseHeadY = parts.headGroup.position.y;

    this.applyIdlePose();
    this.addHoodieDetails(config);
    this.addBrandChest(config);
    this.addFaceDetails(config, parts);

    this.label = new PlayerLabel();
    this.label.setText(config.label);
    this.label.sprite.position.y = 2.0;
    this.label.sprite.scale.set(1.35, 0.25, 1);
    this.group.add(this.label.sprite);

    scene.add(this.group);
  }

  update(delta: number) {
    if (this.state === 'in-custody') return;
    this.idlePhase += delta;
    const breathe = Math.sin(this.idlePhase * 1.8) * 0.025;
    const glance = Math.sin(this.idlePhase * 0.7) * 0.08;
    this.headGroup.position.y = this.baseHeadY + breathe;
    this.headGroup.rotation.y = glance;
    this.leftArm.rotation.z = -0.08 + Math.sin(this.idlePhase * 1.2) * 0.025;
    this.rightArm.rotation.z = 0.08 - Math.sin(this.idlePhase * 1.2) * 0.025;
  }

  getState(): SpawnBotArrestState {
    return this.state;
  }

  isCallable(): boolean {
    return this.state === 'hidden';
  }

  getWorldPosition(out = new THREE.Vector3()): THREE.Vector3 {
    return this.group.getWorldPosition(out);
  }

  markPoliceCalled() {
    this.state = 'police-called';
    this.group.visible = true;
    this.label.setText(`${this.displayName} - police`);
  }

  placeAt(position: THREE.Vector3, yaw: number) {
    this.group.visible = true;
    this.group.position.copy(position);
    this.group.rotation.y = yaw;
    this.group.scale.setScalar(BOT_HEIGHT_SCALE);
  }

  loadIntoPoliceCar() {
    this.state = 'in-custody';
    this.group.visible = false;
  }

  placeInCell(position: THREE.Vector3, yaw: number) {
    this.state = 'arrested';
    this.group.visible = true;
    this.group.position.copy(position);
    this.group.rotation.y = yaw;
    this.group.scale.setScalar(BOT_HEIGHT_SCALE);
    this.label.setText(`${this.displayName} - prison`);
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
    this.label.dispose();
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
  }

  private applyIdlePose() {
    this.leftArm.rotation.z = -0.08;
    this.rightArm.rotation.z = 0.08;
    this.leftArm.rotation.x = -0.05;
    this.rightArm.rotation.x = -0.05;
  }

  private addHoodieDetails(config: SpawnBotConfig) {
    const clothMat = new THREE.MeshStandardMaterial({ color: 0x05060a, roughness: 0.82 });
    const cordMat = new THREE.MeshStandardMaterial({ color: config.accent, roughness: 0.5 });

    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.026, 8, 18), clothMat);
    collar.name = `${config.id}-hoodie-collar`;
    collar.position.set(0, 1.35, -0.015);
    collar.rotation.x = Math.PI / 2;
    collar.scale.set(1.15, 0.6, 1);
    this.group.add(collar);

    const hood = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.23, 0.12), clothMat);
    hood.name = `${config.id}-hood`;
    hood.position.set(0, 1.34, 0.09);
    hood.rotation.x = -0.15;
    this.group.add(hood);

    const cordGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.17, 6);
    for (const x of [-0.045, 0.045]) {
      const cord = new THREE.Mesh(cordGeo, cordMat);
      cord.name = `${config.id}-hoodie-cord`;
      cord.position.set(x, 1.23, -0.125);
      cord.rotation.z = x < 0 ? 0.08 : -0.08;
      this.group.add(cord);
    }
  }

  private addBrandChest(config: SpawnBotConfig) {
    const texture = this.createBrandTexture(config.brand);
    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.22), material);
    patch.name = `${config.id}-chest-brand`;
    patch.position.set(0, 1.03, -0.116);
    patch.rotation.y = Math.PI;
    patch.renderOrder = 4;
    this.group.add(patch);
  }

  private addFaceDetails(config: SpawnBotConfig, parts: CharacterParts) {
    if (config.brand === 'binance') {
      this.addGlasses(parts.headGroup);
      this.addShortHairTexture(parts.headGroup, config.hair);
      return;
    }

    this.addCurlyHair(parts.headGroup, config.hair);
  }

  private addGlasses(headGroup: THREE.Group) {
    const frameMat = new THREE.MeshStandardMaterial({
      color: 0xbfc8d6,
      roughness: 0.28,
      metalness: 0.65,
    });
    const lensGeo = new THREE.TorusGeometry(0.038, 0.004, 8, 18);
    for (const x of [-0.064, 0.064]) {
      const lens = new THREE.Mesh(lensGeo, frameMat);
      lens.name = 'cz-glasses-lens';
      lens.position.set(x, 0.018, -0.174);
      headGroup.add(lens);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.058, 0.006, 0.006), frameMat);
    bridge.name = 'cz-glasses-bridge';
    bridge.position.set(0, 0.018, -0.174);
    headGroup.add(bridge);

    for (const side of [-1, 1]) {
      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.006, 0.006), frameMat);
      temple.name = 'cz-glasses-temple';
      temple.position.set(side * 0.13, 0.018, -0.125);
      temple.rotation.y = side * 0.7;
      headGroup.add(temple);
    }
  }

  private addShortHairTexture(headGroup: THREE.Group, color: number) {
    const hairMat = new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const tuftGeo = new THREE.BoxGeometry(0.055, 0.035, 0.055);
    const offsets = [
      [-0.09, 0.17, -0.05],
      [-0.03, 0.18, -0.07],
      [0.04, 0.18, -0.055],
      [0.1, 0.16, -0.035],
    ];

    for (const [x, y, z] of offsets) {
      const tuft = new THREE.Mesh(tuftGeo, hairMat);
      tuft.name = 'cz-short-hair-tuft';
      tuft.position.set(x, y, z);
      tuft.rotation.set(0.1, x * 1.5, z * -2);
      headGroup.add(tuft);
    }
  }

  private addCurlyHair(headGroup: THREE.Group, color: number) {
    const curlMat = new THREE.MeshStandardMaterial({ color, roughness: 0.95 });
    const curlGeo = new THREE.SphereGeometry(0.052, 8, 6);
    const curls = [
      [-0.13, 0.12, -0.03, 1.1],
      [-0.08, 0.18, -0.09, 1.25],
      [-0.02, 0.2, -0.105, 1.1],
      [0.05, 0.19, -0.09, 1.3],
      [0.12, 0.13, -0.045, 1.15],
      [-0.16, 0.05, -0.015, 1.05],
      [0.16, 0.05, -0.02, 1.0],
      [-0.12, 0.17, 0.025, 1.25],
      [-0.04, 0.22, 0.025, 1.35],
      [0.06, 0.21, 0.02, 1.28],
      [0.13, 0.15, 0.02, 1.12],
      [-0.04, 0.12, -0.14, 0.85],
      [0.04, 0.12, -0.135, 0.9],
    ];

    for (const [x, y, z, scale] of curls) {
      const curl = new THREE.Mesh(curlGeo, curlMat);
      curl.name = 'sbf-curly-hair';
      curl.position.set(x, y, z);
      curl.scale.setScalar(scale);
      headGroup.add(curl);
    }
  }

  private createBrandTexture(brand: Brand): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (brand === 'binance') {
      this.drawBinanceMark(ctx);
      ctx.fillStyle = '#f3ba2f';
      ctx.font = '700 58px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('BINANCE', 156, 132);
    } else {
      this.drawFtxMark(ctx);
      ctx.fillStyle = '#26b8ff';
      ctx.font = '800 82px Arial, Helvetica, sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText('FTX', 184, 132);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  private drawBinanceMark(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(90, 130);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#f3ba2f';
    const size = 28;
    const gap = 38;
    ctx.fillRect(-size / 2, -size / 2, size, size);
    ctx.fillRect(-gap - size / 2, -size / 2, size, size);
    ctx.fillRect(gap - size / 2, -size / 2, size, size);
    ctx.fillRect(-size / 2, -gap - size / 2, size, size);
    ctx.fillRect(-size / 2, gap - size / 2, size, size);
    ctx.restore();
  }

  private drawFtxMark(ctx: CanvasRenderingContext2D) {
    const colors = ['#13d3ff', '#20a7f2', '#1f7bd8', '#44d7ff'];
    const boxes = [
      [86, 78, 64, 28, colors[0]],
      [86, 114, 96, 28, colors[1]],
      [86, 150, 48, 28, colors[2]],
      [146, 78, 40, 28, colors[3]],
      [142, 150, 40, 28, colors[1]],
    ];

    for (const [x, y, w, h, color] of boxes) {
      ctx.fillStyle = String(color);
      ctx.fillRect(Number(x), Number(y), Number(w), Number(h));
    }
  }
}

export class SpawnBotManager {
  readonly bots: SpawnBot[];

  constructor(scene: THREE.Scene) {
    this.bots = BOT_CONFIGS.map((config) => new SpawnBot(config, scene));
  }

  update(delta: number) {
    for (const bot of this.bots) bot.update(delta);
  }

  getBots(): SpawnBot[] {
    return this.bots;
  }

  dispose(scene: THREE.Scene) {
    for (const bot of this.bots) bot.dispose(scene);
  }
}
