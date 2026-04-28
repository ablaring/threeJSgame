/**
 * Per-wallet inventory of owned shop items. Persisted in localStorage today,
 * will move behind a network call (and ultimately on-chain NFT ownership) in
 * later phases. The public API is intentionally identical to the future
 * server-backed version so call sites don't change.
 */

const STORAGE_PREFIX = 'inventory:';

export class Inventory {
  private items: Set<string>;
  private listeners: Array<() => void> = [];

  constructor(private walletPubkey: string) {
    this.items = new Set(this.readFromStorage());
  }

  list(): string[] {
    return Array.from(this.items);
  }

  owns(itemId: string): boolean {
    return this.items.has(itemId);
  }

  /** Mock purchase (Phase 2). Phase 3 will hit the server after a Solana tx. */
  purchase(itemId: string): boolean {
    if (this.items.has(itemId)) return false;
    this.items.add(itemId);
    this.writeToStorage();
    for (const cb of this.listeners) cb();
    return true;
  }

  onChange(cb: () => void) {
    this.listeners.push(cb);
  }

  private storageKey(): string {
    return `${STORAGE_PREFIX}${this.walletPubkey}`;
  }

  private readFromStorage(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey());
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  private writeToStorage() {
    try {
      localStorage.setItem(this.storageKey(), JSON.stringify(this.list()));
    } catch {
      // ignore quota / private mode errors — inventory just won't persist
    }
  }
}
