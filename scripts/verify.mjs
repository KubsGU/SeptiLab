/* Drives system Chrome via the DevTools protocol: loads the dev server,
   collects console errors, and screenshots the experience at a series of
   scroll positions. Usage: node scripts/verify.mjs [outDir] */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'shots';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--window-size=1600,900', '--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: { width: 1600, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') errors.push(`[${msg.type()}] ${msg.text()}`);
});
page.on('pageerror', (err) => errors.push(`[pageerror] ${err.message}`));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });

// let the loader finish + intro play
await new Promise((r) => setTimeout(r, 5200));
await page.screenshot({ path: path.join(OUT, '00-hero.png') });

// total scrollable .top range = element height - viewport
const topH = await page.evaluate(() => document.querySelector('.top').offsetHeight - innerHeight);

const stops = [
  ['05-nature', 0.16],
  ['10-lab', 0.30],
  ['15-inoc', 0.43],
  ['20-bioreactor', 0.56],
  ['25-drying', 0.67],
  ['30-product', 0.79],
  ['35-home-arrive', 0.86],
  ['40-home-dose', 0.90],
  ['45-home-magic', 0.95],
  ['50-home-healthy', 0.995],
];

for (const [name, frac] of stops) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(topH * frac));
  await new Promise((r) => setTimeout(r, 1700)); // allow scrub + lerp to settle
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
}

// below-the-fold sections
await page.evaluate(() => {
  document.querySelector('.features').scrollIntoView({ block: 'start' });
});
await new Promise((r) => setTimeout(r, 1400));
await page.screenshot({ path: path.join(OUT, '60-features.png') });

await page.evaluate(() => {
  document.querySelector('.footer').scrollIntoView({ block: 'end' });
});
await new Promise((r) => setTimeout(r, 1400));
await page.screenshot({ path: path.join(OUT, '70-footer.png') });

console.log('CONSOLE ISSUES:');
console.log(errors.length ? errors.join('\n') : '(none)');
await browser.close();
