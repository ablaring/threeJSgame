import puppeteer from 'puppeteer';

const URL = process.env.URL || `http://localhost:${process.env.PORT || 5173}`;
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();

page.on('console', (msg) => console.log(`[page:${msg.type()}] ${msg.text()}`));
page.on('pageerror', (err) => console.error(`[pageerror] ${err.stack || err.message}`));

await page.setViewport({ width: 1280, height: 720 });
await page.evaluateOnNewDocument(() => {
  const pubkey = 'ArrestTest111111111111111111111111111111';
  const provider = {
    isPhantom: true,
    publicKey: { toBase58: () => pubkey },
    isConnected: true,
    connect: async () => ({ publicKey: { toBase58: () => pubkey } }),
    disconnect: async () => {},
    on: () => {},
    off: () => {},
  };
  window.phantom = { solana: provider };
});

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForSelector('#connect-screen button', { timeout: 10000 });
await page.evaluate(() => document.querySelector('#connect-screen button')?.click());
await page.waitForFunction(() => window.__GAME__?.fugitiveMission && window.__GAME__?.player);
await new Promise((r) => setTimeout(r, 800));

await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(-108.7, 1.4, 82.4);
});
await page.keyboard.down('KeyP');
await new Promise((r) => setTimeout(r, 140));
await page.keyboard.up('KeyP');
await new Promise((r) => setTimeout(r, 600));

const calledCz = await page.evaluate(() => window.__GAME__.fugitiveMission.getStatus());
console.log('after CZ P:', calledCz);

await new Promise((r) => setTimeout(r, 18000));
const afterCz = await page.evaluate(() => window.__GAME__.fugitiveMission.getStatus());
console.log('after CZ arrest:', afterCz);

await page.evaluate(() => {
  const g = window.__GAME__;
  g.player.teleport(101.2, 4.3, 56.6);
});
await page.keyboard.down('KeyP');
await new Promise((r) => setTimeout(r, 140));
await page.keyboard.up('KeyP');
await new Promise((r) => setTimeout(r, 600));

const calledSam = await page.evaluate(() => window.__GAME__.fugitiveMission.getStatus());
console.log('after Sam P:', calledSam);

await new Promise((r) => setTimeout(r, 12000));
const finalStatus = await page.evaluate(() => window.__GAME__.fugitiveMission.getStatus());
console.log('final:', finalStatus);

await browser.close();

const cz = finalStatus.find((item) => item.id === 'cz-binance');
const sam = finalStatus.find((item) => item.id === 'sam-ftx');
if (!cz || cz.state !== 'arrested' || !sam || sam.state !== 'arrested') process.exitCode = 1;
