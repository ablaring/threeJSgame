import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.player);
await new Promise(r => setTimeout(r, 1200));

const before = await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(15.35, 1.5, -21.2);
  g.player.mesh.rotation.y = 0;
  return g.player.getPosition();
});

await page.keyboard.down('s');
await new Promise(r => setTimeout(r, 3400));
await page.keyboard.up('s');
await new Promise(r => setTimeout(r, 300));

const after = await page.evaluate(() => window.__GAME__.player.getPosition());
console.log('before:', before);
console.log('after:', after);
console.log('climbed:', after.y > before.y + 1.0);

await browser.close();
