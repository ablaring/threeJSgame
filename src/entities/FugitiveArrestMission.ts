import * as THREE from 'three';
import { InputManager } from '../core/InputManager';
import { Hud } from '../utils/Hud';
import { Prison } from '../world/Prison';
import { PoliceBot } from './PoliceBot';
import { SpawnBot, SpawnBotManager } from './SpawnBots';

const CALL_DISTANCE = 5.4;         // meters around a hidden target
const CALL_VERTICAL_TOLERANCE = 2.2;
const ESCORT_SPEED = 34;           // m/s, arcade pacing for cross-city escort
const LOAD_TIME = 1.1;             // seconds before the suspect enters the car
const ROAD_COORDS = [-80, -40, 0, 40, 80];

interface ArrestTarget {
  bot: SpawnBot;
  pickupPoint: THREE.Vector3;
  spawnPoint: THREE.Vector3;
  cellPoint: THREE.Vector3;
}

class EscortUnit {
  readonly car: PoliceBot;
  complete = false;

  private route: THREE.Vector3[];
  private routeIndex = 0;
  private stage: 'to-pickup' | 'loading' | 'to-prison' | 'complete' = 'to-pickup';
  private loadingElapsed = 0;
  private pickupStandPoint: THREE.Vector3;

  constructor(
    private target: ArrestTarget,
    private prison: Prison,
    scene: THREE.Scene,
    private onComplete: (target: ArrestTarget) => void
  ) {
    this.car = new PoliceBot(`escort-${target.bot.id}`, target.spawnPoint, scene);
    this.car.group.name = `escort-car-${target.bot.id}`;
    this.route = this.buildRoute(target.pickupPoint, prison);
    this.pickupStandPoint = target.pickupPoint.clone().add(new THREE.Vector3(1.7, 0, -0.2));
    this.faceToward(this.route[0]);
  }

  update(delta: number) {
    if (this.complete) return;

    if (this.stage === 'to-pickup') {
      if (this.moveToward(this.route[0], delta)) {
        const yaw = this.yawToward(this.car.group.position);
        this.target.bot.placeAt(this.pickupStandPoint, yaw);
        this.stage = 'loading';
      }
      return;
    }

    if (this.stage === 'loading') {
      this.loadingElapsed += delta;
      this.car.group.lookAt(this.target.bot.group.position.x, 0, this.target.bot.group.position.z);
      if (this.loadingElapsed >= LOAD_TIME) {
        this.target.bot.loadIntoPoliceCar();
        this.routeIndex = 1;
        this.stage = 'to-prison';
      }
      return;
    }

    const nextPoint = this.route[this.routeIndex];
    if (this.moveToward(nextPoint, delta)) {
      this.routeIndex += 1;
      if (this.routeIndex >= this.route.length) {
        this.stage = 'complete';
        this.complete = true;
        this.target.bot.placeInCell(this.target.cellPoint, Math.PI);
        this.onComplete(this.target);
      }
    }
  }

  private buildRoute(pickup: THREE.Vector3, prison: Prison): THREE.Vector3[] {
    const roadX = this.nearestRoadCoord(pickup.x);
    const roadZ = this.nearestRoadCoord(pickup.z);
    const gate = prison.getGatePosition();
    const dropOff = prison.getDropOffPosition();
    const points = [
      pickup.clone(),
      new THREE.Vector3(roadX, 0, pickup.z),
      new THREE.Vector3(roadX, 0, roadZ),
      new THREE.Vector3(gate.x, 0, roadZ),
      gate.clone(),
      dropOff.clone(),
    ];

    return points.filter((point, index) => (
      index === 0 || point.distanceTo(points[index - 1]) > 0.4
    ));
  }

  private moveToward(target: THREE.Vector3, delta: number): boolean {
    const pos = this.car.group.position;
    const toTarget = target.clone().sub(pos);
    toTarget.y = 0;
    const distance = toTarget.length();
    if (distance < 0.25) {
      pos.x = target.x;
      pos.z = target.z;
      return true;
    }

    const dir = toTarget.normalize();
    const step = Math.min(distance, ESCORT_SPEED * delta);
    pos.addScaledVector(dir, step);
    pos.y = 0;
    const yaw = Math.atan2(-dir.x, -dir.z);
    this.car.group.rotation.y = this.lerpAngle(this.car.group.rotation.y, yaw, 1 - Math.exp(-7 * delta));
    return distance <= step + 0.25;
  }

