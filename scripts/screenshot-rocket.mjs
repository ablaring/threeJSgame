import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5173';

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));
await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'networkidle0' });
await page.waitForFunction(() => window.__GAME__?.player && window.__GAME__?.rocketPickups);
await new Promise(r => setTimeout(r, 1200));

await page.evaluate(() => {
  const g = window.__GAME__;
  g.gameLoop.stop();
  g.player.setVisible(false);
  g.camera.position.set(20, 1.45, -12.35);
  g.camera.lookAt(20, 0.25, -15.8);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/rocket-pickup.png', fullPage: false });
console.log('Saved debug/rocket-pickup.png');

await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.setVisible(true);
  g.player.pickupRocketLauncher();
  g.player.setWeapon(1);
  g.hud.setWeapon(g.player.getWeaponLabel());
  g.player.teleport(0, 1.5, 0);
  g.player.mesh.position.set(0, 0.6, 0);
  g.player.mesh.rotation.y = -Math.PI / 2;
  g.camera.position.set(2.2, 1.8, 3.4);
  g.camera.lookAt(0, 1.05, 0);
  g.renderOnce();
});
await page.screenshot({ path: 'debug/rocket-equipped.png', fullPage: false });
console.log('Saved debug/rocket-equipped.png');

await page.evaluate(() => {
  const g = window.__GAME__;
  const T = g.THREE;
  g.player.setVisible(false);
  g.fx.spawnRocketShot(
    new T.Vector3(-2.2, 1.2, 0),
    new T.Vector3(2.6, 1.2, 0)
  );
  g.camera.position.set(0.4, 2.1, 4.6);
  g.camera.lookAt(0.3, 1.0, 0);
  for (let i = 0; i < 18; i++) g.fx.update();
  g.renderOnce();
});
await page.screenshot({ path: 'debug/rocket-shot.png', fullPage: false });
console.log('Saved debug/rocket-shot.png');

await page.evaluate(() => {
  const g = window.__GAME__;
  const T = g.THREE;
  g.fx.spawnExplosion(new T.Vector3(0, 1.0, 0));
  g.camera.position.set(0.5, 2.2, 4.0);
  g.camera.lookAt(0, 1.0, 0);
});
await new Promise(r => setTimeout(r, 220));
await page.evaluate(() => {
  const g = window.__GAME__;
  g.fx.update();
  g.renderOnce();
});
await page.screenshot({ path: 'debug/rocket-explosion.png', fullPage: false });
console.log('Saved debug/rocket-explosion.png');

await browser.close();
