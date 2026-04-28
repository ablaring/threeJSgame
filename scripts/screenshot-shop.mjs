import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

const FAKE_PUBKEY = 'Hxc7w9z4ABqV2zd3RJ9XKJP1nBaxzNB1abc4QQ8K9wYz';

const page = await browser.newPage();
page.on('console', (m) => console.log(`${m.type()}: ${m.text()}`));
page.on('pageerror', (e) => console.log(`ERR: ${e.message}`));
await page.setViewport({ width: 1280, height: 720 });

await page.evaluateOnNewDocument((pk) => {
  const provider = {
    isPhantom: true,
    publicKey: { toBase58: () => pk },
    isConnected: true,
    connect: async () => ({ publicKey: { toBase58: () => pk } }),
    disconnect: async () => {},
    on: () => {},
    off: () => {},
  };
  window.phantom = { solana: provider };
  // Clear inventory so we screenshot the empty state
  try { localStorage.removeItem(`inventory:${pk}`); } catch (_) {}
}, FAKE_PUBKEY);

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await new Promise(r => setTimeout(r, 2500));
// Click "Enter game"
await page.evaluate(() => document.querySelector('#connect-screen button')?.click());
await new Promise(r => setTimeout(r, 4000));

// Open shop with B
await page.keyboard.press('KeyB');
await new Promise(r => setTimeout(r, 600));
await page.screenshot({ path: 'debug/shop-empty.png' });
console.log('Saved debug/shop-empty.png');

// Buy AK47
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('#shop-screen button'));
  const ak = btns.find((b) => b.textContent === 'Buy');
  ak?.click();
});
await new Promise(r => setTimeout(r, 800));

// Buy Rocket Launcher
await page.evaluate(() => {
  const btns = Array.from(document.querySelectorAll('#shop-screen button'));
  const rl = btns.find((b) => b.textContent === 'Buy');
  rl?.click();
});
await new Promise(r => setTimeout(r, 800));

await page.screenshot({ path: 'debug/shop-both-owned.png' });
console.log('Saved debug/shop-both-owned.png');

// Close shop with B again
await page.keyboard.press('KeyB');
await new Promise(r => setTimeout(r, 400));
await page.screenshot({ path: 'debug/shop-closed.png' });
console.log('Saved debug/shop-closed.png');

await browser.close();
