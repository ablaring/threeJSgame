import { shortAddress, WalletManager } from './WalletManager';

/**
 * Full-screen connect gate. Resolves when the wallet is connected and the
 * user clicks "Enter game". Unmounts on resolve.
 */
export class ConnectScreen {
  private root: HTMLDivElement;
  private statusEl: HTMLDivElement;
  private actionBtn: HTMLButtonElement;
  private subtext: HTMLDivElement;

  constructor(private wallet: WalletManager) {
    this.root = document.createElement('div');
    this.root.id = 'connect-screen';
    this.root.style.cssText = `
      position: fixed; inset: 0; z-index: 1000;
      background: radial-gradient(ellipse at center, #1a0e2a 0%, #050309 100%);
      display: flex; align-items: center; justify-content: center;
      font-family: system-ui, sans-serif; color: #f4f0ff;
    `;

    const card = document.createElement('div');
    card.style.cssText = `
      width: 420px; max-width: 92vw;
      padding: 40px 36px;
      background: rgba(28, 14, 42, 0.92);
      border: 1px solid rgba(170, 130, 240, 0.3);
      border-radius: 14px;
      box-shadow: 0 30px 90px rgba(0,0,0,0.6), 0 0 60px rgba(140, 90, 220, 0.08);
      text-align: center;
    `;

    const ghost = document.createElement('div');
    ghost.style.cssText = 'font-size: 64px; line-height: 1; margin-bottom: 18px;';
    ghost.textContent = '👻';
    card.appendChild(ghost);

    const title = document.createElement('div');
    title.style.cssText = 'font-size: 22px; font-weight: 700; letter-spacing: 0.3px;';
    title.textContent = 'Connect to play';
    card.appendChild(title);

    this.subtext = document.createElement('div');
    this.subtext.style.cssText = `
      margin-top: 8px; font-size: 13px; opacity: 0.7; line-height: 1.5;
    `;
    this.subtext.textContent = 'Your Phantom wallet address will be your in-game identity.';
    card.appendChild(this.subtext);

    this.actionBtn = document.createElement('button');
    this.actionBtn.style.cssText = `
      margin-top: 28px; width: 100%; padding: 14px 0;
      background: linear-gradient(135deg, #ab9ff2 0%, #6a4cff 100%);
      color: white; border: none; border-radius: 8px;
      font-size: 15px; font-weight: 700; letter-spacing: 0.3px;
      cursor: pointer; transition: transform 80ms ease, filter 80ms ease;
    `;
    this.actionBtn.textContent = 'Connect Phantom';
    this.actionBtn.addEventListener('mousedown', () => (this.actionBtn.style.transform = 'scale(0.98)'));
    this.actionBtn.addEventListener('mouseup', () => (this.actionBtn.style.transform = 'scale(1)'));
    this.actionBtn.addEventListener('mouseleave', () => (this.actionBtn.style.transform = 'scale(1)'));
    card.appendChild(this.actionBtn);

    this.statusEl = document.createElement('div');
    this.statusEl.style.cssText = 'margin-top: 16px; font-size: 12px; min-height: 16px; opacity: 0.85;';
    card.appendChild(this.statusEl);

    this.root.appendChild(card);
    document.body.appendChild(this.root);
  }

  /** Open the screen and resolve once a pubkey is obtained. */
  async waitForConnection(): Promise<string> {
    // 1. Try silent reconnect (no popup) if site was previously approved.
    const eager = await this.wallet.tryEagerConnect();
    if (eager) {
      this.showConnected(eager);
      return await this.waitForEnterClick(eager);
    }

    // 2. Otherwise wait for explicit user click.
    if (!this.wallet.isInstalled()) {
      this.showInstallNeeded();
    }

    return new Promise<string>((resolve, reject) => {
      this.actionBtn.addEventListener('click', async () => {
        if (!this.wallet.isInstalled()) {
          window.open('https://phantom.app/', '_blank');
          return;
        }
        try {
          this.actionBtn.disabled = true;
          this.actionBtn.textContent = 'Waiting for Phantom…';
          this.statusEl.textContent = '';
          const pubkey = await this.wallet.connect();
          this.showConnected(pubkey);
          const finalKey = await this.waitForEnterClick(pubkey);
          resolve(finalKey);
        } catch (err) {
          this.actionBtn.disabled = false;
          this.actionBtn.textContent = 'Connect Phantom';
          this.statusEl.style.color = '#ff8a8a';
          this.statusEl.textContent = (err as Error).message ?? 'Connection rejected';
          reject(err);
        }
      });
    });
  }

  private showInstallNeeded() {
    this.actionBtn.textContent = 'Install Phantom';
    this.subtext.textContent = 'Phantom is not detected in this browser. Install it to continue.';
  }

  private showConnected(pubkey: string) {
    this.subtext.innerHTML = `Connected as <b style="color:#d8c8ff">${shortAddress(pubkey)}</b>`;
    this.actionBtn.disabled = false;
    this.actionBtn.textContent = 'Enter game';
    this.statusEl.textContent = '';
  }

  private waitForEnterClick(pubkey: string): Promise<string> {
    return new Promise<string>((resolve) => {
      const onClick = () => {
        this.actionBtn.removeEventListener('click', onClick);
        this.dispose();
        resolve(pubkey);
      };
      this.actionBtn.addEventListener('click', onClick);
    });
  }

  dispose() {
    this.root.remove();
  }
}
