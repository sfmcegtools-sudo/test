#!/usr/bin/env node
// Playwright frame dump: for each output frame f and subframe k, seek((f + k/SUB)/60),
// wait two rAFs, screenshot → out/frames/sub_%05d.png (index f*SUB + k).
//   node render.js [--start 0] [--end 479] [--sub 4] [--out out/frames] [--resume]
'use strict';
const fs = require('fs');
const path = require('path');
const { openStage, seekAndSettle } = require('./browser');

function arg(name, def) {
  const i = process.argv.indexOf('--' + name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : def;
}

async function main() {
  const FPS = 60;
  const start = parseInt(arg('start', '0'), 10);
  const end = parseInt(arg('end', '479'), 10);
  const sub = parseInt(arg('sub', '4'), 10);
  const outDir = path.resolve(__dirname, arg('out', 'out/frames'));
  const resume = process.argv.includes('--resume');
  if (!(end >= start && start >= 0 && sub >= 1)) throw new Error('bad --start/--end/--sub');
  fs.mkdirSync(outDir, { recursive: true });

  const { browser, page } = await openStage();
  const total = (end - start + 1) * sub;
  const t0 = Date.now();
  let done = 0;
  try {
    for (let f = start; f <= end; f++) {
      for (let k = 0; k < sub; k++) {
        const idx = f * sub + k;
        const file = path.join(outDir, `sub_${String(idx).padStart(5, '0')}.png`);
        done++;
        if (resume && fs.existsSync(file) && fs.statSync(file).size > 0) continue;
        const t = (f + k / sub) / FPS;
        await seekAndSettle(page, t);
        await page.screenshot({ path: file, type: 'png' });
      }
      if ((f - start) % 30 === 29 || f === end) {
        const el = (Date.now() - t0) / 1000;
        const eta = (el / done) * (total - done);
        process.stdout.write(`frame ${f}/${end}  ${done}/${total} subframes  ${el.toFixed(0)}s elapsed  ~${eta.toFixed(0)}s left\n`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
