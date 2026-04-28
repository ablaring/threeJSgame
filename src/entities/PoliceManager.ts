import * as THREE from 'three';
import { PoliceBot, PoliceShotEvent } from './PoliceBot';
import { WEAPON_ROCKET_LAUNCHER, WeaponId } from '../network/types';
import { BuildingBounds } from '../world/BuildingFactory';

const AK_DAMAGE_TO_POLICE = 25;
const ROCKET_SPLASH_RADIUS = 6;
const ROCKET_MAX_DAMAGE_TO_POLICE = 90;
const ROCKET_MIN_DAMAGE_TO_POLICE = 25;
const SPAWN_DISTANCE = 34;
const POLICE_WITNESS_DISTANCE = 45;
const POLICE_LOSE_DISTANCE = 70;
const EVADE_DECAY_MS = 9000;
const ROAD_COORDS = [-80, -40, 0, 40, 80];
const ROAD_HALF_WIDTH = 4.2;

export interface PoliceRaycastHit {
  id: string;
  point: THREE.Vector3;
  distance: number;
}

export class PoliceManager {
  wantedLevel = 0;
  policeKills = 0;

  private bots: PoliceBot[] = [];
  private nextId = 1;
  private lastSpawnAt = 0;
  private lastSeenAt = 0;
  private obstacles: BuildingBounds[];
  private scene: THREE.Scene;
  private onWantedChange: (level: number) => void;
  private onPoliceShot: (event: PoliceShotEvent) => void;

  constructor(
    scene: THREE.Scene,
    obstacles: BuildingBounds[],
    onWantedChange: (level: number) => void,
    onPoliceShot: (event: PoliceShotEvent) => void
  ) {
    this.scene = scene;
    this.obstacles = obstacles;
    this.onWantedChange = onWantedChange;
    this.onPoliceShot = onPoliceShot;
  }

  update(delta: number, playerPos: THREE.Vector3, playerDead: boolean) {
    if (playerDead) {
      this.clearWanted();
      return;
    }

    if (this.wantedLevel > 0) {
      const now = performance.now();
      if (this.canAnyPoliceSee(playerPos)) {
        this.lastSeenAt = now;
      } else if (now - this.lastSeenAt > EVADE_DECAY_MS) {
        this.setWantedLevel(this.wantedLevel - 1);
        this.lastSeenAt = now;
        if (this.wantedLevel === 0) {
          this.clearWanted();
          return;
        }
      }

      if (now - this.lastSeenAt < EVADE_DECAY_MS * 0.75 || this.bots.length === 0) {
        this.ensurePolicePresence(playerPos);
      }
    }

    for (let i = this.bots.length - 1; i >= 0; i--) {
      const bot = this.bots[i];
      const chaseTarget = this.getChaseTarget(bot.group.position, playerPos);
      bot.update(delta, playerPos, this.wantedLevel, this.obstacles, this.onPoliceShot, chaseTarget);
      if (bot.shouldDespawn()) {
        bot.dispose(this.scene);
        this.bots.splice(i, 1);
      }
    }
  }

  reportPlayerShot(weapon: WeaponId, playerPos: THREE.Vector3) {
    if (this.wantedLevel === 0 && !this.hasNearbyPolice(playerPos)) return;
    this.lastSeenAt = performance.now();
    this.setWantedLevel(Math.max(this.wantedLevel, weapon === WEAPON_ROCKET_LAUNCHER ? 2 : 1));
  }

