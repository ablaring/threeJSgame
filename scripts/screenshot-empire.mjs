import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.empireState && window.__GAME__?.treeFactory);
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => window.__GAME__.gameLoop.stop());

await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(95, 1.5, 84);
  g.camera.position.set(35, 72, 160);
  g.camera.lookAt(95, 44, 60);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/empire-state-overview.png', fullPage: false });
console.log('Saved debug/empire-state-overview.png');

await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(95, 1.5, 69);
  g.camera.position.set(99.5, 2.35, 72.5);
  g.camera.lookAt(86, 4.15, 52);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/empire-state-interior.png', fullPage: false });
console.log('Saved debug/empire-state-interior.png');

await page.evaluate(() => {
  const g = window.__GAME__;
  g.camera.position.set(20, 34, 126);
  g.camera.lookAt(25, 7, 20);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/street-trees.png', fullPage: false });
console.log('Saved debug/street-trees.png');

await browser.close();
