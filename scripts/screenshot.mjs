import puppeteer from 'puppeteer';

const PORT = process.env.PORT || 5173;
const OUT  = process.argv[2] || 'screenshot.png';
const WAIT = parseInt(process.argv[3] || '2000');

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page    = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
await page.goto(`http://localhost:${PORT}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__GAME__?.renderOnce, { timeout: Math.max(WAIT, 2000) }).catch(() => {});
await new Promise(r => setTimeout(r, WAIT));
await page.screenshot({ path: OUT, fullPage: false });
await browser.close();
console.log(`Screenshot saved: ${OUT}`);
