import { Client, Room } from '@colyseus/core';
import { GameState } from './state/GameState';
import {
  FLAG_JUMPING,
  FLAG_MOVING,
  FLAG_SPRINTING,
  PlayerState,
  WEAPON_AK47,
  WEAPON_PISTOL,
  WEAPON_ROCKET_LAUNCHER,
} from './state/PlayerState';

interface InputMessage {
  x: number;
  y: number;
  z: number;
  yaw: number;
  weapon: number;
  moving: boolean;
  sprinting: boolean;
  jumping: boolean;
}

interface FireMessage {
  weapon: number;
  ox: number; oy: number; oz: number; // origin
  dx: number; dy: number; dz: number; // direction (unit)
  hitTargetId: string | null;         // client-side hit candidate
  hpx: number; hpy: number; hpz: number; // hit point (or far point if no hit)
}

interface SelfDamageMessage {
  amount: number;
}

const STATE_HZ = 20;
const MAX_TELEPORT_DIST = 50;

const PISTOL_DAMAGE = 12;
const PISTOL_MAX_RANGE = 70;
const PISTOL_FIRE_COOLDOWN_MS = 380;
const PISTOL_HIT_VALIDATION_RADIUS = 1.2;
const AK47_DAMAGE = 25;
const AK47_MAX_RANGE = 100;
const AK47_FIRE_COOLDOWN_MS = 80;       // server-side: slightly looser than client (100ms) to absorb jitter
const AK47_HIT_VALIDATION_RADIUS = 1.2; // tolerance: target capsule "fattening" for lag compensation
const ROCKET_MAX_RANGE = 85;
const ROCKET_FIRE_COOLDOWN_MS = 950;
const ROCKET_SPLASH_RADIUS = 6;         // 6m explosion radius
const ROCKET_MAX_DAMAGE = 90;
const ROCKET_MIN_DAMAGE = 28;
const RESPAWN_DELAY_MS = 3000;
const SPAWN: { x: number; y: number; z: number } = { x: 0, y: 1.5, z: 0 };

export class GameRoom extends Room<GameState> {
  maxClients = 32;

  private lastFireAt = new Map<string, number>();

