import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const a = await browser.newPage();
const b = await browser.newPage();
const aLogs = [], bLogs = [];
a.on('console', (m) => aLogs.push(`[A] ${m.type()}: ${m.text()}`));
b.on('console', (m) => bLogs.push(`[B] ${m.type()}: ${m.text()}`));
a.on('pageerror', (e) => aLogs.push(`[A] ERR: ${e.message}`));
b.on('pageerror', (e) => bLogs.push(`[B] ERR: ${e.message}`));

await a.goto(URL, { waitUntil: 'networkidle0' });
await b.goto(URL, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));

// Position B at (5, 1.5, 0) and report sessionId
const bInfo = await b.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(5, 1.5, 0);
  return { sessionId: g.network.sessionId, health: g.player.health };
});
console.log('B before:', bInfo);

await new Promise(r => setTimeout(r, 1500));

// A fires 4 shots at B's position over time (should kill B: 4 * 25 = 100 damage)
await a.evaluate((targetId) => {
  const g = window.__GAME__;
  for (let i = 0; i < 4; i++) {
    setTimeout(() => {
      g.network.sendFire({
        weapon: 0,
        ox: 0, oy: 1.6, oz: 0,
        dx: 1, dy: 0, dz: 0,
        hitTargetId: targetId,
        hpx: 5, hpy: 1.5, hpz: 0,
      });
    }, i * 150);
  }
}, bInfo.sessionId);

await new Promise(r => setTimeout(r, 2000));

const bAfter = await b.evaluate(() => ({
  health: window.__GAME__.player.health,
  dead: window.__GAME__.player.dead,
}));
console.log('B after 4 shots:', bAfter);

// Wait for respawn (3s) + a bit
await new Promise(r => setTimeout(r, 3500));

const bRespawned = await b.evaluate(() => ({
  health: window.__GAME__.player.health,
  dead: window.__GAME__.player.dead,
}));
console.log('B after respawn:', bRespawned);

console.log('--- A logs ---');
aLogs.slice(-20).forEach(l => console.log(l));
console.log('--- B logs ---');
bLogs.slice(-20).forEach(l => console.log(l));

await browser.close();
