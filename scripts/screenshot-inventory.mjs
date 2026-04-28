import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const FAKE_PUBKEY = 'Hxc7w9z4ABqV2zd3RJ9XKJP1nBaxzNB1abc4QQ8K9wYz';

const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`ERR: ${e.message}`));
await page.setViewport({ width: 1280, height: 720 });

await page.evaluateOnNewDocument((pk) => {
  const provider = {
    isPhantom: true,
    publicKey: { toBase58: () => pk },
    isConnected: true,
    connect: async () => ({ publicKey: { toBase58: () => pk } }),
    disconnect: async () => {},
    on: () => {},
    off: () => {},
  };
  window.phantom = { solana: provider };
  // Start with empty inventory
  try { localStorage.removeItem(`inventory:${pk}`); } catch (_) {}
}, FAKE_PUBKEY);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => document.querySelector('#connect-screen button')?.click());
await new Promise(r => setTimeout(r, 4000));

// Side view of player so we can see the pistol on the arm
async function setSideCamera() {
  await page.evaluate(() => {
    const g = window.__GAME__;
    if (!g) return;
    g.player.teleport(0, 1.5, 0);
    g.player.mesh.rotation.y = -Math.PI / 2;
    g.camera.position.set(2.2, 2.2, 1);
    g.camera.lookAt(0, 1.4, 0);
    g.renderOnce();
  });
  await new Promise(r => setTimeout(r, 200));
}

// Shot 1: only pistol owned (initial state)
await setSideCamera();
await page.screenshot({ path: 'debug/inv-pistol-only.png' });
console.log('Saved debug/inv-pistol-only.png');

// Open shop, buy AK47
await page.keyboard.press('KeyB');
await new Promise(r => setTimeout(r, 600));
await page.evaluate(() => {
  // Click first "Buy" button (AK47)
  const btn = Array.from(document.querySelectorAll('#shop-screen button')).find((b) => b.textContent === 'Buy');
  btn?.click();
});
await new Promise(r => setTimeout(r, 600));
// Buy rocket too
await page.evaluate(() => {
  const btn = Array.from(document.querySelectorAll('#shop-screen button')).find((b) => b.textContent === 'Buy');
  btn?.click();
});
await new Promise(r => setTimeout(r, 800));
// Close shop
await page.keyboard.press('KeyB');
await new Promise(r => setTimeout(r, 400));

// Shot 2: pistol active, AK + rocket owned but not equipped
await setSideCamera();
await page.screenshot({ path: 'debug/inv-all-owned-pistol-active.png' });
console.log('Saved debug/inv-all-owned-pistol-active.png');

async function holdKey(code, ms = 120) {
  await page.keyboard.down(code);
  await new Promise(r => setTimeout(r, ms));
  await page.keyboard.up(code);
  await new Promise(r => setTimeout(r, 80));
}

// Switch to AK47
await holdKey('Digit2');
await setSideCamera();
await page.screenshot({ path: 'debug/inv-ak47-equipped.png' });
console.log('Saved debug/inv-ak47-equipped.png');

// Switch to Rocket
await holdKey('Digit3');
await setSideCamera();
await page.screenshot({ path: 'debug/inv-rocket-equipped.png' });
console.log('Saved debug/inv-rocket-equipped.png');

await browser.close();