  onCreate() {
    this.setState(new GameState());
    this.setPatchRate(1000 / STATE_HZ);

    this.onMessage<InputMessage>('input', (client, msg) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.dead) return;

      const dx = msg.x - player.x;
      const dy = msg.y - player.y;
      const dz = msg.z - player.z;
      const distSq = dx * dx + dy * dy + dz * dz;
      if (player.t > 0 && distSq > MAX_TELEPORT_DIST * MAX_TELEPORT_DIST) return;

      player.x = msg.x;
      player.y = msg.y;
      player.z = msg.z;
      player.yaw = msg.yaw;
      player.weapon =
        msg.weapon === WEAPON_ROCKET_LAUNCHER ? WEAPON_ROCKET_LAUNCHER :
        msg.weapon === WEAPON_AK47 ? WEAPON_AK47 :
        WEAPON_PISTOL;
      player.flags =
        (msg.moving ? FLAG_MOVING : 0) |
        (msg.sprinting ? FLAG_SPRINTING : 0) |
        (msg.jumping ? FLAG_JUMPING : 0);
      player.t = Date.now();
    });

    this.onMessage<FireMessage>('fire', (client, msg) => {
      const shooter = this.state.players.get(client.sessionId);
      if (!shooter || shooter.dead) return;

      const weapon =
        msg.weapon === WEAPON_ROCKET_LAUNCHER ? WEAPON_ROCKET_LAUNCHER :
        msg.weapon === WEAPON_AK47 ? WEAPON_AK47 :
        WEAPON_PISTOL;
      const now = Date.now();
      const last = this.lastFireAt.get(client.sessionId) ?? 0;
      const cooldown =
        weapon === WEAPON_ROCKET_LAUNCHER ? ROCKET_FIRE_COOLDOWN_MS :
        weapon === WEAPON_AK47 ? AK47_FIRE_COOLDOWN_MS :
        PISTOL_FIRE_COOLDOWN_MS;
      if (now - last < cooldown) return;
      this.lastFireAt.set(client.sessionId, now);
      shooter.weapon = weapon;

      // Broadcast the shot to all OTHER clients so they can render tracer + flash
      this.broadcast('shot', {
        sessionId: client.sessionId,
        weapon,
        ox: msg.ox, oy: msg.oy, oz: msg.oz,
        hpx: msg.hpx, hpy: msg.hpy, hpz: msg.hpz,
      }, { except: client });

      if (weapon === WEAPON_ROCKET_LAUNCHER) {
        this.applyRocketDamage(client.sessionId, shooter, msg);
        return;
      }

      // Validate hit
      if (!msg.hitTargetId) return;
      const target = this.state.players.get(msg.hitTargetId);
      if (!target || target.dead) return;

      const maxRange = weapon === WEAPON_AK47 ? AK47_MAX_RANGE : PISTOL_MAX_RANGE;
      const validRadius = weapon === WEAPON_AK47 ? AK47_HIT_VALIDATION_RADIUS : PISTOL_HIT_VALIDATION_RADIUS;
      const damage = weapon === WEAPON_AK47 ? AK47_DAMAGE : PISTOL_DAMAGE;

      // Range check shooter -> target
      const ddx = target.x - shooter.x;
      const ddy = target.y - shooter.y;
      const ddz = target.z - shooter.z;
      const distToTarget = Math.sqrt(ddx * ddx + ddy * ddy + ddz * ddz);
      if (distToTarget > maxRange) return;

      // Distance from claimed hit point to target body axis (rough capsule check)
      const tdx = msg.hpx - target.x;
      const tdy = msg.hpy - target.y;
      const tdz = msg.hpz - target.z;
      const distHitToTarget = Math.sqrt(tdx * tdx + tdy * tdy + tdz * tdz);
      if (distHitToTarget > validRadius) return;

      // Apply damage
      this.applyDamage(msg.hitTargetId, target, damage);
    });

    this.onMessage<SelfDamageMessage>('selfDamage', (client, msg) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.dead) return;
      const amount = Math.max(0, Math.min(30, Math.floor(msg.amount)));
      if (amount <= 0) return;
      this.applyDamage(client.sessionId, player, amount);
    });

    this.onMessage<{ wallet: string }>('setWallet', (client, msg) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      // Lock the wallet field once set so a client can't keep changing identity.
      if (player.wallet) return;
      const w = (msg?.wallet ?? '').trim();
      // Solana base58 pubkeys are 32-44 chars. Reject anything outside that range.
      if (w.length < 32 || w.length > 64) return;
      player.wallet = w;
    });
  }

  private applyRocketDamage(shooterId: string, shooter: PlayerState, msg: FireMessage) {
    const impactDx = msg.hpx - shooter.x;
    const impactDy = msg.hpy - shooter.y;
    const impactDz = msg.hpz - shooter.z;
    const impactDist = Math.sqrt(impactDx * impactDx + impactDy * impactDy + impactDz * impactDz);
    if (impactDist > ROCKET_MAX_RANGE + 2) return;

    this.state.players.forEach((target, targetId) => {
      if (targetId === shooterId || target.dead) return;

      const dx = target.x - msg.hpx;
      const dy = target.y - msg.hpy;
      const dz = target.z - msg.hpz;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist > ROCKET_SPLASH_RADIUS) return;

      const falloff = 1 - dist / ROCKET_SPLASH_RADIUS;
      const damage = Math.round(ROCKET_MIN_DAMAGE + (ROCKET_MAX_DAMAGE - ROCKET_MIN_DAMAGE) * falloff);
      this.applyDamage(targetId, target, damage);
    });
  }

  private applyDamage(sessionId: string, target: PlayerState, damage: number) {
    target.health = Math.max(0, target.health - damage);
    if (target.health <= 0 && !target.dead) {
      target.dead = true;
      this.scheduleRespawn(sessionId);
    }
  }

  private scheduleRespawn(sessionId: string) {
    this.clock.setTimeout(() => {
      const p = this.state.players.get(sessionId);
      if (!p) return;
      p.health = 100;
      p.dead = false;
      p.x = SPAWN.x;
      p.y = SPAWN.y;
      p.z = SPAWN.z;
      // Notify just that client of forced teleport
      const client = this.clients.find((c) => c.sessionId === sessionId);
      if (client) client.send('respawn', SPAWN);
    }, RESPAWN_DELAY_MS);
  }

  onJoin(client: Client) {
    const p = new PlayerState();
    p.x = SPAWN.x; p.y = SPAWN.y; p.z = SPAWN.z;
    this.state.players.set(client.sessionId, p);
    console.log(`[+] ${client.sessionId} joined (total: ${this.state.players.size})`);
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.lastFireAt.delete(client.sessionId);
    console.log(`[-] ${client.sessionId} left (total: ${this.state.players.size})`);
  }

  onDispose() {
    console.log('Room disposed');
  }
}