  private faceToward(target: THREE.Vector3) {
    const dir = target.clone().sub(this.car.group.position);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) return;
    dir.normalize();
    this.car.group.rotation.y = Math.atan2(-dir.x, -dir.z);
  }

  private yawToward(target: THREE.Vector3): number {
    const dir = target.clone().sub(this.pickupStandPoint);
    dir.y = 0;
    if (dir.lengthSq() < 0.001) return 0;
    dir.normalize();
    return Math.atan2(-dir.x, -dir.z);
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

  private lerpAngle(current: number, target: number, alpha: number): number {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return current + diff * alpha;
  }
}

export class FugitiveArrestMission {
  private targets: ArrestTarget[];
  private escorts: EscortUnit[] = [];
  private pWasDown = false;
  private message: string | null = null;
  private messageUntil = 0;

  constructor(
    private spawnBots: SpawnBotManager,
    private prison: Prison,
    private scene: THREE.Scene,
    private hud: Hud
  ) {
    const bots = new Map(spawnBots.getBots().map((bot) => [bot.id, bot]));
    this.targets = [
      {
        bot: bots.get('cz-binance')!,
        pickupPoint: new THREE.Vector3(-105, 0, 100.4),
        spawnPoint: new THREE.Vector3(-105, 0, 124),
        cellPoint: prison.getCellPosition(0),
      },
      {
        bot: bots.get('sam-ftx')!,
        pickupPoint: new THREE.Vector3(95, 0, 78.2),
        spawnPoint: new THREE.Vector3(95, 0, 103),
        cellPoint: prison.getCellPosition(1),
      },
    ].filter((target) => target.bot);
  }

  update(delta: number, playerPos: THREE.Vector3, input: InputManager) {
    for (const escort of this.escorts) escort.update(delta);

    const pDown = input.isKeyDown('KeyP');
    const nearest = this.findNearestCallableTarget(playerPos);
    if (pDown && !this.pWasDown) {
      if (nearest) this.callPolice(nearest.target);
      else this.flash('Aucune cible a signaler ici.');
    }
    this.pWasDown = pDown;

    this.updateHud(nearest?.target ?? null);
  }

  startArrestFor(id: string): boolean {
    const target = this.targets.find((candidate) => candidate.bot.id === id && candidate.bot.isCallable());
    if (!target) return false;
    this.callPolice(target);
    return true;
  }

  getStatus() {
    return this.targets.map((target) => ({
      id: target.bot.id,
      name: target.bot.displayName,
      state: target.bot.getState(),
    }));
  }

  private callPolice(target: ArrestTarget) {
    if (!target.bot.isCallable()) return;
    target.bot.markPoliceCalled();
    const escort = new EscortUnit(target, this.prison, this.scene, (completed) => {
      this.flash(`${completed.bot.displayName} est arrive en prison.`);
    });
    this.escorts.push(escort);
    this.flash(`Police appelee pour ${target.bot.displayName}. Escorte en route.`);
  }

  private findNearestCallableTarget(playerPos: THREE.Vector3): { target: ArrestTarget; distance: number } | null {
    let nearest: { target: ArrestTarget; distance: number } | null = null;
    for (const target of this.targets) {
      if (!target.bot.isCallable()) continue;
      const botPos = target.bot.getWorldPosition();
      const horizontal = Math.hypot(botPos.x - playerPos.x, botPos.z - playerPos.z);
      const vertical = Math.abs((botPos.y + 0.9) - playerPos.y);
      if (horizontal > CALL_DISTANCE || vertical > CALL_VERTICAL_TOLERANCE) continue;
      if (!nearest || horizontal < nearest.distance) nearest = { target, distance: horizontal };
    }
    return nearest;
  }

  private updateHud(nearest: ArrestTarget | null) {
    if (nearest) {
      this.hud.setMission(`${nearest.bot.displayName} trouve. Appuie sur P pour appeler la police.`);
      return;
    }

    const now = performance.now();
    if (this.message && now < this.messageUntil) {
      this.hud.setMission(this.message);
      return;
    }

    const arrested = this.targets.filter((target) => target.bot.getState() === 'arrested').length;
    const active = this.targets.some((target) => {
      const state = target.bot.getState();
      return state === 'police-called' || state === 'in-custody';
    });
    if (active || arrested > 0) {
      this.hud.setMission(`Arrestations: ${arrested}/${this.targets.length}`);
      return;
    }

    this.hud.setMission(null);
  }

  private flash(message: string) {
    this.message = message;
    this.messageUntil = performance.now() + 4200;
  }
}
