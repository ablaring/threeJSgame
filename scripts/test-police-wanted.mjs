import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://127.0.0.1:5173';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`pageerror: ${e.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__GAME__?.police && window.__GAME__?.player);
await new Promise(r => setTimeout(r, 1200));

const result = await page.evaluate(async () => {
  const g = window.__GAME__;
  const T = g.THREE;
  g.police.clearWanted();
  g.player.respawn(0, 1.5, 0);

  g.police.spawnNear(new T.Vector3(0, 1.5, 0), 0);
  const witness = g.police.getBots()[0];
  witness.group.position.set(0, 0, 18);
  witness.group.lookAt(0, 0, 0);
  g.police.reportPlayerShot(0, new T.Vector3(0, 1.5, 0));
  const afterShot = g.police.wantedLevel;

  const first = witness;
  g.police.damagePolice(first.id, 25);
  const afterHit = g.police.wantedLevel;
  g.police.damagePolice(first.id, 25);
  const afterFirstKill = g.police.wantedLevel;

  g.police.spawnNear(new T.Vector3(0, 1.5, 0), 1);
  const second = g.police.getBots().find((bot) => !bot.dead);
  g.police.damagePolice(second.id, 50);
  const afterSecondKill = g.police.wantedLevel;

  g.police.spawnNear(new T.Vector3(0, 1.5, 0), 2);
  g.police.spawnNear(new T.Vector3(0, 1.5, 0), 3);
  for (const bot of g.police.getBots().filter((bot) => !bot.dead).slice(0, 2)) {
    g.police.damagePolice(bot.id, 50);
  }
  const afterFourKills = g.police.wantedLevel;

  return {
    afterShot,
    afterHit,
    afterFirstKill,
    afterSecondKill,
    afterFourKills,
    policeKills: g.police.policeKills,
  };
});

console.log(JSON.stringify(result, null, 2));
await browser.close();
