import { Inventory } from './Inventory';
import { ShopItem, SHOP_ITEMS } from './ShopCatalog';
import type { WeaponNftService } from './WeaponNftService';

/**
 * Modal weapons shop. Toggled with the B key.
 *
 * On Buy → asks the server for a partial-signed mint tx, has Phantom add the
 * buyer signature, submits to Solana, then refreshes the on-chain inventory.
 */
export class ShopScreen {
  private root: HTMLDivElement;
  private toast: HTMLDivElement | null = null;
  private subtitle: HTMLDivElement;
  private isOpen = false;
  private busyItemId: string | null = null;
  private itemRows = new Map<string, { btn: HTMLButtonElement; status: HTMLSpanElement }>();

  onOpenChange: ((open: boolean) => void) | null = null;
  onPurchased: ((itemId: string) => void) | null = null;

  constructor(
    private inventory: Inventory,
    private nft?: WeaponNftService,
  ) {
    this.root = document.createElement('div');
    this.root.id = 'shop-screen';
    this.root.style.cssText = `
      position: fixed; inset: 0; z-index: 900;
      background: rgba(8, 4, 16, 0.78);
      display: none; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; color: #f4f0ff;
      backdrop-filter: blur(4px);
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width: 560px; max-width: 92vw; max-height: 86vh;
      background: rgba(28, 14, 42, 0.96);
      border: 1px solid rgba(170, 130, 240, 0.35);
      border-radius: 14px;
      box-shadow: 0 30px 90px rgba(0,0,0,0.6), 0 0 60px rgba(140, 90, 220, 0.1);
      padding: 28px 30px 24px;
      overflow: auto;
    `;

    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 4px;
    `;
    const title = document.createElement('div');
    title.style.cssText = 'font-size: 20px; font-weight: 700; letter-spacing: 0.4px;';
    title.textContent = '🛒 Weapons Shop';
    header.appendChild(title);

    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = `
      background: transparent; color: #d8c8ff; border: none;
      font-size: 22px; cursor: pointer; padding: 0 6px; line-height: 1;
    `;
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(closeBtn);
    card.appendChild(header);

    this.subtitle = document.createElement('div');
    this.subtitle.style.cssText = 'font-size: 12px; opacity: 0.6; margin-bottom: 18px;';
    card.appendChild(this.subtitle);

    for (const item of SHOP_ITEMS) {
      card.appendChild(this.buildItemRow(item));
    }

    const footer = document.createElement('div');
    footer.style.cssText = 'margin-top: 18px; font-size: 11px; opacity: 0.5; text-align: right;';
    footer.textContent = 'Press B or Esc to close';
    card.appendChild(footer);

    this.root.appendChild(card);
    document.body.appendChild(this.root);

    // Backdrop click closes.
    this.root.addEventListener('click', (e) => {
      if (e.target === this.root) this.close();
    });

    inventory.onChange(() => this.refresh());
  }

  private buildItemRow(item: ShopItem): HTMLElement {
    const row = document.createElement('div');
    row.style.cssText = `
      display: flex; align-items: center; gap: 16px;
      padding: 14px 14px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(170, 130, 240, 0.18);
      border-radius: 10px;
      margin-bottom: 12px;
    `;

    const icon = document.createElement('div');
    icon.style.cssText = `
      width: 56px; height: 56px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
      font-size: 32px;
      background: rgba(170, 130, 240, 0.08);
      border-radius: 8px;
    `;
    icon.textContent = item.icon;
    row.appendChild(icon);

    const info = document.createElement('div');
    info.style.cssText = 'flex: 1; min-width: 0;';
    const name = document.createElement('div');
    name.style.cssText = 'font-size: 15px; font-weight: 700;';
    name.textContent = item.name;
    info.appendChild(name);
    const desc = document.createElement('div');
    desc.style.cssText = 'font-size: 12px; opacity: 0.7; margin-top: 2px;';
    desc.textContent = item.description;
    info.appendChild(desc);

    const status = document.createElement('span');
    status.style.cssText = 'display: inline-block; margin-top: 6px; font-size: 11px; color: #8be08b;';
    info.appendChild(status);
    row.appendChild(info);

    const right = document.createElement('div');
    right.style.cssText = 'display: flex; flex-direction: column; align-items: flex-end; gap: 8px;';
    const price = document.createElement('div');
    price.style.cssText = `
      font-size: 14px; font-weight: 700;
      color: ${item.accent};
    `;
    price.textContent = `${item.priceSol} SOL`;
    right.appendChild(price);

    const btn = document.createElement('button');
    btn.style.cssText = `
      background: linear-gradient(135deg, #ab9ff2 0%, #6a4cff 100%);
      color: white; border: none; border-radius: 6px;
      padding: 8px 18px; font-size: 13px; font-weight: 700;
      cursor: pointer; transition: filter 80ms ease, transform 80ms ease;
    `;
    btn.textContent = 'Buy';
    btn.addEventListener('mousedown', () => (btn.style.transform = 'scale(0.97)'));
    btn.addEventListener('mouseup', () => (btn.style.transform = 'scale(1)'));
    btn.addEventListener('mouseleave', () => (btn.style.transform = 'scale(1)'));
    btn.addEventListener('click', () => this.handleBuy(item));
    right.appendChild(btn);

    row.appendChild(right);

    this.itemRows.set(item.id, { btn, status });
    return row;
  }

  private async handleBuy(item: ShopItem) {
    if (this.inventory.owns(item.id)) return;
    if (this.busyItemId) return;
    if (!this.nft?.isEnabled()) {
      this.showToast('NFT minting is not configured', 'error');
      return;
    }

    this.busyItemId = item.id;
    this.refresh();

    try {
      const receipt = await this.nft.mint(item.id);
      // Re-scan the chain so the inventory reflects the new NFT.
      await this.inventory.refresh();
      this.showToast(`✓ ${item.name} NFT minted`, 'success', receipt.explorerUrl);
      this.onPurchased?.(item.id);
    } catch (err) {
      this.showToast((err as Error).message || 'Mint failed', 'error');
    } finally {
      this.busyItemId = null;
      this.refresh();
    }
  }

  /** Refresh button states (called when inventory changes). */
  private refresh() {
    const enabled = this.nft?.isEnabled() ?? false;
    this.subtitle.textContent = enabled
      ? `Phantom will ask you to confirm one Solana transaction (pay + mint NFT) on ${this.nft?.getNetworkLabel()}.`
      : 'NFT minting is not configured. Run setup:collection on the server and set VITE_COLLECTION_MINT.';

    for (const item of SHOP_ITEMS) {
      const row = this.itemRows.get(item.id);
      if (!row) continue;
      const owned = this.inventory.owns(item.id);
      const busy = this.busyItemId === item.id;
      row.btn.disabled = owned || this.busyItemId !== null;
      row.btn.textContent =
        owned ? 'Owned' :
        busy ? 'Confirming...' :
        enabled ? 'Buy + Mint' :
        'Unavailable';
      row.btn.style.filter = owned ? 'grayscale(0.6) opacity(0.65)' : 'none';
      row.btn.style.cursor = owned || this.busyItemId !== null ? 'default' : 'pointer';
      row.status.textContent =
        owned ? '● Owned (NFT)' :
        busy ? 'Confirm in Phantom' :
        '';
    }
  }

  open() {
    if (this.isOpen) return;
    this.isOpen = true;
    this.refresh();
    this.root.style.display = 'flex';
    if (document.pointerLockElement) document.exitPointerLock();
    this.onOpenChange?.(true);
  }

  close() {
    if (!this.isOpen) return;
    this.isOpen = false;
    this.root.style.display = 'none';
    this.onOpenChange?.(false);
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  isVisible(): boolean {
    return this.isOpen;
  }

  private showToast(text: string, tone: 'success' | 'error' = 'success', href: string | null = null) {
    if (this.toast) this.toast.remove();
    const t = document.createElement('div');
    const isError = tone === 'error';
    t.style.cssText = `
      position: fixed; left: 50%; bottom: 80px; transform: translateX(-50%);
      padding: 10px 18px; background: rgba(40, 22, 58, 0.95);
      border: 1px solid ${isError ? 'rgba(255, 120, 120, 0.58)' : 'rgba(139, 224, 139, 0.5)'};
      border-radius: 6px; color: ${isError ? '#ffd2d2' : '#d8ffd8'};
      font-family: system-ui, sans-serif; font-size: 13px; font-weight: 600;
      z-index: 1100; pointer-events: ${href ? 'auto' : 'none'};
      transition: opacity 240ms ease, transform 240ms ease;
    `;
    t.textContent = text;
    if (href) {
      const link = document.createElement('a');
      link.href = href;
      link.target = '_blank';
      link.rel = 'noreferrer';
      link.style.cssText = 'display: block; margin-top: 4px; color: #c9bfff; font-size: 11px;';
      link.textContent = 'View transaction';
      t.appendChild(link);
    }
    document.body.appendChild(t);
    this.toast = t;
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transform = 'translateX(-50%) translateY(8px)';
    }, 1400);
    setTimeout(() => t.remove(), 1700);
  }
}
