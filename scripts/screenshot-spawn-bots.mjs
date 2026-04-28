import puppeteer from 'puppeteer';

const URL = process.env.URL || `http://localhost:${process.env.PORT || 5173}`;
const OUT = process.argv[2] || 'debug/spawn-bots.png';
const DETAIL_OUT = process.argv[3] || 'debug/spawn-bots-logos.png';

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (msg) => console.log(`[page:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => console.error(`[pageerror] ${err.stack || err.message}`));
await page.setViewport({ width: 1280, height: 720 });
await page.evaluateOnNewDocument(() => {
  const pubkey = 'SpawnBots111111111111111111111111111111111';
  const provider = {
    isPhantom: true,
    publicKey: { toBase58: () => pubkey },
    isConnected: true,
    connect: async () => ({ publicKey: { toBase58: () => pubkey } }),
    disconnect: async () => {},
    on: () => {},
    off: () => {},
  };
  window.phantom = { solana: provider };
});
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#connect-screen button', { timeout: 10000 });
await page.evaluate(() => document.querySelector('#connect-screen button')?.click());
await page.waitForFunction(() => window.__GAME__?.spawnBots && window.__GAME__?.player, { timeout: 45000 });
await new Promise((r) => setTimeout(r, 800));

await page.evaluate(() => {
  const g = window.__GAME__;
  g.gameLoop.stop();
  g.player.setVisible(false);
  document.querySelector('#hud')?.setAttribute('style', 'display: none');
  document.querySelector('#ui-overlay')?.setAttribute('style', 'display: none');
  document.querySelector('#crosshair')?.setAttribute('style', 'display: none');
  g.camera.fov = 58;
  g.camera.position.set(0, 2.05, 1.0);
  g.camera.lookAt(0, 1.08, -4.6);
  g.camera.updateProjectionMatrix();
  g.renderOnce();
});

await page.screenshot({ path: OUT, fullPage: false });

await page.evaluate(() => {
  const g = window.__GAME__;
  for (const bot of g.spawnBots.getBots()) {
    bot.group.traverse((obj) => {
      if (obj.isSprite) obj.visible = false;
    });
  }
  g.camera.fov = 46;
  g.camera.position.set(0, 1.45, -2.15);
  g.camera.lookAt(0, 1.08, -4.6);
  g.camera.updateProjectionMatrix();
  g.renderOnce();
});

await page.screenshot({ path: DETAIL_OUT, fullPage: false });
await browser.close();

console.log(`Spawn bots screenshots saved: ${OUT}, ${DETAIL_OUT}`);
