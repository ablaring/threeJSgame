import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__GAME__?.police && window.__GAME__?.policeObstacles);
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(() => {
  const g = window.__GAME__;
  const T = g.THREE;

  const insideObstacle = (point) => g.policeObstacles.some((b) => (
    Math.abs(point.x - b.x) < b.hx - 1.25 &&
    Math.abs(point.z - b.z) < b.hz - 1.25
  ));

  g.gameLoop.stop();
  g.police.clearWanted();
  g.player.respawn(0, 1.5, 0);
  g.police.reportPlayerShot(0, new T.Vector3(0, 1.5, 0));
  const farShotWanted = g.police.wantedLevel;

  g.police.spawnNear(new T.Vector3(0, 1.5, 0), 0);
  const witness = g.police.getBots()[0];
  witness.group.position.set(0, 0, 18);
  witness.group.lookAt(0, 0, 0);
  g.police.reportPlayerShot(0, new T.Vector3(0, 1.5, 0));
  const witnessedShotWanted = g.police.wantedLevel;

  // Building at (20, -15) has an expanded obstacle. Start the police west of it
  // and chase a target east of it; direct motion would cross the building.
  g.police.clearWanted();
  g.police.setWantedLevel(3);
  g.police.spawnNear(new T.Vector3(0, 1.5, 0), 0);
  const bot = g.police.getBots()[0];
  bot.group.position.set(0, 0, -15);
  g.player.teleport(31, 1.5, -15);
  let everInside = false;
  for (let i = 0; i < 140; i++) {
    g.police.update(1 / 30, g.player.getPosition(), false);
    if (insideObstacle(bot.group.position)) everInside = true;
  }

  g.police.setWantedLevel(2);
  g.police.lastSeenAt = performance.now() - 10000;
  bot.group.position.set(-80, 0, 80);
  g.player.teleport(31, 1.5, -15);
  g.police.update(1 / 30, g.player.getPosition(), false);
  const escapeDecayWanted = g.police.wantedLevel;

  return {
    farShotWanted,
    witnessedShotWanted,
    policeCarEverInsideBuilding: everInside,
    escapeDecayWanted,
    finalPolicePosition: {
      x: Number(bot.group.position.x.toFixed(2)),
      z: Number(bot.group.position.z.toFixed(2)),
    },
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
