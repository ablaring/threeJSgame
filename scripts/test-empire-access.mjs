import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.empireState && window.__GAME__?.player);
await new Promise(r => setTimeout(r, 1200));

const entrance = await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(95, 1.5, 77.2);
  g.camera.position.set(95, 4, 84);
  g.camera.lookAt(95, 2, 60);
  return g.player.getPosition();
});

await page.keyboard.down('w');
await new Promise(r => setTimeout(r, 900));
await page.keyboard.up('w');
await new Promise(r => setTimeout(r, 300));

const inside = await page.evaluate(() => window.__GAME__.player.getPosition());
const entered = inside.z < entrance.z - 2.0;

const rampBefore = await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(85.8, 1.5, 47.2);
  return g.player.getPosition();
});

await page.keyboard.down('s');
await new Promise(r => setTimeout(r, 3600));
await page.keyboard.up('s');
await new Promise(r => setTimeout(r, 300));

const rampAfter = await page.evaluate(() => window.__GAME__.player.getPosition());
const climbed = rampAfter.y > rampBefore.y + 1.0;

console.log('entrance before:', entrance);
console.log('entrance after:', inside);
console.log('entered:', entered);
console.log('ramp before:', rampBefore);
console.log('ramp after:', rampAfter);
console.log('climbed:', climbed);

await browser.close();

if (!entered || !climbed) {
  process.exitCode = 1;
}
