import * as THREE from 'three';

/**
 * Floating address label above a player's head. Uses a Sprite (always faces
 * the camera) with a CanvasTexture so we can re-render text on demand.
 */
export class PlayerLabel {
  sprite: THREE.Sprite;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private texture: THREE.CanvasTexture;
  private currentText = '';

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 512;
    this.canvas.height = 96;
    this.ctx = this.canvas.getContext('2d')!;

    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.minFilter = THREE.LinearFilter;
    this.texture.magFilter = THREE.LinearFilter;
    this.texture.colorSpace = THREE.SRGBColorSpace;

    const material = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });
    this.sprite = new THREE.Sprite(material);
    this.sprite.position.y = 2.05; // ~25cm above head
    this.sprite.scale.set(1.6, 0.3, 1);
    this.sprite.renderOrder = 999; // draw on top of most things
  }

  setText(text: string) {
    if (text === this.currentText) return;
    this.currentText = text;

    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Pill background
    ctx.fillStyle = 'rgba(20, 12, 30, 0.78)';
    this.roundRect(ctx, 24, 16, canvas.width - 48, canvas.height - 32, 28);
    ctx.fill();

    ctx.strokeStyle = 'rgba(170, 130, 240, 0.55)';
    ctx.lineWidth = 2;
    this.roundRect(ctx, 24, 16, canvas.width - 48, canvas.height - 32, 28);
    ctx.stroke();

    // Text
    ctx.fillStyle = '#f4f0ff';
    ctx.font = '600 38px ui-monospace, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

    this.texture.needsUpdate = true;
  }

  dispose() {
    this.sprite.material.dispose();
    this.texture.dispose();
  }

  private roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }
}
