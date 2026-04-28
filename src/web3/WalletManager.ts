/**
 * Minimal Phantom wallet integration. No external SDK — talks directly to the
 * `window.phantom.solana` (or legacy `window.solana`) provider injected by the
 * Phantom browser extension.
 *
 * For this phase we only need: detect Phantom, request connection, expose the
 * base58 public key. Transaction signing comes in a later phase (shop).
 */

interface PhantomEvent {
  type: 'connect' | 'disconnect' | 'accountChanged';
}

export interface PhantomProvider {
  isPhantom?: boolean;
  publicKey?: { toBase58(): string };
  isConnected?: boolean;
  connect(opts?: { onlyIfTrusted?: boolean }): Promise<{ publicKey: { toBase58(): string } }>;
  disconnect(): Promise<void>;
  signAndSendTransaction?(
    transaction: unknown,
    options?: unknown
  ): Promise<{ signature: string; publicKey?: { toBase58(): string } }>;
  on(event: PhantomEvent['type'], handler: (...args: unknown[]) => void): void;
  off?(event: PhantomEvent['type'], handler: (...args: unknown[]) => void): void;
}

declare global {
  interface Window {
    phantom?: { solana?: PhantomProvider };
    solana?: PhantomProvider;
  }
}

export type WalletStatus = 'unavailable' | 'disconnected' | 'connecting' | 'connected' | 'error';

export class WalletManager {
  publicKey: string | null = null;
  status: WalletStatus = 'disconnected';
  private listeners: Array<(status: WalletStatus, publicKey: string | null, error?: string) => void> = [];

  getProvider(): PhantomProvider | null {
    const p = window.phantom?.solana ?? window.solana;
    return p?.isPhantom ? p : null;
  }

  isInstalled(): boolean {
    return this.getProvider() !== null;
  }

  /** Try silent reconnection if the site was previously approved. */
  async tryEagerConnect(): Promise<string | null> {
    const provider = this.getProvider();
    if (!provider) {
      this.setStatus('unavailable');
      return null;
    }
    try {
      const res = await provider.connect({ onlyIfTrusted: true });
      this.publicKey = res.publicKey.toBase58();
      this.setStatus('connected');
      return this.publicKey;
    } catch {
      // No prior approval — silent failure is expected.
      this.setStatus('disconnected');
      return null;
    }
  }

  /** User-initiated connect: triggers the Phantom popup. */
  async connect(): Promise<string> {
    const provider = this.getProvider();
    if (!provider) {
      this.setStatus('unavailable');
      throw new Error('Phantom not installed');
    }
    this.setStatus('connecting');
    try {
      const res = await provider.connect();
      this.publicKey = res.publicKey.toBase58();
      this.setStatus('connected');

      provider.on('disconnect', () => {
        this.publicKey = null;
        this.setStatus('disconnected');
      });
      provider.on('accountChanged', () => {
        const newKey = provider.publicKey?.toBase58() ?? null;
        this.publicKey = newKey;
        this.setStatus(newKey ? 'connected' : 'disconnected');
      });

      return this.publicKey;
    } catch (err) {
      this.setStatus('error', (err as Error).message);
      throw err;
    }
  }

  onChange(cb: (status: WalletStatus, publicKey: string | null, error?: string) => void) {
    this.listeners.push(cb);
  }

  private setStatus(status: WalletStatus, error?: string) {
    this.status = status;
    for (const cb of this.listeners) cb(status, this.publicKey, error);
  }
}

/** Format a 44-char base58 pubkey as `Abcd…wXyz`. */
export function shortAddress(pubkey: string): string {
  if (pubkey.length <= 10) return pubkey;
  return `${pubkey.slice(0, 4)}…${pubkey.slice(-4)}`;
}
