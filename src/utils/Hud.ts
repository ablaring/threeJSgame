/**
 * Lightweight DOM HUD: crosshair + health bar + death banner.
 * Avoids any Canvas2D / extra deps; all CSS-driven.
 */
export class Hud {
  private root: HTMLDivElement;
  private healthFill: HTMLDivElement;
  private healthLabel: HTMLDivElement;
  private deathBanner: HTMLDivElement;
  private weaponLabel: HTMLDivElement;
  private wantedLabel: HTMLDivElement;
  private walletLabel: HTMLDivElement;
  private missionLabel: HTMLDivElement;
  private inventoryPanel: HTMLDivElement;
  private inventorySlots: Array<{ root: HTMLDivElement; key: HTMLDivElement; name: HTMLDivElement; status: HTMLDivElement }> = [];

  constructor() {
    this.root = document.createElement('div');
    this.root.id = 'hud';
    this.root.style.cssText = `
      position: fixed; inset: 0; pointer-events: none;
      font-family: system-ui, sans-serif; color: white;
      text-shadow: 0 1px 2px rgba(0,0,0,0.8);
    `;

    // Crosshair
    const crosshair = document.createElement('div');
    crosshair.style.cssText = `
      position: absolute; left: 50%; top: 50%;
      width: 14px; height: 14px; transform: translate(-50%, -50%);
      border: 1.5px solid rgba(255,255,255,0.9);
      border-radius: 50%;
      box-shadow: 0 0 0 1px rgba(0,0,0,0.5);
    `;
    const dot = document.createElement('div');
    dot.style.cssText = `
      position: absolute; left: 50%; top: 50%;
      width: 3px; height: 3px; transform: translate(-50%, -50%);
      background: rgba(255,255,255,0.95); border-radius: 50%;
    `;
    this.root.appendChild(crosshair);
    this.root.appendChild(dot);

    // Health bar (bottom-left)
    const healthWrap = document.createElement('div');
    healthWrap.style.cssText = `
      position: absolute; left: 24px; bottom: 24px;
      width: 240px; height: 22px;
      background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3);
      border-radius: 4px; overflow: hidden;
    `;
    this.healthFill = document.createElement('div');
    this.healthFill.style.cssText = `
      width: 100%; height: 100%; background: linear-gradient(90deg, #d33 0%, #f55 100%);
      transition: width 120ms linear;
    `;
    this.healthLabel = document.createElement('div');
    this.healthLabel.style.cssText = `
      position: absolute; left: 0; right: 0; top: 0; bottom: 0;
      text-align: center; font-size: 13px; line-height: 22px; font-weight: 600;
    `;
    this.healthLabel.textContent = 'HP 100';
    healthWrap.appendChild(this.healthFill);
    healthWrap.appendChild(this.healthLabel);
    this.root.appendChild(healthWrap);

    // Inventory panel (bottom-right): 3 weapon slots
    this.inventoryPanel = document.createElement('div');
    this.inventoryPanel.style.cssText = `
      position: absolute; right: 24px; bottom: 24px;
      display: flex; gap: 8px;
    `;
    const slotDefs = [
      { key: '1', name: 'Pistol' },
      { key: '2', name: 'AK47' },
      { key: '3', name: 'Rocket' },
    ];
    for (const def of slotDefs) {
      const slot = document.createElement('div');
      slot.style.cssText = `
        width: 80px; padding: 6px 4px;
        background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.22);
        border-radius: 6px; text-align: center;
        transition: border-color 120ms ease, background 120ms ease, opacity 120ms ease;
        opacity: 0.45;
      `;
      const keyBadge = document.createElement('div');
      keyBadge.style.cssText = `
        display: inline-block; font-size: 10px; font-weight: 700;
        background: rgba(255,255,255,0.12); border-radius: 3px;
        padding: 1px 6px; margin-bottom: 4px; letter-spacing: 0.5px;
      `;
      keyBadge.textContent = def.key;
      const nameEl = document.createElement('div');
      nameEl.style.cssText = 'font-size: 12px; font-weight: 700;';
      nameEl.textContent = def.name;
      const statusEl = document.createElement('div');
      statusEl.style.cssText = 'font-size: 10px; opacity: 0.65; margin-top: 2px;';
      statusEl.textContent = '🔒 locked';
      slot.appendChild(keyBadge);
      slot.appendChild(nameEl);
      slot.appendChild(statusEl);
      this.inventoryPanel.appendChild(slot);
      this.inventorySlots.push({ root: slot, key: keyBadge, name: nameEl, status: statusEl });
    }
    this.root.appendChild(this.inventoryPanel);

    // Weapon name label (kept for backward compat / sub-label below inventory)
    this.weaponLabel = document.createElement('div');
    this.weaponLabel.style.cssText = `
      position: absolute; right: 24px; bottom: 100px;
      min-width: 150px; height: 22px; padding: 0 10px;
      background: rgba(0,0,0,0.45); border: 1px solid rgba(255,255,255,0.18);
      border-radius: 4px; line-height: 22px; text-align: center;
      font-size: 11px; font-weight: 600; letter-spacing: 0.4px; opacity: 0.85;
    `;
    this.weaponLabel.textContent = 'Pistol';
    this.root.appendChild(this.weaponLabel);

    // Wanted stars (top-right)
    this.wantedLabel = document.createElement('div');
    this.wantedLabel.style.cssText = `
      position: absolute; right: 24px; top: 24px;
      min-width: 178px; height: 32px; padding: 0 12px;
      background: rgba(0,0,0,0.55); border: 1px solid rgba(255,255,255,0.28);
      border-radius: 4px; line-height: 32px; text-align: center;
      font-size: 17px; font-weight: 800; letter-spacing: 2px;
      color: #ffd44a; display: none;
    `;
    this.root.appendChild(this.wantedLabel);

    // Wallet label (top-left): shows the connected Phantom wallet
    this.walletLabel = document.createElement('div');
    this.walletLabel.style.cssText = `
      position: absolute; left: 24px; top: 24px;
      padding: 6px 12px;
      background: rgba(28, 14, 42, 0.7); border: 1px solid rgba(170, 130, 240, 0.45);
      border-radius: 4px;
      font-size: 12px; font-weight: 600; font-family: ui-monospace, monospace;
      color: #d8c8ff; letter-spacing: 0.4px;
    `;
    this.walletLabel.textContent = '👻 not connected';
    this.root.appendChild(this.walletLabel);

    // Contextual mission prompt (top-center)
    this.missionLabel = document.createElement('div');
    this.missionLabel.style.cssText = `
      position: absolute; left: 50%; top: 66px; transform: translateX(-50%);
      max-width: min(620px, calc(100vw - 48px)); padding: 8px 14px;
      background: rgba(0,0,0,0.62); border: 1px solid rgba(255,255,255,0.24);
      border-radius: 4px; font-size: 13px; font-weight: 700; line-height: 1.25;
      text-align: center; color: #f2f6ff; display: none;
    `;
    this.root.appendChild(this.missionLabel);

    // Death banner
    this.deathBanner = document.createElement('div');
    this.deathBanner.style.cssText = `
      position: absolute; left: 50%; top: 40%; transform: translate(-50%, -50%);
      padding: 16px 28px; background: rgba(150,0,0,0.75);
      font-size: 28px; font-weight: 700; letter-spacing: 2px;
      border-radius: 6px; display: none;
    `;
    this.deathBanner.textContent = 'YOU DIED — respawning...';
    this.root.appendChild(this.deathBanner);

    document.body.appendChild(this.root);
  }

