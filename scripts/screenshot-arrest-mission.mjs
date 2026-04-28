import puppeteer from 'puppeteer';

const URL = process.env.URL || `http://localhost:${process.env.PORT || 5173}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (msg) => console.log(`[page:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => console.error(`[pageerror] ${err.stack || err.message}`));

async function boot() {
  await page.setViewport({ width: 1280, height: 720 });
  await page.evaluateOnNewDocument(() => {
    const pubkey = 'ArrestMission1111111111111111111111111111';
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
  await page.waitForFunction(() => window.__GAME__?.fugitiveMission && window.__GAME__?.prison);
  await new Promise((r) => setTimeout(r, 800));
  await page.evaluate(() => {
    document.querySelector('#hud')?.setAttribute('style', 'display: none');
    document.querySelector('#ui-overlay')?.setAttribute('style', 'display: none');
    document.querySelector('#crosshair')?.setAttribute('style', 'display: none');
  });
}

async function shoot(path, setup) {
  await page.evaluate(setup);
  await new Promise((r) => setTimeout(r, 350));
  await page.screenshot({ path, fullPage: false });
  console.log(`Saved ${path}`);
}

await boot();

await shoot('debug/prison-overview.png', () => {
  const g = window.__GAME__;
  g.gameLoop.stop();
  g.player.setVisible(false);
  g.camera.fov = 56;
  g.camera.position.set(45, 31, -75);
  g.camera.lookAt(80, 3.2, -126);
  g.camera.updateProjectionMatrix();
  g.renderOnce();
});

await shoot('debug/hidden-cz-trump.png', () => {
  const g = window.__GAME__;
  g.camera.fov = 52;
  g.camera.position.set(-105, 1.75, 91.5);
  g.camera.lookAt(-108.7, 1.05, 82.4);
  g.camera.updateProjectionMatrix();
  g.renderOnce();
});

await shoot('debug/hidden-sam-empire.png', () => {
  const g = window.__GAME__;
  g.camera.fov = 50;
  g.camera.position.set(95.2, 5.2, 64.4);
  g.camera.lookAt(101.2, 4.4, 56.6);
  g.camera.updateProjectionMatrix();
  g.renderOnce();
});

await page.evaluate(() => {
  const g = window.__GAME__;
  g.gameLoop.start();
  g.fugitiveMission.startArrestFor('cz-binance');
});
await new Promise((r) => setTimeout(r, 1500));

await shoot('debug/arrest-escort-pickup.png', () => {
  const g = window.__GAME__;
  g.gameLoop.stop();
  g.camera.fov = 54;
  g.camera.position.set(-113, 4.1, 109);
  g.camera.lookAt(-105, 1.0, 100.4);
  g.camera.updateProjectionMatrix();
  g.renderOnce();
});

await page.evaluate(() => window.__GAME__.gameLoop.start());
await new Promise((r) => setTimeout(r, 15000));

await shoot('debug/arrest-prison-cell.png', () => {
  const g = window.__GAME__;
  g.gameLoop.stop();
  g.camera.fov = 54;
  g.camera.position.set(68, 6.2, -107);
  g.camera.lookAt(75.6, 1.2, -124.3);
  g.camera.updateProjectionMatrix();
  g.renderOnce();
});

console.log('Mission status:', await page.evaluate(() => window.__GAME__.fugitiveMission.getStatus()));
await browser.close();
