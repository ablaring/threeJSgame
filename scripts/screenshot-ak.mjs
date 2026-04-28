import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const OUT = process.argv[2] || 'debug/ak-side.png';

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

// Open ghost B and place it next to spawn, facing east
const pageB = await browser.newPage();
pageB.on('console', (m) => console.log(`[B] ${m.type()}: ${m.text()}`));
await pageB.setViewport({ width: 800, height: 600 });
await pageB.goto(URL, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

await pageB.evaluate(() => {
  // @ts-ignore
  const g = window.__GAME__;
  if (g && g.player) {
    g.player.teleport(2, 2, 0);
    g.player.mesh.rotation.y = -Math.PI / 2; // face +X (east)
  }
});
await new Promise(r => setTimeout(r, 1500));

// Open A; orbit camera to side view of B
const pageA = await browser.newPage();
pageA.on('console', (m) => console.log(`[A] ${m.type()}: ${m.text()}`));
await pageA.setViewport({ width: 1280, height: 720 });
await pageA.goto(URL, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));

// Move camera by overriding the camera position before render
await pageA.evaluate(() => {
  // @ts-ignore
  const g = window.__GAME__;
  if (!g) return;
  // Position camera to side-view both players
  g.camera.position.set(2, 2.5, 5);
  g.camera.lookAt(2, 1.5, 0);
  g.renderOnce();
});

await pageA.screenshot({ path: OUT, fullPage: false });
console.log(`Screenshot saved: ${OUT}`);

await browser.close();