  setHealth(hp: number, dead: boolean) {
    const clamped = Math.max(0, Math.min(100, hp));
    this.healthFill.style.width = `${clamped}%`;
    this.healthLabel.textContent = `HP ${clamped}`;
    this.deathBanner.style.display = dead ? 'block' : 'none';
  }

  setWeapon(label: string) {
    this.weaponLabel.textContent = label;
  }

  /**
   * Update the 3-slot inventory panel.
   * @param activeSlot index 0..2 (0=pistol, 1=ak47, 2=rocket)
   * @param ownedSlots boolean[] of length 3
   */
  setInventory(activeSlot: number, ownedSlots: boolean[]) {
    for (let i = 0; i < this.inventorySlots.length; i++) {
      const slot = this.inventorySlots[i];
      const owned = ownedSlots[i] === true;
      const active = i === activeSlot;
      slot.root.style.opacity = owned ? '1' : '0.45';
      slot.root.style.borderColor = active
        ? 'rgba(170, 130, 240, 0.85)'
        : owned
        ? 'rgba(255,255,255,0.32)'
        : 'rgba(255,255,255,0.18)';
      slot.root.style.background = active
        ? 'rgba(106, 76, 255, 0.32)'
        : 'rgba(0,0,0,0.55)';
      slot.status.textContent = owned ? (active ? '● equipped' : 'owned') : '🔒 locked';
      slot.status.style.color = active ? '#d8c8ff' : owned ? '#8be08b' : 'rgba(255,255,255,0.6)';
    }
  }

  setWantedLevel(level: number) {
    this.wantedLabel.style.display = level > 0 ? 'block' : 'none';
    this.wantedLabel.textContent = `WANTED ${'★'.repeat(level)}${'☆'.repeat(5 - level)}`;
  }

  setWallet(short: string) {
    this.walletLabel.textContent = `👻 ${short}`;
  }

  setMission(text: string | null) {
    if (!text) {
      this.missionLabel.style.display = 'none';
      this.missionLabel.textContent = '';
      return;
    }
    this.missionLabel.textContent = text;
    this.missionLabel.style.display = 'block';
  }
}
