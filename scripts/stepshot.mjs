import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'step';
fs.mkdirSync(OUT, { recursive: true });
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

async function run(label, viewport, stops) {
  const browser = await puppeteer.launch({
    executablePath: CHROME, headless: 'new',
    args: [`--window-size=${viewport.width},${viewport.height}`, '--hide-scrollbars', '--force-color-profile=srgb'],
    defaultViewport: viewport,
  });
  const page = await browser.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
  await page.goto('http://localhost:5173', { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise((r) => setTimeout(r, 5400));
  // is the page actually visible (loader gone, not locked)?
  const state = await page.evaluate(() => ({
    locked: document.body.classList.contains('is-locked'),
    loaderY: document.getElementById('loader')?.getBoundingClientRect().top,
    noWebgl: document.documentElement.classList.contains('no-webgl'),
  }));
  const topH = await page.evaluate(() => document.querySelector('.top').offsetHeight - innerHeight);
  for (const [name, frac] of stops) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(topH * frac));
    await new Promise((r) => setTimeout(r, 1600));
    await page.screenshot({ path: path.join(OUT, `${label}-${name}.png`) });
  }
  console.log(`${label}: locked=${state.locked} loaderTop=${state.loaderY} noWebgl=${state.noWebgl} errors=${errs.length ? errs.join(' | ') : 'none'}`);
  await browser.close();
}

await run('d', { width: 1600, height: 900, deviceScaleFactor: 1 }, [['steps', 0.56]]);
await run('m', { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, [['hero', 0.0], ['steps', 0.5], ['product', 0.79]]);
console.log('done');
