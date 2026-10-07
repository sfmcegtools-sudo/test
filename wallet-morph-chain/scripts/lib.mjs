// Shared capture helpers: a tiny local static server (127.0.0.1 only — ES modules cannot load
// from file://), Playwright launch, and a seek-then-paint helper. No external network.

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.otf': 'font/otf', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json',
};

export function startServer(root = ROOT) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      const file = path.join(root, rel === '/' ? 'index.html' : rel);
      if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        res.writeHead(404);
        return res.end('not found');
      }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      fs.createReadStream(file).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/` }));
  });
}

function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    return require('/opt/node22/lib/node_modules/playwright');
  }
}

/** Launch Chromium, open the stage at 1080×1080 and wait until fonts + scene are ready. */
export async function openStage({ dsf = 2 } = {}) {
  const { server, url } = await startServer();
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    args: ['--force-color-profile=srgb', '--hide-scrollbars', '--font-render-hinting=none', '--disable-lcd-text'],
  });
  const context = await browser.newContext({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: dsf });
  const page = await context.newPage();
  const external = [];
  await page.route('**/*', (route) => {
    const u = route.request().url();
    if (u.startsWith(url)) return route.continue();
    external.push(u);
    return route.abort();
  });
  page.on('pageerror', (e) => console.error('[page error]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error('[console]', m.text()); });
  await page.goto(url + 'index.html', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ready === true || window.__error, null, { timeout: 30000 });
  const err = await page.evaluate(() => window.__error || null);
  if (err) throw new Error(err);
  await page.evaluate(() => document.fonts.ready);
  const close = async () => {
    await browser.close();
    server.close();
    if (external.length) console.error(`blocked ${external.length} external request(s):`, external.slice(0, 5));
  };
  return { browser, page, close, external };
}

/** seek(t), then wait two animation frames so the compositor has painted the new state. */
export async function seekAndPaint(page, t) {
  return page.evaluate((tt) => new Promise((resolve) => {
    const info = window.seek(tt);
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(info)));
  }), t);
}

export function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}
