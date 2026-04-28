// Mirrors server PlayerState fields. Colyseus auto-decodes by name; we just
// declare the shape we read on the client.

export interface RemotePlayerSnapshot {
  x: number;
  y: number;
  z: number;
  yaw: number;
  weapon: WeaponId;
  flags: number;
  t: number;
  health: number;
  dead: boolean;
  wallet: string;
}

export const WEAPON_PISTOL = 0;
export const WEAPON_AK47 = 1;
export const WEAPON_ROCKET_LAUNCHER = 2;
export type WeaponId = typeof WEAPON_PISTOL | typeof WEAPON_AK47 | typeof WEAPON_ROCKET_LAUNCHER;

export const FLAG_MOVING = 1 << 0;
export const FLAG_SPRINTING = 1 << 1;
export const FLAG_JUMPING = 1 << 2;

export interface InputMessage {
  x: number;
  y: number;
  z: number;
  yaw: number;
  weapon: WeaponId;
  moving: boolean;
  sprinting: boolean;
  jumping: boolean;
}

export interface FireMessage {
  weapon: WeaponId;
  ox: number; oy: number; oz: number;
  dx: number; dy: number; dz: number;
  hitTargetId: string | null;
  hpx: number; hpy: number; hpz: number;
}

export interface ShotEvent {
  sessionId: string;
  weapon: WeaponId;
  ox: number; oy: number; oz: number;
  hpx: number; hpy: number; hpz: number;
}

export interface RespawnEvent {
  x: number; y: number; z: number;
}
