import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.trumpTower && window.__GAME__?.player);
await new Promise(r => setTimeout(r, 1200));

const before = await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(-105, 1.5, 103.5);
  return g.player.getPosition();
});

await page.keyboard.down('w');
await new Promise(r => setTimeout(r, 1200));
await page.keyboard.up('w');
await new Promise(r => setTimeout(r, 300));

const after = await page.evaluate(() => window.__GAME__.player.getPosition());
const entered = after.z < before.z - 3.0;

console.log('before:', before);
console.log('after:', after);
console.log('entered:', entered);

await browser.close();
if (!entered) process.exitCode = 1;
