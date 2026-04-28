import * as THREE from 'three';
import Stats from 'stats.js';

const DEBUG = new URLSearchParams(window.location.search).has('debug')
  || import.meta.env.VITE_DEBUG === 'true';

export class Debug {
  private stats?: Stats;
  private gridHelper?: THREE.GridHelper;

  constructor(scene: THREE.Scene) {
    if (!DEBUG) return;

    // FPS / MS / MB stats
    this.stats = new Stats();
    this.stats.showPanel(0);
    document.body.appendChild(this.stats.dom);

    // Grid helper (1m spacing, 200m extent)
    this.gridHelper = new THREE.GridHelper(200, 200, 0x444444, 0x222222);
    this.gridHelper.position.y = 0.01;
    scene.add(this.gridHelper);

    // Axes helper at origin
    const axes = new THREE.AxesHelper(5);
    scene.add(axes);

    console.log('[Debug] Debug mode enabled — ?debug in URL');
  }

  beginFrame() {
    if (this.stats) this.stats.begin();
  }

  endFrame() {
    if (this.stats) this.stats.end();
  }

  static isEnabled(): boolean {
    return DEBUG;
  }
}
