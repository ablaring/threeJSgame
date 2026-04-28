import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.police && window.__GAME__?.player);
await new Promise(r => setTimeout(r, 1200));

await page.evaluate(() => {
  const g = window.__GAME__;
  const T = g.THREE;
  g.gameLoop.stop();
  g.player.respawn(0, 1.5, 0);
  g.player.mesh.position.set(0, 0.6, 0);
  g.player.mesh.rotation.y = Math.PI;
  g.police.clearWanted();
  g.police.setWantedLevel(3);
  g.police.spawnNear(new T.Vector3(0, 1.5, 0), -Math.PI / 5);
  g.police.spawnNear(new T.Vector3(0, 1.5, 0), Math.PI * 1.12);
  g.police.spawnNear(new T.Vector3(0, 1.5, 0), Math.PI * 0.55);

  const bots = g.police.getBots();
  const positions = [
    new T.Vector3(-7.5, 0, 10),
    new T.Vector3(8.5, 0, 12),
    new T.Vector3(2.5, 0, -10),
  ];
  bots.forEach((bot, i) => {
    bot.group.position.copy(positions[i]);
    bot.group.lookAt(0, 0, 0);
    const muzzle = bot.getMuzzleWorldPosition(new T.Vector3());
    g.fx.spawnTracer(muzzle, new T.Vector3(0, 1.25, 0));
  });

  g.camera.position.set(0, 8, 18);
  g.camera.lookAt(0, 1.4, 0);
  g.renderOnce();
});

await page.screenshot({ path: 'debug/police-wanted.png', fullPage: false });
console.log('Saved debug/police-wanted.png');

await browser.close();
