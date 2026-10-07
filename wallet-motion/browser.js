// Shared Playwright launcher for render.js / stills.js / checks.js.
// Loads index.html over file:// (no network), 1080×1920 @ DPR 1, waits for fonts + window.__ready.
'use strict';
const fs = require('fs');
const path = require('path');

function loadPlaywright() {
  try { return require('playwright'); } catch (e) { /* fall through */ }
  return require('/opt/node22/lib/node_modules/playwright');
}

function findChromium() {
  const candidates = [
    process.env.CHROMIUM_PATH,
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium/chrome-linux/chrome',
  ].filter(Boolean);
  return candidates.find((p) => fs.existsSync(p));
}

async function openStage({ query = '' } = {}) {
  const { chromium } = loadPlaywright();
  const executablePath = findChromium();
  const browser = await chromium.launch({
    ...(executablePath ? { executablePath } : {}),
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none'],
  });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (err) => console.error('[page error]', err.message));
  page.on('console', (msg) => { if (msg.type() === 'error') console.error('[console]', msg.text()); });
  const url = 'file://' + path.join(__dirname, 'index.html') + (query ? '?' + query : '');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  return { browser, page };
}

/** seek(t) then wait two animation frames so the compositor has the new state. */
async function seekAndSettle(page, t) {
  await page.evaluate((tt) => new Promise((resolve) => {
    window.seek(tt);
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  }), t);
}

module.exports = { openStage, seekAndSettle };
