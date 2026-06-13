import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'jar';
fs.mkdirSync(OUT, { recursive: true });
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run(label, vw, vh, stops) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: [`--window-size=${vw},${vh}`, '--hide-scrollbars', '--force-color-profile=srgb'],
    defaultViewport: { width: vw, height: vh, deviceScaleFactor: 2 },
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 5200));
  const topH = await page.evaluate(() => document.querySelector('.top').offsetHeight - innerHeight);
  for (const [name, frac] of stops) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(topH * frac));
    await new Promise((r) => setTimeout(r, 1700));
    await page.screenshot({ path: path.join(OUT, `${label}-${name}.png`) });
  }
  // a static section for mobile layout
  if (label === 'm') {
    await page.evaluate(() => document.querySelector('.features').scrollIntoView());
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(OUT, 'm-features.png') });
  }
  console.log(`${label}: ${errors.length ? errors.join('; ') : 'no errors'}`);
  await browser.close();
}

await run('d', 1600, 900, [['product', 0.79], ['home', 0.95], ['healthy', 0.995]]);
await run('m', 390, 844, [['hero', 0.0], ['lab', 0.30], ['bioreactor', 0.56], ['product', 0.79], ['healthy', 0.99]]);
console.log('done');
