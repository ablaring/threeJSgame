/**
 * Per-wallet inventory of owned shop items.
 *
 * Source of truth = on-chain Solana NFT ownership. At boot and after every
 * mint we scan the connected wallet for NFTs that belong to our verified
 * collection. Anything not on-chain is not owned — there is no localStorage
 * fallback because that path was used to pretend ownership in earlier dev
 * builds, which is exactly what we don't want anymore.
 */

import type { WeaponNftService } from './WeaponNftService';

export class Inventory {
  private items: Set<string> = new Set();
  private listeners: Array<() => void> = [];
  private isRefreshing = false;

  constructor(private nftService: WeaponNftService | null = null) {}

  list(): string[] {
    return Array.from(this.items);
  }

  owns(itemId: string): boolean {
    return this.items.has(itemId);
  }

  /**
   * Re-scan the connected wallet for collection NFTs and update the inventory
   * from the chain. Call after a successful mint, and once at boot.
   */
  async refresh(): Promise<void> {
    if (this.isRefreshing) return;
    this.isRefreshing = true;
    try {
      if (!this.nftService?.isEnabled()) {
        if (this.items.size > 0) {
          this.items = new Set();
          this.notify();
        }
        return;
      }
      const next = await this.nftService.fetchOwnedItems();
      const same = next.size === this.items.size && [...next].every((x) => this.items.has(x));
      if (!same) {
        this.items = next;
        this.notify();
      }
    } finally {
      this.isRefreshing = false;
    }
  }

  onChange(cb: () => void) {
    this.listeners.push(cb);
  }

  private notify() {
    for (const cb of this.listeners) cb();
  }
}
