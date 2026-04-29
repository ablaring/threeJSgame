/**
 * Render each weapon mesh from /src/entities/*.ts to a PNG that we use as the
 * NFT image. Run while `npm run dev` is up; the script just navigates puppeteer
 * to /nft-render.html?weapon=<id>&size=1024 and grabs the canvas.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = resolve(__dirname, '..', 'public', 'nft');
mkdirSync(OUT_DIR, { recursive: true });

const URL = process.env.URL || 'http://localhost:5173';
const SIZE = parseInt(process.env.SIZE || '1024', 10);
const WEAPONS = ['pistol', 'ak47', 'rocket-launcher'];

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

try {
  for (const weapon of WEAPONS) {
    const page = await browser.newPage();
    page.on('console', (m) => console.log(`  [${weapon}] ${m.type()}: ${m.text()}`));
    page.on('pageerror', (e) => console.log(`  [${weapon}] ERR: ${e.message}`));
    await page.setViewport({ width: SIZE, height: SIZE, deviceScaleFactor: 1 });
    const target = `${URL}/nft-render.html?weapon=${weapon}&size=${SIZE}`;
    await page.goto(target, { waitUntil: 'networkidle0' });
    await page.waitForFunction('window.__NFT_RENDER_READY__ === true', { timeout: 10000 });
    // Wait a frame so the WebGL render lands in the canvas.
    await new Promise((r) => setTimeout(r, 200));

    const dataUrl = await page.evaluate(() => window.__NFT_CANVAS__.toDataURL('image/png'));
    const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
    const out = resolve(OUT_DIR, `${weapon}.png`);
    writeFileSync(out, Buffer.from(base64, 'base64'));
    console.log(`✓ ${weapon}.png (${SIZE}x${SIZE})`);
    await page.close();
  }
} finally {
  await browser.close();
}
