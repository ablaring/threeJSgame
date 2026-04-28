import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

// Shot 1: connect screen WITHOUT Phantom installed
const noPhantom = await browser.newPage();
noPhantom.on('console', (m) => console.log(`[no-phantom] ${m.type()}: ${m.text()}`));
await noPhantom.setViewport({ width: 1280, height: 720 });
await noPhantom.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2000));
await noPhantom.screenshot({ path: 'debug/wallet-no-phantom.png' });
console.log('Saved debug/wallet-no-phantom.png');
await noPhantom.close();

// Shot 2: with mock Phantom — game should boot, HUD shows wallet, remote player has label
async function openWithMockPhantom(label, fakePubkey) {
  const page = await browser.newPage();
  page.on('console', (m) => console.log(`[${label}] ${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => console.log(`[${label}] ERR: ${e.message}`));
  await page.setViewport({ width: 1280, height: 720 });
  // Inject before page scripts run
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
  }, fakePubkey);
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // Wait for connect screen, then click "Enter game" twice in case
  await new Promise(r => setTimeout(r, 2500));
  return page;
}

// Open ghost B first, with its own pubkey
const fakeB = '8X2pT4Q5JmJ4qV1z9XKJP1nB3yfqRMZeJU2RJSJM83qf';
const pageB = await openWithMockPhantom('B', fakeB);
await pageB.evaluate(() => document.querySelector('#connect-screen button')?.click());
await new Promise(r => setTimeout(r, 4000));
await pageB.evaluate(() => {
  const g = window.__GAME__;
  if (g?.player) g.player.teleport(3, 1.5, 0);
});
await new Promise(r => setTimeout(r, 1500));

// Open A (the one we screenshot)
const fakeA = 'Hxc7w9z4ABqV2zd3RJ9XKJP1nBaxzNB1abc4QQ8K9wYz';
const pageA = await openWithMockPhantom('A', fakeA);
// Snapshot the connect screen first (still visible since we haven't clicked Enter yet)
await pageA.screenshot({ path: 'debug/wallet-connect-screen.png' });
console.log('Saved debug/wallet-connect-screen.png');

await pageA.evaluate(() => document.querySelector('#connect-screen button')?.click());
await new Promise(r => setTimeout(r, 4500));

// Side view of B so we can see its wallet label
await pageA.evaluate(() => {
  const g = window.__GAME__;
  if (!g) return;
  g.camera.position.set(0.5, 2.4, 4);
  g.camera.lookAt(3, 1.5, 0);
  g.renderOnce();
});
await new Promise(r => setTimeout(r, 200));
await pageA.evaluate(() => window.__GAME__?.renderOnce?.());
await pageA.screenshot({ path: 'debug/wallet-in-game.png' });
console.log('Saved debug/wallet-in-game.png');

await browser.close();
