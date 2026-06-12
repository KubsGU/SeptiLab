/* Second-stage checks: loader frame, hover parallax diff, FPS at the
   heaviest view, and a sweep of mid-transition frames. */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'shots-extra';
fs.mkdirSync(OUT, { recursive: true });

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--window-size=1600,900', '--hide-scrollbars', '--force-color-profile=srgb'],
  defaultViewport: { width: 1600, height: 900 },
});

const page = await browser.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto('http://localhost:5173', { waitUntil: 'networkidle2' });

// loader mid-animation
await new Promise((r) => setTimeout(r, 1100));
await page.screenshot({ path: path.join(OUT, 'loader.png') });

await new Promise((r) => setTimeout(r, 4500));

// hover parallax: hero with mouse far left vs far right
await page.mouse.move(120, 450);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: path.join(OUT, 'parallax-left.png') });
await page.mouse.move(1480, 450);
await new Promise((r) => setTimeout(r, 1200));
await page.screenshot({ path: path.join(OUT, 'parallax-right.png') });

// FPS at grid pulse (heaviest: shadows + instancing + bloom + ring)
const topH = await page.evaluate(() => document.querySelector('.top').offsetHeight - innerHeight);
await page.evaluate((y) => window.scrollTo(0, y), Math.round(topH * 0.7));
await new Promise((r) => setTimeout(r, 1800));
const fps = await page.evaluate(
  () =>
    new Promise((res) => {
      let frames = 0;
      const t0 = performance.now();
      const tick = () => {
        frames++;
        if (performance.now() - t0 < 2000) requestAnimationFrame(tick);
        else res((frames / (performance.now() - t0)) * 1000);
      };
      requestAnimationFrame(tick);
    })
);

// mid-transition sweep
for (const frac of [0.22, 0.36, 0.44, 0.57, 0.64, 0.78, 0.87, 0.95]) {
  await page.evaluate((y) => window.scrollTo(0, y), Math.round(topH * frac));
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: path.join(OUT, `sweep-${String(frac).replace('.', '')}.png`) });
}

console.log(`FPS at grid view: ${fps.toFixed(1)}`);
console.log('CONSOLE ERRORS:', errors.length ? errors.join('\n') : '(none)');
await browser.close();
