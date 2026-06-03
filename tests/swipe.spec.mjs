// Real-browser touch test for the card photo-strip swipe (Chromium = Brave's engine).
// Emulates a touchscreen and dispatches genuine touch input via CDP, so it exercises the
// browser's real touch-action gesture handling — the thing that broke the swipe on touch.
//
//   # one-time: npm install playwright && npx playwright install chromium
//   python3 -m http.server 8077 &        # serve the repo
//   node tests/swipe.spec.mjs            # BASE defaults to http://localhost:8077
//
// Asserts: a horizontal swipe steps the season photo (both directions); a vertical drag
// leaves the photo alone and scrolls the page (no scroll-chaining). Exits non-zero on failure.
import { chromium } from 'playwright';

const BASE = process.env.BASE || 'http://localhost:8077';
const browser = await chromium.launch();
const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 412, height: 892 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const client = await ctx.newCDPSession(page);
let fails = 0;
const ok = (c, m) => { console.log((c ? '  ✓ ' : '  ✗ ') + m); if (!c) fails++; };

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.waitForSelector('.card .reel', { timeout: 20000 });

// pick the first card whose reel has >1 season photo, and scroll it into view
const found = await page.evaluate(() => {
  for (const r of document.querySelectorAll('.reel')) {
    if (r.querySelectorAll('.shot').length > 1) { r.id = '__swipetest'; r.scrollIntoView({ block: 'center' }); return true; }
  }
  return false;
});
if (!found) { console.log('NO multi-shot reel found — cannot test'); await browser.close(); process.exit(2); }
await page.waitForTimeout(250);

const box = await page.evaluate(() => { const b = document.getElementById('__swipetest').getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
const activeIdx = () => page.evaluate(() => [...document.getElementById('__swipetest').querySelectorAll('.shot')].findIndex(s => s.classList.contains('show')));
const scrollY = () => page.evaluate(() => window.scrollY);

// sanity: the touch point must actually land on the reel image
const hit = await page.evaluate(([x, y]) => { const el = document.elementFromPoint(x, y); return !!(el && el.closest && el.closest('#__swipetest')); }, [box.x + box.w * 0.5, box.y + box.h * 0.5]);
ok(hit, 'reel is on-screen and under the touch point');

async function touchDrag(fromX, fromY, toX, toY) {
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fromX, y: fromY }] });
  for (let i = 1; i <= 8; i++) {
    await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: fromX + (toX - fromX) * i / 8, y: fromY + (toY - fromY) * i / 8 }] });
    await page.waitForTimeout(14);
  }
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(180);
}

const cy = box.y + box.h * 0.5, RX = box.x + box.w * 0.82, LX = box.x + box.w * 0.18;
const start = await activeIdx();

await touchDrag(RX, cy, LX, cy);                                   // swipe right→left
ok((await activeIdx()) === start + 1, 'swipe right→left advances to the next photo');

await touchDrag(LX, cy, RX, cy);                                   // swipe left→right
ok((await activeIdx()) === start, 'swipe left→right returns to the previous photo');

const beforeV = await activeIdx(), y0 = await scrollY();
await touchDrag(box.x + box.w * 0.5, cy, box.x + box.w * 0.5, cy - 260);   // vertical drag
ok((await activeIdx()) === beforeV, 'vertical drag does not change the photo');
ok((await scrollY()) > y0, 'vertical drag scrolls the page (no scroll-chaining)');

await browser.close();
console.log(fails ? `\nFAIL (${fails})` : '\nPASS — card swipe works under real touch input');
process.exit(fails ? 1 : 0);
