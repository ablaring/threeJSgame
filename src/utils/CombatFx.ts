import * as THREE from 'three';

const TRACER_LIFETIME_MS = 80;
const IMPACT_LIFETIME_MS = 120;
const ROCKET_SPEED = 55;          // 55 m/s visual flight
const ROCKET_MIN_FLIGHT_MS = 160;
const ROCKET_MAX_FLIGHT_MS = 850;
const EXPLOSION_LIFETIME_MS = 520;

interface ActiveTracer {
  line: THREE.Line;
  expiresAt: number;
}

interface ActiveImpact {
  mesh: THREE.Mesh;
  expiresAt: number;
}

interface ActiveRocket {
  group: THREE.Group;
  start: THREE.Vector3;
  end: THREE.Vector3;
  startAt: number;
  durationMs: number;
}

interface ActiveExplosion {
  mesh: THREE.Mesh;
  light: THREE.PointLight;
  startAt: number;
  expiresAt: number;
}

/**
 * Pools and renders short-lived shot tracers and bullet impact sparks.
 */
export class CombatFx {
  private scene: THREE.Scene;
  private tracers: ActiveTracer[] = [];
  private impacts: ActiveImpact[] = [];
  private rockets: ActiveRocket[] = [];
  private explosions: ActiveExplosion[] = [];

  private tracerMat = new THREE.LineBasicMaterial({ color: 0xFFEE88, transparent: true, opacity: 0.8 });
  private impactMat = new THREE.MeshBasicMaterial({ color: 0xFFAA22, transparent: true, opacity: 0.9 });
  private rocketBodyMat = new THREE.MeshStandardMaterial({ color: 0x6f7f70, roughness: 0.45, metalness: 0.25 });
  private rocketNoseMat = new THREE.MeshStandardMaterial({ color: 0xb63b2e, roughness: 0.45, metalness: 0.15 });
  private rocketExhaustMat = new THREE.MeshBasicMaterial({ color: 0xffc34a, transparent: true, opacity: 0.85 });
  private smokeMat = new THREE.LineBasicMaterial({ color: 0xb8b8a0, transparent: true, opacity: 0.42 });

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  spawnTracer(from: THREE.Vector3, to: THREE.Vector3) {
    const geom = new THREE.BufferGeometry().setFromPoints([from.clone(), to.clone()]);
    const line = new THREE.Line(geom, this.tracerMat);
    this.scene.add(line);
    this.tracers.push({ line, expiresAt: performance.now() + TRACER_LIFETIME_MS });
  }

  spawnImpact(at: THREE.Vector3) {
    const geom = new THREE.SphereGeometry(0.08, 6, 4);
    const mesh = new THREE.Mesh(geom, this.impactMat);
    mesh.position.copy(at);
    this.scene.add(mesh);
    this.impacts.push({ mesh, expiresAt: performance.now() + IMPACT_LIFETIME_MS });
  }

  spawnRocketShot(from: THREE.Vector3, to: THREE.Vector3) {
    const start = from.clone();
    const end = to.clone();
    const direction = end.clone().sub(start);
    const distance = direction.length();
    if (distance <= 0.001) {
      this.spawnExplosion(end);
      return;
    }
    direction.normalize();

    const group = this.createRocketProjectile();
    group.position.copy(start);
    group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
    this.scene.add(group);

    const trailGeom = new THREE.BufferGeometry().setFromPoints([start, end]);
    const trail = new THREE.Line(trailGeom, this.smokeMat);
    this.scene.add(trail);
    this.tracers.push({ line: trail, expiresAt: performance.now() + Math.min(500, Math.max(180, distance * 8)) });

    const durationMs = Math.max(
      ROCKET_MIN_FLIGHT_MS,
      Math.min(ROCKET_MAX_FLIGHT_MS, (distance / ROCKET_SPEED) * 1000)
    );

    this.rockets.push({
      group,
      start,
      end,
      startAt: performance.now(),
      durationMs,
    });
  }

  spawnExplosion(at: THREE.Vector3) {
    const material = new THREE.MeshBasicMaterial({
      color: 0xff7a22,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 18, 12), material);
    mesh.position.copy(at);
    mesh.scale.setScalar(0.15);
    this.scene.add(mesh);

    const light = new THREE.PointLight(0xff9a22, 2.2, 9, 2);
    light.position.copy(at);
    this.scene.add(light);

    const now = performance.now();
    this.explosions.push({
      mesh,
      light,
      startAt: now,
      expiresAt: now + EXPLOSION_LIFETIME_MS,
    });
  }

  update() {
    const now = performance.now();
    for (let i = this.rockets.length - 1; i >= 0; i--) {
      const rocket = this.rockets[i];
      const alpha = Math.min(1, (now - rocket.startAt) / rocket.durationMs);
      rocket.group.position.lerpVectors(rocket.start, rocket.end, alpha);
      if (alpha >= 1) {
        this.scene.remove(rocket.group);
        rocket.group.traverse((obj) => {
          if (obj instanceof THREE.Mesh) obj.geometry.dispose();
        });
        this.spawnExplosion(rocket.end);
        this.rockets.splice(i, 1);
      }
    }

    for (let i = this.explosions.length - 1; i >= 0; i--) {
      const explosion = this.explosions[i];
      const alpha = Math.min(1, (now - explosion.startAt) / EXPLOSION_LIFETIME_MS);
      const scale = 0.2 + alpha * 3.4;
      explosion.mesh.scale.setScalar(scale);
      explosion.light.intensity = Math.max(0, 2.2 * (1 - alpha));
      const mat = explosion.mesh.material;
      if (mat instanceof THREE.MeshBasicMaterial) mat.opacity = 0.58 * (1 - alpha);
      if (now > explosion.expiresAt) {
        this.scene.remove(explosion.mesh);
        this.scene.remove(explosion.light);
        explosion.mesh.geometry.dispose();
        if (explosion.mesh.material instanceof THREE.Material) explosion.mesh.material.dispose();
        this.explosions.splice(i, 1);
      }
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      if (now > this.tracers[i].expiresAt) {
        this.scene.remove(this.tracers[i].line);
        this.tracers[i].line.geometry.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.impacts.length - 1; i >= 0; i--) {
      if (now > this.impacts[i].expiresAt) {
        this.scene.remove(this.impacts[i].mesh);
        this.impacts[i].mesh.geometry.dispose();
        this.impacts.splice(i, 1);
      }
    }
  }

  private createRocketProjectile(): THREE.Group {
    const group = new THREE.Group();

    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.045, 0.045, 0.38, 12),
      this.rocketBodyMat
    );
    body.rotation.x = Math.PI / 2;
    body.castShadow = true;
    group.add(body);

    const nose = new THREE.Mesh(
      new THREE.ConeGeometry(0.055, 0.16, 12),
      this.rocketNoseMat
    );
    nose.rotation.x = Math.PI / 2;
    nose.position.z = 0.27;
    nose.castShadow = true;
    group.add(nose);

    const exhaust = new THREE.Mesh(
      new THREE.ConeGeometry(0.07, 0.18, 8),
      this.rocketExhaustMat
    );
    exhaust.rotation.x = -Math.PI / 2;
    exhaust.position.z = -0.28;
    group.add(exhaust);

    for (const sx of [-1, 1]) {
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.08, 0.12),
        this.rocketBodyMat
      );
      fin.position.set(sx * 0.055, 0, -0.17);
      group.add(fin);
    }

    return group;
  }
}
