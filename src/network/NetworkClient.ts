import { Client, getStateCallbacks, Room } from 'colyseus.js';
import type {
  FireMessage, InputMessage, RemotePlayerSnapshot, RespawnEvent, ShotEvent,
} from './types';

const SEND_HZ = 20;
const SEND_INTERVAL = 1000 / SEND_HZ;

export type RemoteAddCallback = (sessionId: string, snapshot: RemotePlayerSnapshot) => void;
export type RemoteRemoveCallback = (sessionId: string) => void;
export type RemoteChangeCallback = (sessionId: string, snapshot: RemotePlayerSnapshot) => void;
export type ShotCallback = (event: ShotEvent) => void;
export type RespawnCallback = (event: RespawnEvent) => void;
export type SelfHealthCallback = (health: number, dead: boolean) => void;

export class NetworkClient {
  private client: Client;
  private room: Room | null = null;
  sessionId: string | null = null;

  private lastSent = 0;
  private onAdd?: RemoteAddCallback;
  private onRemove?: RemoteRemoveCallback;
  private onChange?: RemoteChangeCallback;
  private onShot?: ShotCallback;
  private onRespawn?: RespawnCallback;
  private onSelfHealth?: SelfHealthCallback;

  constructor(endpoint: string) {
    this.client = new Client(endpoint);
  }

  async connect(roomName = 'game'): Promise<void> {
    this.room = await this.client.joinOrCreate(roomName);
    this.sessionId = this.room.sessionId;
    console.log(`[net] connected as ${this.sessionId}`);

    // Schema v3 callbacks are external (better tree-shaking).
    const $ = getStateCallbacks(this.room);
    const stateRoot: any = $(this.room.state as any);

    const snapshot = (player: any): RemotePlayerSnapshot => ({
      x: player.x, y: player.y, z: player.z,
      yaw: player.yaw, weapon: player.weapon ?? 0, flags: player.flags, t: player.t,
      health: player.health, dead: player.dead,
      wallet: player.wallet ?? '',
    });

    stateRoot.players.onAdd((player: any, sessionId: string) => {
      if (sessionId === this.sessionId) {
        // Self: just notify health
        $(player).onChange(() => {
          this.onSelfHealth?.(player.health, player.dead);
        });
        return;
      }
      this.onAdd?.(sessionId, snapshot(player));
      $(player).onChange(() => {
        this.onChange?.(sessionId, snapshot(player));
      });
    });

    stateRoot.players.onRemove((_player: any, sessionId: string) => {
      if (sessionId === this.sessionId) return;
      this.onRemove?.(sessionId);
    });

    this.room.onMessage<ShotEvent>('shot', (msg) => {
      this.onShot?.(msg);
    });

    this.room.onMessage<RespawnEvent>('respawn', (msg) => {
      this.onRespawn?.(msg);
    });

    this.room.onLeave(() => {
      console.log('[net] disconnected');
    });

    this.room.onError((code, message) => {
      console.error(`[net] error ${code}: ${message}`);
    });
  }

  setCallbacks(handlers: {
    onAdd?: RemoteAddCallback;
    onRemove?: RemoteRemoveCallback;
    onChange?: RemoteChangeCallback;
    onShot?: ShotCallback;
    onRespawn?: RespawnCallback;
    onSelfHealth?: SelfHealthCallback;
  }) {
    this.onAdd = handlers.onAdd;
    this.onRemove = handlers.onRemove;
    this.onChange = handlers.onChange;
    this.onShot = handlers.onShot;
    this.onRespawn = handlers.onRespawn;
    this.onSelfHealth = handlers.onSelfHealth;
  }

  sendInput(msg: InputMessage) {
    if (!this.room) return;
    const now = performance.now();
    if (now - this.lastSent < SEND_INTERVAL) return;
    this.lastSent = now;
    this.room.send('input', msg);
  }

  sendFire(msg: FireMessage) {
    if (!this.room) return;
    this.room.send('fire', msg);
  }

  sendSelfDamage(amount: number) {
    if (!this.room) return;
    this.room.send('selfDamage', { amount });
  }

  sendWallet(wallet: string) {
    if (!this.room) return;
    this.room.send('setWallet', { wallet });
  }

  isConnected(): boolean {
    return this.room !== null;
  }
}
