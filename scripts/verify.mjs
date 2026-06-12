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
  ['05-hero-mid', 0.045],
  ['10-flight-to-hq', 0.17],
  ['15-step1-hq', 0.30],
  ['20-step1-end', 0.40],
  ['25-step2-warehouse', 0.50],
  ['30-step2-end', 0.60],
  ['35-step3-grid', 0.68],
  ['40-step3-pulse', 0.74],
  ['45-step4-travel', 0.83],
  ['50-step4-beam', 0.91],
  ['55-step4-end', 0.985],
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
