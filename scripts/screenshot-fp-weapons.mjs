import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const FAKE_PUBKEY = 'Hxc7w9z4ABqV2zd3RJ9XKJP1nBaxzNB1abc4QQ8K9wYz';

const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`ERR: ${e.message}`));
await page.setViewport({ width: 1280, height: 720 });

await page.evaluateOnNewDocument((pk) => {
  const provider = {
    isPhantom: true, publicKey: { toBase58: () => pk }, isConnected: true,
    connect: async () => ({ publicKey: { toBase58: () => pk } }),
    disconnect: async () => {}, on: () => {}, off: () => {},
  };
  window.phantom = { solana: provider };
  try { localStorage.removeItem(`inventory:${pk}`); } catch (_) {}
}, FAKE_PUBKEY);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => document.querySelector('#connect-screen button')?.click());
await new Promise(r => setTimeout(r, 4000));

async function prepareCapture() {
  await page.evaluate(() => {
    const game = window.__GAME__;
    if (game?.remotePlayers) {
      for (const remotePlayer of game.remotePlayers.values()) {
        remotePlayer.mesh.visible = false;
      }
    }
    game?.renderOnce?.();
  });
  await new Promise(r => setTimeout(r, 100));
}

// Toggle to first-person mode (F1)
await page.keyboard.down('F1');
await new Promise(r => setTimeout(r, 120));
await page.keyboard.up('F1');
await new Promise(r => setTimeout(r, 200));

await prepareCapture();

// Shot 1: FP with pistol equipped (the default)
await page.screenshot({ path: 'debug/fp-pistol.png' });
console.log('Saved debug/fp-pistol.png');

// Open shop, buy AK47 + Rocket
await page.keyboard.down('KeyB');
await new Promise(r => setTimeout(r, 120));
await page.keyboard.up('KeyB');
await new Promise(r => setTimeout(r, 500));
await page.evaluate(() => {
  const buy = () => {
    const btn = Array.from(document.querySelectorAll('#shop-screen button')).find((b) => b.textContent === 'Buy');
    btn?.click();
  };
  buy(); setTimeout(buy, 100);
});
await new Promise(r => setTimeout(r, 700));
// Close shop
await page.keyboard.down('KeyB');
await new Promise(r => setTimeout(r, 120));
await page.keyboard.up('KeyB');
await new Promise(r => setTimeout(r, 500));

// Switch to AK47 (Digit2)
await page.keyboard.down('Digit2');
await new Promise(r => setTimeout(r, 200));
await page.keyboard.up('Digit2');
await new Promise(r => setTimeout(r, 400));
await prepareCapture();
await page.screenshot({ path: 'debug/fp-ak47.png' });
console.log('Saved debug/fp-ak47.png');

// Switch to Rocket (Digit3)
await page.keyboard.down('Digit3');
await new Promise(r => setTimeout(r, 200));
await page.keyboard.up('Digit3');
await new Promise(r => setTimeout(r, 400));
await prepareCapture();
await page.screenshot({ path: 'debug/fp-rocket.png' });
console.log('Saved debug/fp-rocket.png');

// Switch back to pistol (Digit1)
await page.keyboard.down('Digit1');
await new Promise(r => setTimeout(r, 200));
await page.keyboard.up('Digit1');
await new Promise(r => setTimeout(r, 400));
await prepareCapture();
await page.screenshot({ path: 'debug/fp-pistol-after-switch.png' });
console.log('Saved debug/fp-pistol-after-switch.png');

await browser.close();
