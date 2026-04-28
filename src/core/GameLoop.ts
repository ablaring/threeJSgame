export type UpdateCallback = (delta: number) => void;

export class GameLoop {
  private lastTime = 0;
  private onUpdate: UpdateCallback;
  private running = false;

  constructor(onUpdate: UpdateCallback) {
    this.onUpdate = onUpdate;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick.bind(this));
  }

  stop() {
    this.running = false;
  }

  private tick(timestamp: number) {
    if (!this.running) return;

    const delta = Math.min((timestamp - this.lastTime) / 1000, 0.05); // cap at 50ms
    this.lastTime = timestamp;

    this.onUpdate(delta);

    requestAnimationFrame(this.tick.bind(this));
  }
}
