import * as THREE from 'three';

/**
 * Web Audio synthesizer for in-game SFX. No assets needed — sounds are
 * generated programmatically from oscillators + noise buffers. Spatial
 * audio uses PannerNode for distance attenuation.
 *
 * Browsers require a user gesture before AudioContext can play. Call
 * `unlock()` from a click/keypress handler. After unlock, all subsequent
 * play() calls work.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Footstep cadence
  private lastFootstepAt = 0;
  private footstepIntervalWalk = 380; // ms
  private footstepIntervalSprint = 240;

  // Camera reference for spatial audio (listener position)
  private camera: THREE.Camera | null = null;

  attachCamera(camera: THREE.Camera) {
    this.camera = camera;
  }

  /** Call from a user gesture (click) to unlock audio playback. */
  unlock() {
    if (this.ctx) return;
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    this.ctx = new Ctx() as AudioContext;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);

    // Pre-generate a 1s white-noise buffer reused for percussive sounds
    const sampleRate = this.ctx.sampleRate;
    const buf = this.ctx.createBuffer(1, sampleRate, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuffer = buf;
  }

  isReady(): boolean {
    return this.ctx !== null;
  }

  setMasterVolume(v: number) {
    if (this.master) this.master.gain.value = Math.max(0, Math.min(1, v));
  }

  // ---------- Sound recipes ----------

  /** AK47 gunshot: noise burst with low-frequency thump. */
  playGunshot(position?: THREE.Vector3) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.makeOutput(position);

    // High-freq crack: filtered noise burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'highpass';
    noiseFilter.frequency.value = 1500;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.7, t);
    noiseGain.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    noise.connect(noiseFilter).connect(noiseGain).connect(out);
    noise.start(t);
    noise.stop(t + 0.1);

    // Low thump: sine tone sliding down
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    const oscGain = ctx.createGain();
    oscGain.gain.setValueAtTime(0.5, t);
    oscGain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(oscGain).connect(out);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** Rocket launch: low whoosh with a short ignition crack. */
  playRocketLaunch(position?: THREE.Vector3) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.makeOutput(position);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(420, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.3);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.45, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.34);
    noise.connect(filter).connect(gain).connect(out);
    noise.start(t);
    noise.stop(t + 0.36);

    const pop = ctx.createOscillator();
    pop.type = 'sawtooth';
    pop.frequency.setValueAtTime(90, t);
    pop.frequency.exponentialRampToValueAtTime(45, t + 0.18);
    const popGain = ctx.createGain();
    popGain.gain.setValueAtTime(0.34, t);
    popGain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    pop.connect(popGain).connect(out);
    pop.start(t);
    pop.stop(t + 0.22);
  }

  /** Explosion: heavy low pulse plus noisy debris burst. */
  playExplosion(position?: THREE.Vector3) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const out = this.makeOutput(position);

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(900, t);
    filter.frequency.exponentialRampToValueAtTime(140, t + 0.45);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.52);
    noise.connect(filter).connect(gain).connect(out);
    noise.start(t);
    noise.stop(t + 0.55);

    const thump = ctx.createOscillator();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(70, t);
    thump.frequency.exponentialRampToValueAtTime(28, t + 0.35);
    const thumpGain = ctx.createGain();
    thumpGain.gain.setValueAtTime(0.7, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.01, t + 0.4);
    thump.connect(thumpGain).connect(out);
    thump.start(t);
    thump.stop(t + 0.45);
  }

  /** Footstep: short low-pass noise pop. Throttled internally. */
  tryPlayFootstep(sprinting: boolean) {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const now = performance.now();
    const interval = sprinting ? this.footstepIntervalSprint : this.footstepIntervalWalk;
    if (now - this.lastFootstepAt < interval) return;
    this.lastFootstepAt = now;

    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 400 + Math.random() * 200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(t);
    noise.stop(t + 0.08);
  }

  /** Jump: short rising sine sweep. */
  playJump() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(440, t + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  /** Hit / damage taken: short low pulse. */
  playDamage() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(80, t + 0.18);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 0.22);
  }

  /** Death: long descending tone. */
  playDeath() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(330, t);
    osc.frequency.exponentialRampToValueAtTime(60, t + 0.8);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.9);
    osc.connect(gain).connect(this.master);
    osc.start(t);
    osc.stop(t + 1.0);
  }

  /** Door / threshold: small soft bump. */
  playDoor() {
    if (!this.ctx || !this.master || !this.noiseBuffer) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 300;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.18);
    noise.connect(filter).connect(gain).connect(this.master);
    noise.start(t);
    noise.stop(t + 0.2);
  }

  /** Pickup chime for collecting a weapon. */
  playPickup() {
    if (!this.ctx || !this.master) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.28);

    for (const [i, freq] of [440, 660].entries()) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(gain).connect(this.master);
      osc.start(t + i * 0.07);
      osc.stop(t + 0.22 + i * 0.07);
    }
  }

  /**
   * For positional sounds, mount a panner at the source position. Distance
   * attenuation is rolled-off; beyond ~80m the sound is inaudible.
   */
  private makeOutput(position?: THREE.Vector3): AudioNode {
    if (!this.ctx || !this.master) throw new Error('audio not unlocked');
    if (!position) return this.master;

    const panner = this.ctx.createPanner();
    panner.panningModel = 'HRTF';
    panner.distanceModel = 'inverse';
    panner.refDistance = 4;
    panner.maxDistance = 80;
    panner.rolloffFactor = 1.5;
    panner.positionX.value = position.x;
    panner.positionY.value = position.y;
    panner.positionZ.value = position.z;

    // Update listener once per call (cheap)
    if (this.camera && this.ctx.listener) {
      const p = this.camera.position;
      const f = new THREE.Vector3();
      this.camera.getWorldDirection(f);
      const listener = this.ctx.listener;
      // Newer browsers expose positionX/Y/Z + forwardX/Y/Z; older fallback to setPosition/setOrientation
      if ('positionX' in listener) {
        (listener as any).positionX.value = p.x;
        (listener as any).positionY.value = p.y;
        (listener as any).positionZ.value = p.z;
        (listener as any).forwardX.value = f.x;
        (listener as any).forwardY.value = f.y;
        (listener as any).forwardZ.value = f.z;
        (listener as any).upX.value = 0;
        (listener as any).upY.value = 1;
        (listener as any).upZ.value = 0;
      } else {
        (listener as any).setPosition?.(p.x, p.y, p.z);
        (listener as any).setOrientation?.(f.x, f.y, f.z, 0, 1, 0);
      }
    }

    panner.connect(this.master);
    return panner;
  }
}
