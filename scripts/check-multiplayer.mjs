import puppeteer from 'puppeteer';

const URL = process.env.URL || 'http://localhost:5174';
const WAIT = parseInt(process.env.WAIT || '5000');

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });

async function openClient(label) {
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (msg) => logs.push(`[${label}] ${msg.type()}: ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[${label}] PAGEERROR: ${err.message}`));
  await page.setViewport({ width: 800, height: 600 });
  await page.goto(URL, { waitUntil: 'networkidle0' });
  return { page, logs };
}

const a = await openClient('A');
const b = await openClient('B');

await new Promise(r => setTimeout(r, WAIT));

console.log('--- CLIENT A ---');
a.logs.forEach(l => console.log(l));
console.log('--- CLIENT B ---');
b.logs.forEach(l => console.log(l));

await browser.close();
