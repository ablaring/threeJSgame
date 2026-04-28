import puppeteer from 'puppeteer';

const PORT = process.env.PORT || 5173;
const OUT  = process.argv[2] || 'screenshot-closeup.png';

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page    = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));

await page.evaluate(() => {
  const game = window.__GAME__;
  if (!game) return;
  game.gameLoop.stop();

  game.player.mesh.rotation.y = Math.PI;
  const pos = game.player.getPosition();

  // Very close face shot — 1.2m in front of face
  game.camera.position.set(pos.x + 0.15, pos.y + 0.55, pos.z + 1.3);
  game.camera.lookAt(pos.x, pos.y + 0.5, pos.z);
  game.camera.updateProjectionMatrix();

  game.renderOnce();
});

await new Promise(r => setTimeout(r, 500));
await page.screenshot({ path: OUT, fullPage: false });
await browser.close();
console.log(`Closeup screenshot saved: ${OUT}`);