  reportSeriousCrime(playerPos: THREE.Vector3, minimumLevel = 3) {
    this.lastSeenAt = performance.now();
    this.setWantedLevel(Math.max(this.wantedLevel, minimumLevel));
    this.ensurePolicePresence(playerPos);
  }

  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDist: number): PoliceRaycastHit | null {
    const raycaster = new THREE.Raycaster(origin, dir, 0, maxDist);
    let best: PoliceRaycastHit | null = null;

    for (const bot of this.bots) {
      if (bot.dead) continue;
      const hits = raycaster.intersectObjects(bot.hitObjects, true);
      if (hits.length === 0) continue;
      const hit = hits[0];
      const distance = hit.point.distanceTo(origin);
      if (!best || distance < best.distance) {
        best = { id: bot.id, point: hit.point.clone(), distance };
      }
    }

    return best;
  }

  damagePolice(id: string, damage = AK_DAMAGE_TO_POLICE): boolean {
    const bot = this.bots.find((p) => p.id === id);
    if (!bot || bot.dead) return false;

    this.lastSeenAt = performance.now();
    this.setWantedLevel(Math.max(this.wantedLevel, 2));
    const killed = bot.applyDamage(damage);
    if (killed) this.reportPoliceKilled();
    return killed;
  }

  damagePoliceInExplosion(center: THREE.Vector3) {
    for (const bot of this.bots) {
      if (bot.dead) continue;
      const dist = bot.group.position.distanceTo(center);
      if (dist > ROCKET_SPLASH_RADIUS) continue;

      const falloff = 1 - dist / ROCKET_SPLASH_RADIUS;
      const damage = Math.round(ROCKET_MIN_DAMAGE_TO_POLICE + (ROCKET_MAX_DAMAGE_TO_POLICE - ROCKET_MIN_DAMAGE_TO_POLICE) * falloff);
      this.damagePolice(bot.id, damage);
    }
  }

  spawnNear(playerPos: THREE.Vector3, angle = Math.random() * Math.PI * 2) {
    const position = this.findSpawnPosition(playerPos, angle);
    const bot = new PoliceBot(`police-${this.nextId++}`, position, this.scene);
    bot.group.lookAt(playerPos.x, 0, playerPos.z);
    this.bots.push(bot);
  }

  setWantedLevel(level: number) {
    const next = Math.max(0, Math.min(5, Math.floor(level)));
    if (next === this.wantedLevel) return;
    this.wantedLevel = next;
    this.onWantedChange(this.wantedLevel);
  }

  clearWanted() {
    if (this.wantedLevel !== 0 || this.policeKills !== 0) {
      this.wantedLevel = 0;
      this.policeKills = 0;
      this.onWantedChange(0);
    }
    for (const bot of this.bots) bot.dispose(this.scene);
    this.bots.length = 0;
  }

  getBots(): PoliceBot[] {
    return this.bots;
  }

  private ensurePolicePresence(playerPos: THREE.Vector3) {
    const aliveCount = this.bots.filter((b) => !b.dead).length;
    const desiredCount = Math.max(1, this.wantedLevel);
    if (aliveCount >= desiredCount) return;

    const now = performance.now();
    if (now - this.lastSpawnAt < 900) return;
    this.lastSpawnAt = now;

    const angle = Math.random() * Math.PI * 2;
    this.spawnNear(playerPos, angle);
  }

  private reportPoliceKilled() {
    this.policeKills += 1;
    this.lastSeenAt = performance.now();
    if (this.policeKills >= 4) {
      this.setWantedLevel(5);
    } else if (this.policeKills >= 2) {
      this.setWantedLevel(4);
    } else {
      this.setWantedLevel(3);
    }
  }

  private hasNearbyPolice(playerPos: THREE.Vector3): boolean {
    return this.bots.some((bot) => (
      !bot.dead &&
      bot.group.position.distanceTo(playerPos) <= POLICE_WITNESS_DISTANCE &&
      !this.isLineBlocked(bot.group.position, playerPos)
    ));
  }

  private canAnyPoliceSee(playerPos: THREE.Vector3): boolean {
    return this.bots.some((bot) => (
      !bot.dead &&
      bot.group.position.distanceTo(playerPos) <= POLICE_LOSE_DISTANCE &&
      !this.isLineBlocked(bot.group.position, playerPos)
    ));
  }

  private findSpawnPosition(playerPos: THREE.Vector3, angle: number): THREE.Vector3 {
    for (let i = 0; i < 24; i++) {
      const a = angle + i * Math.PI * 0.31;
      const distance = SPAWN_DISTANCE + (i % 4) * 8;
      const candidate = new THREE.Vector3(
        playerPos.x + Math.cos(a) * distance,
        0,
        playerPos.z + Math.sin(a) * distance
      );
      if (i % 2 === 0) candidate.x = this.nearestRoadCoord(candidate.x);
      else candidate.z = this.nearestRoadCoord(candidate.z);
      if (!this.isInsideObstacle(candidate)) return candidate;
    }

    return new THREE.Vector3(this.nearestRoadCoord(playerPos.x + SPAWN_DISTANCE), 0, playerPos.z);
  }

  private nearestRoadCoord(value: number): number {
    let best = ROAD_COORDS[0];
    let bestDist = Math.abs(value - best);
    for (const coord of ROAD_COORDS) {
      const dist = Math.abs(value - coord);
      if (dist < bestDist) {
        best = coord;
        bestDist = dist;
      }
    }
    return best;
  }

  private getChaseTarget(policePos: THREE.Vector3, playerPos: THREE.Vector3): THREE.Vector3 {
    if (!this.isLineBlocked(policePos, playerPos)) return playerPos;

    const policeRoadX = this.nearestRoadCoord(policePos.x);
    const policeRoadZ = this.nearestRoadCoord(policePos.z);
    const playerRoadX = this.nearestRoadCoord(playerPos.x);
    const playerRoadZ = this.nearestRoadCoord(playerPos.z);
    const onVerticalRoad = Math.abs(policePos.x - policeRoadX) <= ROAD_HALF_WIDTH;
    const onHorizontalRoad = Math.abs(policePos.z - policeRoadZ) <= ROAD_HALF_WIDTH;

    if (!onVerticalRoad && !onHorizontalRoad) {
      const distToVertical = Math.abs(policePos.x - policeRoadX);
      const distToHorizontal = Math.abs(policePos.z - policeRoadZ);
      return distToVertical < distToHorizontal
        ? new THREE.Vector3(policeRoadX, 0, policePos.z)
        : new THREE.Vector3(policePos.x, 0, policeRoadZ);
    }

    if (onVerticalRoad) {
      if (Math.abs(policePos.z - playerRoadZ) > ROAD_HALF_WIDTH) {
        return new THREE.Vector3(policeRoadX, 0, playerRoadZ);
      }
      return new THREE.Vector3(playerRoadX, 0, policePos.z);
    }

    if (Math.abs(policePos.x - playerRoadX) > ROAD_HALF_WIDTH) {
      return new THREE.Vector3(playerRoadX, 0, policeRoadZ);
    }
    return new THREE.Vector3(policePos.x, 0, playerRoadZ);
  }

  private isInsideObstacle(point: THREE.Vector3): boolean {
    return this.obstacles.some((b) => (
      Math.abs(point.x - b.x) < b.hx + 1.7 &&
      Math.abs(point.z - b.z) < b.hz + 1.7
    ));
  }

  private isLineBlocked(from: THREE.Vector3, to: THREE.Vector3): boolean {
    for (const b of this.obstacles) {
      if (this.segmentIntersectsRect(from.x, from.z, to.x, to.z, b.x, b.z, b.hx, b.hz)) {
        return true;
      }
    }
    return false;
  }

  private segmentIntersectsRect(
    x1: number,
    z1: number,
    x2: number,
    z2: number,
    cx: number,
    cz: number,
    hx: number,
    hz: number
  ): boolean {
    const minX = cx - hx;
    const maxX = cx + hx;
    const minZ = cz - hz;
    const maxZ = cz + hz;

    if (x1 >= minX && x1 <= maxX && z1 >= minZ && z1 <= maxZ) return true;
    if (x2 >= minX && x2 <= maxX && z2 >= minZ && z2 <= maxZ) return true;

    const dx = x2 - x1;
    const dz = z2 - z1;
    let t0 = 0;
    let t1 = 1;
    const checks = [
      [-dx, x1 - minX],
      [dx, maxX - x1],
      [-dz, z1 - minZ],
      [dz, maxZ - z1],
    ];

    for (const [p, q] of checks) {
      if (p === 0) {
        if (q < 0) return false;
      } else {
        const r = q / p;
        if (p < 0) {
          if (r > t1) return false;
          if (r > t0) t0 = r;
        } else {
          if (r < t0) return false;
          if (r < t1) t1 = r;
        }
      }
    }

    return true;
  }
}
