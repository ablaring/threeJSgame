export class InputManager {
  keys: Map<string, boolean> = new Map();
  mouseX = 0;
  mouseY = 0;
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  isPointerLocked = false;
  // Mouse buttons: index = button number (0 left, 1 middle, 2 right)
  private mouseButtons: boolean[] = [false, false, false];

  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      // Prevent browser default for keys we use as game shortcuts (F1 = help in most browsers)
      if (e.code === 'F1') e.preventDefault();
      this.keys.set(e.code, true);
    });

    window.addEventListener('keyup', (e) => {
      this.keys.set(e.code, false);
    });

    document.addEventListener('mousemove', (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX = e.movementX;
        this.mouseDeltaY = e.movementY;
      }
    });

    document.addEventListener('mousedown', (e) => {
      if (this.isPointerLocked) this.mouseButtons[e.button] = true;
    });

    document.addEventListener('mouseup', (e) => {
      this.mouseButtons[e.button] = false;
    });

    // Suppress browser context menu so right-click is usable for aim
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    canvas.addEventListener('click', () => {
      if (!this.isPointerLocked) {
        canvas.requestPointerLock();
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
      const overlay = document.getElementById('ui-overlay');
      if (overlay) {
        overlay.style.display = this.isPointerLocked ? 'none' : 'block';
      }
    });
  }

  isKeyDown(code: string): boolean {
    return this.keys.get(code) === true;
  }

  isKeyPressed(code: string): boolean {
    return this.keys.get(code) === true;
  }

  isMouseDown(button = 0): boolean {
    return this.mouseButtons[button] === true;
  }

  consumeMouseDelta(): { x: number; y: number } {
    const delta = { x: this.mouseDeltaX, y: this.mouseDeltaY };
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    return delta;
  }

  update() {
    // Reserved for future per-frame input processing
  }
}
