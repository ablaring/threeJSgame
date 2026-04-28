import { Schema, type } from '@colyseus/schema';

export class PlayerState extends Schema {
  @type('number') x = 0;
  @type('number') y = 0;
  @type('number') z = 0;
  @type('number') yaw = 0;
  @type('uint8') weapon = 0; // 0: pistol (default), 1: AK47, 2: rocket launcher
  @type('uint8') flags = 0; // bit 0: moving, bit 1: sprinting, bit 2: jumping
  @type('number') t = 0;    // server timestamp of last update (ms)
  @type('uint8') health = 100;
  @type('boolean') dead = false;
  @type('string') wallet = ''; // base58 Solana pubkey, set once at join
}

export const FLAG_MOVING = 1 << 0;
export const FLAG_SPRINTING = 1 << 1;
export const FLAG_JUMPING = 1 << 2;

export const WEAPON_PISTOL = 0;
export const WEAPON_AK47 = 1;
export const WEAPON_ROCKET_LAUNCHER = 2;
