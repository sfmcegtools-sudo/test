#!/usr/bin/env node
// Render validation stills (single sample, no motion blur).
//   node stills.js                 → the spec's validation timestamps
//   node stills.js 2.0 4.6 6.65    → custom times (seconds)
//   node stills.js --check         → determinism check: render times twice (other seeks in between), compare PNG bytes
// Output: out/stills/t_<time>.png (1080×1920) + out/stills/small/t_<time>.png (540×960, for quick review).
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { openStage, seekAndSettle } = require('./browser');

const DEFAULT_TIMES = [0.4, 1.0, 1.7, 2.2, 2.55, 3.3, 3.9, 4.35, 4.5, 5.0, 5.5, 6.2, 6.6, 7.1, 7.9];
const OUT = path.join(__dirname, 'out', 'stills');
const SMALL = path.join(OUT, 'small');

const label = (t) => t.toFixed(2);

async function main() {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const custom = args.filter((a) => !a.startsWith('--')).map(Number).filter((n) => Number.isFinite(n));
  const times = custom.length ? custom : DEFAULT_TIMES;
  fs.mkdirSync(SMALL, { recursive: true });

  const { browser, page } = await openStage();
  try {
    if (check) {
      const probe = custom.length ? custom : [1.7, 3.9, 4.35, 5.0, 6.2, 7.1];
      const first = [];
      for (const t of probe) { await seekAndSettle(page, t); first.push(await page.screenshot({ type: 'png' })); }
      // Scramble the order and revisit: any state leaking between frames would show up here.
      for (const t of [7.9, 0.4, 2.55]) await seekAndSettle(page, t);
      let ok = true;
      for (let i = probe.length - 1; i >= 0; i--) {
        await seekAndSettle(page, probe[i]);
        const again = await page.screenshot({ type: 'png' });
        const same = Buffer.compare(first[i], again) === 0;
        ok = ok && same;
        console.log(`t=${label(probe[i])}  ${same ? 'identical' : 'DIFFERENT'}  (${first[i].length} bytes)`);
      }
      console.log(ok ? 'DETERMINISM: PASS' : 'DETERMINISM: FAIL');
      process.exitCode = ok ? 0 : 1;
      return;
    }
    for (const t of times) {
      await seekAndSettle(page, t);
      const file = path.join(OUT, `t_${label(t)}.png`);
      await page.screenshot({ path: file, type: 'png' });
      const small = path.join(SMALL, `t_${label(t)}.png`);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', file, '-vf', 'scale=540:960:flags=lanczos', small]);
      console.log('wrote', path.relative(__dirname, file));
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
