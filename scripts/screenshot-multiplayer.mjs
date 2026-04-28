import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const OUT = process.argv[2] || 'debug/multiplayer.png';

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

// Open "ghost" client B first — it stays still at spawn
const pageB = await browser.newPage();
pageB.on('console', (m) => console.log(`[B] ${m.type()}: ${m.text()}`));
await pageB.setViewport({ width: 800, height: 600 });
await pageB.goto(URL, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 3000));

// Move ghost B forward a bit by teleporting it via the debug global
await pageB.evaluate(() => {
  // @ts-ignore
  const g = window.__GAME__;
  if (g && g.player) g.player.teleport(3, 2, 0);
});
await new Promise(r => setTimeout(r, 1500));

// Open client A — it should see B at (3, 2, 0)
const pageA = await browser.newPage();
pageA.on('console', (m) => console.log(`[A] ${m.type()}: ${m.text()}`));
await pageA.setViewport({ width: 1280, height: 720 });
await pageA.goto(URL, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 4000));

// Force one render and snap
await pageA.evaluate(() => {
  // @ts-ignore
  const g = window.__GAME__;
  if (g && g.renderOnce) g.renderOnce();
});

await pageA.screenshot({ path: OUT, fullPage: false });
console.log(`Screenshot saved: ${OUT}`);

await browser.close();
