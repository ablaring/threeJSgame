import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__GAME__?.renderOnce, { timeout: 6000 });
await new Promise(r => setTimeout(r, 4000));
await page.evaluate(() => {
  const g = window.__GAME__;
  g.gameLoop.stop();
  document.getElementById('hud')?.style.setProperty('display', 'none');
  document.getElementById('ui-overlay')?.style.setProperty('display', 'none');
});

// Shot 1: street-level view down a tight service alley.
await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(20, 1.5, 15);
  g.player.mesh.position.set(20, 0.6, 15);
  g.player.setVisible(true);
  g.camera.position.set(19.7, 2.55, 5.2);
  g.camera.lookAt(20, 1.35, 30);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/alleys-close.png' });
console.log('Saved debug/alleys-close.png');

// Shot 2: cross-alley view showing dumpsters, bags, cardboard, and wall grime.
await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(-20, 1.5, -20);
  g.player.mesh.position.set(-20, 0.6, -20);
  g.player.setVisible(false);
  g.camera.position.set(-34, 2.8, -20.2);
  g.camera.lookAt(-7, 1.35, -20);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/alleys-cross.png' });
console.log('Saved debug/alleys-cross.png');

// Shot 3: aerial / wider angle showing the denser Manhattan block layout.
await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.setVisible(false);
  g.camera.position.set(0, 95, 105);
  g.camera.lookAt(0, 10, 0);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/buildings-aerial.png' });
console.log('Saved debug/buildings-aerial.png');

await Promise.race([
  browser.close(),
  new Promise((resolve) => setTimeout(resolve, 1200)),
]);
browser.process()?.kill('SIGKILL');
process.exit(0);
