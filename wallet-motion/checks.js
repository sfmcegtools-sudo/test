#!/usr/bin/env node
// Numeric validation of the timeline (spec § Validation 2–6), run in the real page.
//   node checks.js
'use strict';
const { openStage } = require('./browser');

async function main() {
  const { browser, page } = await openStage();
  const results = await page.evaluate(() => {
    const wm = window.__wm;
    const out = [];
    const ok = (name, pass, detail) => out.push({ name, pass: !!pass, detail });
    const F = 1 / 60;
    const st = (sel) => getComputedStyle(document.querySelector(sel));
    const vis = (sel) => st(sel).visibility === 'visible' && parseFloat(st(sel).opacity) > 0.01;

    // ── 2 · states hit their times (± 1 frame) ─────────────────────────
    seek(1.40 + F); ok('brackets fully drawn by 1.40', document.querySelector('#fid-brackets path').getAttribute('stroke-dasharray').startsWith(String(+document.querySelector('#fid-brackets path').getTotalLength().toFixed(4))), document.querySelector('#fid-brackets path').getAttribute('stroke-dasharray'));
    seek(2.35); ok('checkmark complete at 2.35', +document.querySelector('#fid-check').getAttribute('stroke-dashoffset') < 0.5, document.querySelector('#fid-check').getAttribute('stroke-dashoffset'));
    seek(3.40); {
      const tr = ['#card-red', '#card-green', '#card-blue'].map((s) => document.querySelector(s).style.transform);
      const m = tr.map((x) => x.match(/translateY\(([-\d.]+)px\) rotate\(([-\d.]+)deg\)/)).map((r) => r && [+r[1], +r[2]]);
      const want = [[-220, -6], [-130, -3], [-40, 0]];
      ok('card fan at final offsets by 3.40 (±1px, ±0.1°)', m.every((v, i) => v && Math.abs(v[0] - want[i][0]) < 1 && Math.abs(v[1] - want[i][1]) < 0.1), JSON.stringify(m));
    }
    seek(3.75); ok('black card at rest by 3.75 (±2px; spring tail)', (() => { const x = document.querySelector('#card-black').style.transform; const v = x === 'none' ? 0 : +x.match(/([-\d.]+)px/)[1]; return Math.abs(v) < 2; })(), document.querySelector('#card-black').style.transform);
    { let maxOver = 0; for (let t = 3.2; t <= 4.2; t += 1 / 240) { seek(t); const x = document.querySelector('#card-black').style.transform; const v = x === 'none' ? 0 : +x.match(/([-\d.]+)px/)[1]; maxOver = Math.max(maxOver, -v); } ok('black card overshoot ≤ 12px', maxOver <= 12, maxOver.toFixed(3) + 'px'); }
    seek(4.05); ok('balance reads $12,480.50 at 4.05', document.querySelector('#bal-value').textContent === '$12,480.50', document.querySelector('#bal-value').textContent);
    seek(3.55 - F); ok('balance $0.00 before 3.55', document.querySelector('#bal-value').textContent === '$0.00', document.querySelector('#bal-value').textContent);
    seek(4.20); ok('goal bar at 68% at 4.20', /translateX\((-?0(\.0+)?|-0\.0\d*)%\)/.test(document.querySelector('#goal-fill').style.transform) || document.querySelector('#goal-fill').style.transform === 'translateX(0%)', document.querySelector('#goal-fill').style.transform);
    ok('flip φ(4.50) = 90°', Math.abs(wm.flipAngle(4.50) - 90) < 1e-9, wm.flipAngle(4.50));
    ok('map at 38° tilt at 4.80', Math.abs(180 - wm.flipAngle(4.80) - 38) < 1e-9, 180 - wm.flipAngle(4.80));
    seek(5.42); ok('map rotation + blur done at 5.42', /rotateX\(0deg\)|rotateX\(0\)/.test(document.querySelector('#map').style.transform) && st('#map').filter === 'none', document.querySelector('#map').style.transform + ' | ' + st('#map').filter);
    seek(5.50); ok('map flat, scale 1, no blur at 5.50', document.querySelector('#map').style.transform === 'none' && st('#map').filter === 'none', document.querySelector('#map').style.transform);
    seek(6.50); ok('route fully drawn at 6.50', +document.querySelector('#route').getAttribute('stroke-dashoffset') < 0.5, document.querySelector('#route').getAttribute('stroke-dashoffset'));
    seek(5.40); ok('route not drawn at 5.40', document.querySelector('#route').style.opacity === '0', document.querySelector('#route').style.opacity);
    seek(6.60); ok('panel at rest at 6.60', document.querySelector('#panel').style.transform === 'none' && st('#panel').filter === 'none', document.querySelector('#panel').style.transform);
    ok('stats counted up by 6.60', ['#val-time', '#val-min', '#val-dist'].map((s) => document.querySelector(s).textContent).join('|') === '03:05|185|1,930 km', ['#val-time', '#val-min', '#val-dist'].map((s) => document.querySelector(s).textContent).join('|'));
    seek(7.60); ok('slider p = 62% at 7.60', Math.abs(wm.sliderP(7.60) - 0.62) < 1e-9, wm.sliderP(7.60));
    ok('stats at 62% at 7.60', ['#val-time', '#val-min', '#val-dist'].map((s) => document.querySelector(s).textContent).join('|') === '01:10|70|733 km', ['#val-time', '#val-min', '#val-dist'].map((s) => document.querySelector(s).textContent).join('|'));

    // ── 3 · no text doubling in blur-swaps ─────────────────────────────
    for (const s0 of [wm.T.swap1, wm.T.swap2]) {
      let worst = 0;
      for (let t = s0; t <= s0 + 0.3; t += 1 / 960) { const b = wm.blurSwap(t, s0); if (b.inOpacity > 0.3) worst = Math.max(worst, b.outOpacity); }
      ok(`swap@${s0}: outgoing < 30% once incoming > 30%`, worst < 0.3, 'max outgoing = ' + worst.toFixed(4));
    }

    // ── 3 · counters don't shift width (tabular) ──────────────────────
    {
      const byLen = {};
      for (let t = 3.5; t <= 4.1; t += 1 / 240) {
        seek(t); const e = document.querySelector('#bal-value');
        const w = e.getBoundingClientRect().width; const k = e.textContent.length;
        (byLen[k] = byLen[k] || new Set()).add(w.toFixed(2));
      }
      ok('balance width depends only on character count', Object.values(byLen).every((s) => s.size === 1), JSON.stringify(Object.fromEntries(Object.entries(byLen).map(([k, v]) => [k, [...v]]))));
      const byLen2 = {};
      for (let t = 6.1; t <= 7.7; t += 1 / 240) {
        seek(t);
        for (const s of ['#val-time', '#val-min', '#val-dist']) {
          const e = document.querySelector(s); const k = s + ':' + e.textContent.length;
          const rg = document.createRange(); rg.selectNodeContents(e); (byLen2[k] = byLen2[k] || new Set()).add(rg.getBoundingClientRect().width.toFixed(2));
        }
      }
      ok('stat widths depend only on character count', Object.values(byLen2).every((s) => s.size === 1), JSON.stringify(Object.fromEntries(Object.entries(byLen2).map(([k, v]) => [k, [...v]]))));
    }

    // ── 4 · flip never shows a mirrored / edge-on face with content ───
    {
      let bad = [];
      for (let t = 4.2; t <= 5.5; t += 1 / 240) {
        seek(t);
        const phi = wm.flipAngle(t);
        if (vis('#wallet') && !(phi < 90)) bad.push('wallet@' + t.toFixed(4));
        if (vis('#map') && !(phi >= 90)) bad.push('map@' + t.toFixed(4));
      }
      ok('flip: wallet only while φ<90°, map only while φ≥90°', bad.length === 0, bad.slice(0, 5).join(','));
    }

    // ── 5 · pins on route endpoints, marker on curve ──────────────────
    {
      const pos = (sel) => { const m = document.querySelector(sel).getAttribute('transform').match(/translate\(([-\d.]+)[ ,]([-\d.]+)\)/); return [+m[1], +m[2]]; };
      const a = pos('#pin-india'), b = pos('#pin-dubai');
      ok('India pin on route start', Math.hypot(a[0] - wm.routeStart.x, a[1] - wm.routeStart.y) < 0.01, JSON.stringify(a));
      ok('Dubai pin on route end', Math.hypot(b[0] - wm.routeEnd.x, b[1] - wm.routeEnd.y) < 0.01, JSON.stringify(b));
      seek(5.75); ok('pins landed (spring settled) by 5.75', /translate\(0 -?0(\.\d+)?\)/.test(document.querySelector('#pin-dubai .pin-body').getAttribute('transform')), document.querySelector('#pin-dubai .pin-body').getAttribute('transform'));
      let worst = 0;
      for (let t = 6.55; t <= 8; t += 1 / 120) {
        seek(t); const m = pos('#marker'); const q = wm.routePoint(wm.sliderP(t) * wm.routeLen);
        worst = Math.max(worst, Math.hypot(m[0] - q.x, m[1] - q.y));
      }
      ok('marker stays on the curve at p(t)', worst < 0.01, worst);
    }

    // ── 6 · nothing clips the canvas edges ────────────────────────────
    {
      const fails = [];
      const inside = (r, pad = 0) => r.left >= -pad && r.top >= -pad && r.right <= 1080 + pad && r.bottom <= 1920 + pad;
      for (let t = 2.5; t <= 6.0; t += 1 / 240) {
        seek(t);
        if (vis('#wallet')) for (const s of ['#card-red', '#card-green', '#card-blue', '#card-black']) {
          if (st(s).visibility === 'hidden') continue;
          const r = document.querySelector(s).getBoundingClientRect();
          // the black card legitimately starts off-screen below; only its sides/top must stay inside
          const pass = s === '#card-black' ? r.left >= 0 && r.right <= 1080 && r.top >= 0 : inside(r);
          if (!pass) fails.push(`${s}@${t.toFixed(3)} [${r.left.toFixed(0)},${r.top.toFixed(0)},${r.right.toFixed(0)},${r.bottom.toFixed(0)}]`);
        }
        if (vis('#map')) { const r = document.querySelector('#map').getBoundingClientRect(); if (!inside(r)) fails.push(`#map@${t.toFixed(3)} [${r.left.toFixed(0)},${r.top.toFixed(0)},${r.right.toFixed(0)},${r.bottom.toFixed(0)}]`); }
      }
      ok('no clipping at canvas edges (fan, slide-up, flip, tilt)', fails.length === 0, fails.slice(0, 6).join(' ') + (fails.length > 6 ? ` … (+${fails.length - 6})` : ''));
    }

    // ── map: route stays over the sea ─────────────────────────────────
    {
      const inPoly = (x, y, poly) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
      const N = 400; let onLand = 0; const landAt = [];
      for (let i = 0; i <= N; i++) {
        const q = wm.routePoint((i / N) * wm.routeLen);
        if (wm.polys.some((p) => inPoly(q.x, q.y, p))) { onLand++; landAt.push((i / N).toFixed(3)); }
      }
      const segDist = (px, py, [ax, ay], [bx, by]) => { const vx = bx - ax, vy = by - ay; const u = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy || 1))); return Math.hypot(px - ax - u * vx, py - ay - u * vy); };
      let minClear = Infinity, at = 0;
      for (let i = Math.round(N * 0.10); i <= Math.round(N * 0.86); i++) {
        const q = wm.routePoint((i / N) * wm.routeLen);
        for (const poly of wm.polys) for (let k = 0; k < poly.length; k++) { const dd = segDist(q.x, q.y, poly[k], poly[(k + 1) % poly.length]); if (dd < minClear) { minClear = dd; at = i / N; } }
      }
      ok('route keeps ≥ 20px clearance from coasts (10%–86% of its length)', minClear >= 20, `min clearance ${minClear.toFixed(1)}px at u=${at.toFixed(3)}`);
      ok('route over sea (except final approach over UAE)', landAt.every((u) => +u > 0.93 || +u < 0.005), `${onLand}/${N + 1} samples on land: ${landAt.slice(0, 8).join(',')}…`);
    }
    return out;
  });
  // ── 7 · the glass panel really blurs the map in this headless Chromium ──
  {
    const fs = require('fs');
    const path = require('path');
    const { spawnSync } = require('child_process');
    const tmp = path.join(__dirname, '.tmp');
    fs.mkdirSync(tmp, { recursive: true });
    const settle = (t) => page.evaluate((tt) => new Promise((r) => { window.seek(tt); requestAnimationFrame(() => requestAnimationFrame(r)); }), t);
    const clip = { x: 72, y: 1230, width: 936, height: 356 };
    await settle(7.9);
    const a = path.join(tmp, 'glass_on.png'), b = path.join(tmp, 'glass_off.png');
    await page.screenshot({ path: a, clip });
    const style = await page.addStyleTag({ content: '#panel{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}' });
    await settle(7.9);
    await page.screenshot({ path: b, clip });
    await style.evaluate((n) => n.remove());
    const err = spawnSync('ffmpeg', ['-hide_banner', '-i', a, '-i', b, '-lavfi', 'psnr', '-f', 'null', '-']).stderr.toString();
    const psnr = (err.match(/average:([\d.]+|inf)/) || [])[1] || 'n/a';
    results.push({ name: 'backdrop-filter changes the panel pixels (glass is live)', pass: psnr !== 'inf' && psnr !== 'n/a', detail: `PSNR with vs without backdrop-filter = ${psnr} dB (inf would mean no effect)` });
  }

  let fails = 0;
  for (const r of results) {
    if (!r.pass) fails++;
    console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.detail !== undefined ? '  — ' + String(r.detail).slice(0, 400) : ''}`);
  }
  console.log(fails ? `\n${fails} check(s) failed` : '\nall checks passed');
  await browser.close();
  process.exitCode = fails ? 1 : 0;
}
main().catch((e) => { console.error(e); process.exit(1); });
