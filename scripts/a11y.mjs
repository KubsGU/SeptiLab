import puppeteer from 'puppeteer-core';
import { AxePuppeteer } from '@axe-core/puppeteer';

const b = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new', defaultViewport: { width: 1366, height: 900 },
});
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
await p.goto('http://localhost:5173', { waitUntil: 'networkidle2' });
await new Promise((r) => setTimeout(r, 5600)); // let the loader finish

const results = await new AxePuppeteer(p).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']).analyze();
console.log('CONSOLE ERRORS:', errs.length ? errs.join(' | ') : 'none');
console.log('VIOLATIONS:', results.violations.length);
for (const v of results.violations) {
  console.log(`\n[${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} node(s))`);
  v.nodes.slice(0, 3).forEach((n) => console.log('   ', n.target.join(' '), '::', (n.failureSummary || '').replace(/\n/g, ' ').slice(0, 140)));
}
await b.close();
