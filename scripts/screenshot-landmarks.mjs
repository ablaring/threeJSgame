import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.trumpTower && window.__GAME__?.centralPark);
await new Promise(r => setTimeout(r, 2500));
await page.evaluate(() => window.__GAME__.gameLoop.stop());

await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(-105, 1.5, 105);
  g.camera.position.set(-146, 45, 146);
  g.camera.lookAt(-105, 33, 84);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/trump-tower.png', fullPage: false });
console.log('Saved debug/trump-tower.png');

await page.evaluate(() => {
  const g = window.__GAME__;
  g.camera.position.set(-105, 88, 258);
  g.camera.lookAt(0, 0, 165);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/central-park-overview.png', fullPage: false });
console.log('Saved debug/central-park-overview.png');

await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(-18, 1.5, 164);
  g.camera.position.set(-36, 7, 142);
  g.camera.lookAt(18, 3, 168);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/central-park-ground.png', fullPage: false });
console.log('Saved debug/central-park-ground.png');

await browser.close();
