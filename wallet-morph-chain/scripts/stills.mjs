#!/usr/bin/env node
// Validation stills → out/stills/t_<t>.png (1080×1080) + out/stills/small/t_<t>.png (540×540).
//   node scripts/stills.mjs                 # 17 brief times, captured at DPR 2, lanczos-downscaled
//   node scripts/stills.mjs --fast          # DPR 1 capture (quick iteration)
//   node scripts/stills.mjs 2.45 3.95       # extra times (positional)
//   node scripts/stills.mjs --only 4.2 4.6  # only the listed times
// Also runs layout checks (stats panel / bubbles inside the map card, no label collisions) and
// reports whether t=0.0 and t=7.0 are byte-identical.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { ROOT, openStage, seekAndPaint } from './lib.mjs';

const BRIEF_TIMES = [0.0, 0.35, 0.7, 1.2, 1.6, 1.95, 2.3, 2.7, 3.1, 3.7, 4.2, 4.6, 5.0, 5.6, 6.1, 6.6, 7.0];
const fast = process.argv.includes('--fast');
const only = process.argv.includes('--only');
const extra = process.argv.slice(2).filter((a) => /^-?\d+(\.\d+)?$/.test(a)).map(Number);
const times = only ? extra : [...new Set([...BRIEF_TIMES, ...extra])].sort((a, b) => a - b);
const dsf = fast ? 1 : 2;

const OUT = path.join(ROOT, 'out', 'stills');
const SMALL = path.join(OUT, 'small');
fs.mkdirSync(SMALL, { recursive: true });

function ffmpegScale(input, size, outFile) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'png_pipe', '-i', '-',
    '-vf', `scale=${size}:${size}:flags=lanczos`, '-frames:v', '1', outFile], { input });
  if (r.status !== 0) throw new Error('ffmpeg failed: ' + r.stderr.toString());
}

/* ── geometry checks ── */
function inside(poly, [x, y]) {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
}
const corners = (r) => {
  const a = ((r.rot || 0) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return [[0, 0], [r.w, 0], [r.w, r.h], [0, r.h]].map(([u, v]) => [r.x + u * c - v * s, r.y + u * s + v * c]);
};
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

const distToRect = (r, [x, y]) => {
  const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h));
  return Math.hypot(dx, dy);
};
function check(info) {
  const issues = [];
  if (info.outline) {
    const vis = (o) => o && o.op > 0.05; // ignore elements that are effectively gone
    const bubbles = info.bubbles.filter(vis);
    if (vis(info.panel) && !corners(info.panel).every((p) => inside(info.outline, p))) issues.push('panel corner outside card (clip-path engaged)');
    bubbles.forEach((b, i) => { if (!corners(b).every((p) => inside(info.outline, p))) issues.push(`bubble ${i} outside card`); });
    if (bubbles.length === 2 && overlap(bubbles[0], bubbles[1])) issues.push('bubbles collide');
    if (vis(info.panel)) bubbles.forEach((b, i) => { if (overlap(b, info.panel)) issues.push(`bubble ${i} overlaps panel`); });
    if (vis(info.panel) && info.routePts) {
      const dmin = Math.min(...info.routePts.map((p) => distToRect(info.panel, p)));
      if (dmin < 18) issues.push(`route within ${dmin.toFixed(1)}px of panel`);
    }
    if (info.routePts) bubbles.forEach((b, i) => {
      const dmin = Math.min(...info.routePts.slice(1, -1).map((p) => distToRect(b, p)));
      if (dmin < 6) issues.push(`route touches bubble ${i}`);
    });
  }
  return issues;
}

const fmt = (t) => t.toFixed(2);
const { page, close } = await openStage({ dsf });
const raw = {};
let failures = 0;
try {
  for (const t of times) {
    const info = await seekAndPaint(page, t);
    const buf = await page.screenshot({ type: 'png' });
    raw[fmt(t)] = buf;
    const file = path.join(OUT, `t_${fmt(t)}.png`);
    if (dsf === 1) fs.writeFileSync(file, buf);
    else ffmpegScale(buf, 1080, file);
    ffmpegScale(buf, 540, path.join(SMALL, `t_${fmt(t)}.png`));
    const issues = check(info);
    failures += issues.length;
    const h = info.hero;
    console.log(`t=${fmt(t)}  hero ${h.w.toFixed(0)}×${h.h.toFixed(0)} @(${h.cx.toFixed(0)},${h.cy.toFixed(0)}) op ${h.opacity.toFixed(2)} blur ${h.blur.toFixed(1)} rx ${h.rx.toFixed(1)} rz ${h.rot.toFixed(1)}` +
      (info.route > 0 ? `  route ${(info.route * 100).toFixed(0)}%` : '') +
      (info.camera.z > 1.0001 ? `  zoom ${info.camera.z.toFixed(2)}` : '') +
      (issues.length ? `  !! ${issues.join('; ')}` : ''));
  }
  // dense layout sweep over the map segments (catches transient collisions between stills)
  if (!only) {
    for (let t = 4.0; t < 7.0; t += 1 / 60) {
      const info = await page.evaluate((tt) => window.seek(tt), t);
      const issues = check(info);
      if (issues.length) { failures += issues.length; console.log(`sweep t=${t.toFixed(3)}: ${issues.join('; ')}`); }
    }
  }
} finally {
  await close();
}

if (raw['0.00'] && raw['7.00']) {
  const a = fs.readFileSync(path.join(OUT, 't_0.00.png')), b = fs.readFileSync(path.join(OUT, 't_7.00.png'));
  console.log(`loop check: t=0.0 vs t=7.0 capture ${raw['0.00'].equals(raw['7.00']) ? 'IDENTICAL' : 'DIFFERENT'}, ` +
    `stills ${a.equals(b) ? 'byte-identical' : 'DIFFERENT'}`);
  if (!a.equals(b)) failures++;
}
console.log(failures ? `${failures} issue(s) found` : 'all checks passed');
process.exitCode = failures ? 1 : 0;
