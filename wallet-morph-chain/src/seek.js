// seek(t): the single pure renderer. Every visual property is computed from t alone and written
// to the DOM/SVG; no state survives between calls (refs + static measurements are set once by attach()).

import CFG from '../timeline.config.js';
import { clamp, lerp, range, smoothstep, cubicBezier, spring, bump, hexToRgb, n, px } from './math.js';
import { bakeCameraLUT, sampleCamera } from './camera.js';

const T = CFG.times, D = CFG.durations, B = CFG.blur, HK = CFG.hero, P = CFG.palette, SP = CFG.springs;
const HALO = CFG.halo, M = CFG.map, SEG = CFG.segments, PN = CFG.panel;
const ease = {
  in: cubicBezier(CFG.easing.entrance),
  rc: cubicBezier(CFG.easing.routeCamera),
  out: cubicBezier(CFG.easing.exit),
  outMorph: cubicBezier(CFG.easing.exitMorph),
};
const RGB = { icon: hexToRgb(P.iconOuter), cardTop: hexToRgb(P.cardTop), cardBot: hexToRgb(P.cardBottom), white: [255, 255, 255] };

let R = null; // DOM refs + static measurements
let LUT = null; // baked camera
let GEO = null; // base-px city / route geometry

export function attach(refs) {
  R = refs;
  const o = R.project([CFG.cities.origin.lon, CFG.cities.origin.lat]);
  const d = R.project([CFG.cities.destination.lon, CFG.cities.destination.lat]);
  const mid = { x: (o[0] + d[0]) / 2, y: (o[1] + d[1]) / 2 };
  const cx = d[0] - o[0], cy = d[1] - o[1];
  const len = Math.hypot(cx, cy);
  let nx = -cy / len, ny = cx / len;
  if (ny < 0) { nx = -nx; ny = -ny; } // bow south, over the Arabian Sea
  const bow = M.routeBow * len * 2; // quadratic control offset (curve deviates half of this)
  GEO = { o: { x: o[0], y: o[1] }, d: { x: d[0], y: d[1] }, c: { x: mid.x + nx * bow, y: mid.y + ny * bow }, mid };
  LUT = bakeCameraLUT(CFG, { x: M.width / 2, y: M.height / 2 }, mid);
}

/* ── small helpers ─────────────────────────────────────────────────── */

const mixRGB = (a, b, p) => a.map((v, i) => lerp(v, b[i], p));
const rgb = (c) => `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`;
const mixHalo = (a, b, p) => ({ y: lerp(a.y, b.y, p), blur: lerp(a.blur, b.blur, p), spread: lerp(a.spread || 0, b.spread || 0, p), a: lerp(a.a, b.a, p) });
const shadow = (h, mul = 1) => `0 ${n(h.y, 2)}px ${n(h.blur, 2)}px ${n(h.spread || 0, 2)}px rgba(0,0,0,${n(h.a * mul, 4)})`;
const blurCSS = (b) => (b > 0.05 ? `blur(${n(b, 3)}px)` : 'none');
const mixGeo = (a, b, p) => ({
  cx: lerp(a.cx, b.cx, p), cy: lerp(a.cy, b.cy, p), w: lerp(a.w, b.w, p), h: lerp(a.h, b.h, p),
  r: lerp(a.r, b.r, p), k: lerp(a.k, b.k, p), rot: lerp(a.rot, b.rot, p),
});

function show(el, opacity, extra) {
  if (opacity <= 0.0005) {
    el.style.visibility = 'hidden';
    el.style.opacity = '0';
    return false;
  }
  el.style.visibility = 'visible';
  el.style.opacity = n(Math.min(1, opacity), 4);
  if (extra) extra(el);
  return true;
}

/* ── the hero shape ────────────────────────────────────────────────── */

const inMapPhase = (t) => t >= SEG.S4[0] && t < SEG.S6[0];

export function heroState(t) {
  let s;
  if (t < SEG.S2[0]) {
    // S1 — emergence spring: tiny blurred squircle → 340 px icon
    const x = spring(t - T.s1.hero, SP.emergence);
    const xc = clamp(x);
    s = mixGeo(HK.squircle, HK.icon, x);
    s.opacity = lerp(HK.squircle.opacity, 1, xc);
    s.blur = B.squircle * Math.max(0, 1 - x);
    s.top = s.bot = RGB.icon;
    s.halo = mixHalo(HALO.float, HALO.icon, xc);
  } else if (t < SEG.S3[0]) {
    // S2 — icon blurs + condenses into the dots, then (invisible) its bounds become the glyph frame
    s = t < T.s2.condense[1]
      ? mixGeo(HK.icon, HK.condensed, smoothstep(range(t, ...T.s2.condense)))
      : mixGeo(HK.condensed, HK.glyphFrame, smoothstep(range(t, ...T.s2.frameMorph)));
    s.opacity = 1 - ease.out(range(t, ...T.s2.heroFade));
    s.blur = B.iconToFaceId * smoothstep(range(t, T.s2.blur[0], T.s2.blur[1]));
    s.top = s.bot = RGB.icon;
    s.halo = HALO.icon;
  } else if (t < SEG.S4[0]) {
    // S3 — glyph frame → small black card (blur-through) → card-growth spring → tall Wallet card
    if (t < T.s3.growth) {
      s = mixGeo(HK.glyphFrame, HK.smallCard, smoothstep(range(t, ...T.s3.emerge)));
      s.blur = B.faceIdToCard;
    } else {
      const x = spring(t - T.s3.growth, SP.cardGrowth);
      s = mixGeo(HK.smallCard, HK.walletCard, x);
      s.blur = B.faceIdToCard * Math.max(0, 1 - x);
    }
    s.opacity = smoothstep(range(t, ...T.s3.alphaIn));
    s.top = RGB.cardTop;
    s.bot = RGB.cardBot;
    s.halo = HALO.card;
  } else if (t < SEG.S6[0]) {
    // S4/S5 — Wallet card → tilted white map card → flatten spring → flat map (holds through S5)
    const m = ease.in(range(t, ...T.s4.morph));
    s = mixGeo(HK.walletCard, HK.mapCard, m);
    const bb = bump(t, ...T.s4.blur);
    s.blur = B.cardToMap * bb;
    s.opacity = 1 - (1 - T.s4.opacityDip) * bb;
    const fp = smoothstep(range(t, ...T.s4.fill));
    s.top = mixRGB(RGB.cardTop, RGB.white, fp);
    s.bot = mixRGB(RGB.cardBot, RGB.white, fp);
    const tilt = ease.in(range(t, ...T.s4.tiltIn));
    const f = spring(t - T.s4.flatten, SP.mapFlatten);
    const amt = tilt * (1 - f);
    s.rx = M.tilt.rotateX * amt;
    s.rot += M.tilt.rotateZ * amt;
    s.halo = mixHalo(mixHalo(HALO.card, HALO.mapFloat, smoothstep(range(t, 3.9, 4.3))), HALO.mapSettled, clamp(f));
  } else {
    // S6 — map card → tiny blurred squircle; lands exactly on the t = 0 state at t = 7
    const e = ease.outMorph(range(t, ...T.s6.morph));
    s = mixGeo(HK.mapCard, HK.squircle, e);
    s.blur = B.squircle * e;
    s.opacity = lerp(1, HK.squircle.opacity, e);
    s.top = s.bot = mixRGB(RGB.white, RGB.icon, e);
    s.halo = mixHalo(HALO.mapSettled, HALO.float, e);
  }
  s.rx = s.rx || 0;
  s.map = inMapPhase(t);
  s.transform = s.map
    ? `perspective(${M.tilt.perspective}px) rotateX(${n(s.rx, 4)}deg) rotateZ(${n(s.rot, 4)}deg)`
    : `rotate(${n(s.rot, 4)}deg)`;
  return s;
}

function applyHero(s) {
  const st = R.hero.style;
  if (!show(R.hero, s.opacity)) return;
  st.left = px(s.cx - s.w / 2);
  st.top = px(s.cy - s.h / 2);
  st.width = px(s.w);
  st.height = px(s.h);
  st.borderRadius = px(s.r);
  st.setProperty('corner-shape', `superellipse(${n(s.k, 4)})`);
  st.transform = s.transform;
  st.filter = blurCSS(s.blur);
  st.background = `linear-gradient(180deg, ${rgb(s.top)}, ${rgb(s.bot)})`;
  st.boxShadow = shadow(s.halo);
}

/** Projects points on the hero plane to stage px through exactly the CSS transform the hero uses. */
function makeProjector(s) {
  const m = new DOMMatrix(s.transform);
  const sc = Math.max(s.w / M.width, s.h / M.height); // preserveAspectRatio="xMidYMid slice"
  const ox = (s.w - M.width * sc) / 2, oy = (s.h - M.height * sc) / 2;
  const local = (lx, ly) => {
    const q = m.transformPoint(new DOMPoint(lx, ly, 0, 1));
    return [s.cx + q.x / q.w, s.cy + q.y / q.w];
  };
  const card = (u, v) => local(ox + u * sc - s.w / 2, oy + v * sc - s.h / 2);
  // rounded-rect outline of the hero (stage px), for containment + clipping
  const outline = () => {
    const pts = [];
    const hw = s.w / 2, hh = s.h / 2, r = Math.min(s.r, hw, hh);
    const cs = [[hw - r, -hh + r, -90], [hw - r, hh - r, 0], [-hw + r, hh - r, 90], [-hw + r, -hh + r, 180]];
    for (const [x, y, a0] of cs) {
      for (let i = 0; i <= 6; i++) {
        const a = ((a0 + i * 15) * Math.PI) / 180;
        pts.push(local(x + r * Math.cos(a), y + r * Math.sin(a)));
      }
    }
    return pts;
  };
  return { card, local, outline };
}

/* ── S1: icon internals + label ────────────────────────────────────── */

function applyIcon(t) {
  if (!show(R.iconArt, t < SEG.S3[0] ? 1 : 0)) return;
  const pIn = (t0) => ease.in(range(t, t0, t0 + D.entrance));
  const a = pIn(T.s1.inner);
  R.icInner.setAttribute('opacity', n(a, 4));
  R.icInner.setAttribute('transform', `translate(170 170) scale(${n(0.86 + 0.14 * a, 4)}) translate(-170 -170)`);
  R.icEdges.forEach((el, i) => {
    const p = pIn(T.s1.edges + i * T.s1.edgeStagger);
    el.setAttribute('opacity', n(p, 4));
    el.setAttribute('transform', `translate(0 ${n(-20 * (1 - p), 3)})`);
  });
  const sc = pIn(T.s1.scallop);
  R.icScallop.setAttribute('opacity', n(sc, 4));
  R.icScallop.setAttribute('transform', `translate(0 ${n(10 * (1 - sc), 3)})`);
  const pk = pIn(T.s1.pocket);
  R.icPocket.setAttribute('opacity', n(pk, 4));
  R.icPocket.setAttribute('transform', `translate(0 ${n(18 * (1 - pk), 3)})`);
}

function applyLabel(t) {
  const pop = spring(t - T.s1.label, SP.labelPop);
  const out = ease.out(range(t, T.s2.labelOut, T.s2.labelOut + D.textOut));
  const op = clamp(pop * 1.6) * (1 - out);
  show(R.label, op, (el) => {
    const y = HK.icon.cy + HK.icon.h / 2 + CFG.iconLabelGap + 14 * (1 - pop) - 6 * out;
    el.style.left = px(HK.icon.cx - R.labelW / 2);
    el.style.top = px(y);
    el.style.filter = blurCSS(6 * Math.max(0, 1 - pop * 1.25) + B.contentOut * out);
  });
}

/* ── S2/S3: Face ID ────────────────────────────────────────────────── */

function applyFaceId(t) {
  let opacity, blur;
  if (t < T.s3.retract) {
    opacity = smoothstep(range(t, ...T.s2.dotsIn));
    blur = B.iconToFaceId * (1 - smoothstep(range(t, T.s2.blur[1], T.s2.blur[2])));
  } else {
    opacity = 1 - smoothstep(range(t, ...T.s3.glyphFade));
    blur = B.faceIdToCard * smoothstep(range(t, ...T.s3.glyphBlur));
  }
  if (t < T.s2.dotsIn[0]) opacity = 0;
  if (!show(R.faceSvg, opacity)) return;
  R.faceSvg.style.filter = blurCSS(blur);
  const F = CFG.faceId;
  const travel = ease.in(range(t, ...T.s2.dotsTravel));
  const converge = ease.out(range(t, ...T.s3.converge));
  // S2: dots condense out of the icon (start inside its bounds) and travel to their anchors.
  // S3: after retracting, the dots pull in toward the small card forming at the glyph centre.
  const icx = F.size / 2 + (HK.condensed.cx - F.cx), icy = F.size / 2 + (HK.condensed.cy - F.cy);
  const last = R.faces.length - 1;
  R.faces.forEach((f, i) => {
    const sx = icx + (f.ax - F.size / 2) * 0.5, sy = icy + (f.ay - F.size / 2) * 0.5;
    const k = 1 - travel;
    const gx = (F.size / 2 - f.ax) * 0.62 * converge, gy = (F.size / 2 - f.ay) * 0.62 * converge;
    f.el.setAttribute('transform', `translate(${n((sx - f.ax) * k + gx, 3)} ${n((sy - f.ay) * k + gy, 3)})`);
    let s;
    if (t < T.s3.retract) s = ease.in(range(t, T.s2.strokes + i * T.s2.strokeStagger, T.s2.strokes + i * T.s2.strokeStagger + D.strokeStretch));
    else {
      const r0 = T.s3.retract + (last - i) * T.s3.retractStagger;
      s = 1 - ease.out(range(t, r0, r0 + D.strokeRetract));
    }
    const dash = lerp(0.01, f.L, s);
    f.el.setAttribute('stroke-dasharray', `${n(dash, 3)} ${n(f.L * 2, 3)}`);
    f.el.setAttribute('stroke-dashoffset', n(-f.anchor * (f.L - dash), 3));
  });
}

/* ── S3/S4: stack cards + Wallet card content ──────────────────────── */

function applyStack(t, hs) {
  const SC = CFG.stackCards;
  const heroTop = hs.cy - hs.h / 2;
  const sink = ease.out(range(t, ...T.s4.stackSink));
  const visible = t >= T.s3.stack && t < T.s4.stackSink[1];
  R.stack.forEach((el, i) => {
    const L = R.stack.length - i; // 3 = farthest back
    const order = R.stack.length - 1 - i; // front card emerges first
    const rv = ease.in(range(t, T.s3.stack + order * T.s3.stackStagger, T.s3.stack + order * T.s3.stackStagger + D.entrance));
    const op = visible ? clamp(rv * 1.5) * (1 - sink) * hs.opacity : 0;
    show(el, op, (e) => {
      const w = hs.w - 2 * SC.inset * L;
      const top = heroTop - SC.peek * L * rv + sink * (SC.peek * L + 60);
      const left = hs.cx - w / 2;
      e.style.left = px(left);
      e.style.top = px(top);
      e.style.width = px(w);
      e.style.height = px(SC.height);
      e.style.borderRadius = px(hs.r);
      e.style.setProperty('corner-shape', `superellipse(${n(hs.k, 4)})`);
      e.style.transformOrigin = `${n(hs.cx - left)}px ${n(hs.cy - top)}px`;
      e.style.transform = `rotate(${n(hs.rot, 4)}deg)`;
      e.style.filter = blurCSS(hs.blur);
    });
  });
}

function itemFx(el, t, tin, tout, { rise = 16, blurIn = B.contentIn, dur = D.textIn, outDur = D.textOut } = {}) {
  const p = ease.in(range(t, tin, tin + dur));
  const q = ease.out(range(t, tout, tout + outDur));
  const op = p * (1 - q);
  show(el, op, (e) => {
    e.style.transform = `translateY(${n(rise * (1 - p) - 10 * q, 3)}px)`;
    e.style.filter = blurCSS(blurIn * (1 - p) + B.contentOut * q);
  });
}

function applyWallet(t, hs) {
  const visible = t >= T.s3.creditCard && t < T.s4.contentOut + 0.5;
  if (!show(R.wallet, visible ? 1 : 0)) return;
  const st = R.wallet.style;
  st.left = px(hs.cx - hs.w / 2);
  st.top = px(hs.cy - hs.h / 2);
  st.width = px(hs.w);
  st.height = px(hs.h);
  st.borderRadius = px(hs.r);
  st.transform = `rotate(${n(hs.rot, 4)}deg)`;
  st.filter = blurCSS(hs.blur);
  const o = T.s4.contentOut, g = T.s4.contentStagger;
  itemFx(R.wTitle, t, T.s3.title, o);
  itemFx(R.wPlus, t, T.s3.plus, o);
  itemFx(R.wBag, t, T.s3.bag, o + g);
  itemFx(R.wBalLabel, t, T.s3.balanceLabel, o + g);
  R.wDigits.forEach((el, i) => {
    const t0 = T.s3.digits + i * T.s3.digitStagger;
    itemFx(el, t, t0, o + g, { rise: 24, dur: D.digit });
  });
  itemFx(R.wProgLabel, t, T.s3.progressLabel, o + 2 * g);
  itemFx(R.wTrack, t, T.s3.progressTrack, o + 2 * g, { rise: 10 });
  const pr = lerp(T.s3.progressFrom, T.s3.progressTo, ease.in(range(t, ...T.s3.progress)));
  R.wFill.style.width = `${n(pr * 100, 3)}%`;
  itemFx(R.wCC, t, T.s3.creditCard, o + 3 * g, { rise: 46, dur: D.entrance, outDur: D.exit });
}

/* ── S4–S6: map content (card plane) ───────────────────────────────── */

function applyMap(t, hs, cam) {
  const visible = t >= T.s4.graticule[0];
  const fadeOut = smoothstep(range(t, ...T.s6.mapFade));
  if (!show(R.map, visible ? 1 - fadeOut : 0)) return null;
  const W2 = M.width / 2, H2 = M.height / 2;
  R.cam.setAttribute('transform', `translate(${n(W2 - cam.x * cam.z, 3)} ${n(H2 - cam.y * cam.z, 3)}) scale(${n(cam.z, 5)})`);
  const toCard = (p) => ({ x: (p.x - cam.x) * cam.z + W2, y: (p.y - cam.y) * cam.z + H2 });

  // graticule: lines draw on from the centre outward, then crossfade into the continents
  const gOut = smoothstep(range(t, ...T.s4.graticuleOut));
  if (show(R.graticule, 1 - gOut)) {
    const [g0, g1] = T.s4.graticule;
    R.gratLines.forEach(({ el, k }) => {
      const s0 = g0 + k * 0.24 * (g1 - g0);
      const p = ease.in(range(t, s0, s0 + (g1 - g0) * 0.7));
      el.setAttribute('stroke-dasharray', `${n(p, 4)} 1`);
    });
  }
  const land = smoothstep(range(t, ...T.s4.continents));
  if (show(R.land, land)) {
    const b = B.landIn * (1 - land);
    if (b > 0.05) {
      R.landBlur.setAttribute('stdDeviation', n(b / cam.z, 3));
      R.land.setAttribute('filter', 'url(#f-land)');
    } else R.land.removeAttribute('filter');
  }
  show(R.uae, smoothstep(range(t, ...T.s5.uae)));

  // overlay (card plane, never scaled by the camera)
  const o = toCard(GEO.o), d = toCard(GEO.d), c = toCard(GEO.c);
  const s6 = T.s6.contentOut + 2 * T.s6.contentStagger;
  const exitOverlay = ease.out(range(t, s6, s6 + D.exit));
  const ringPop = spring(t - T.s4.ring, SP.labelPop);
  show(R.ring, clamp(ringPop * 2) * (1 - exitOverlay), (el) =>
    el.setAttribute('transform', `translate(${n(o.x)} ${n(o.y)}) scale(${n(Math.max(0, ringPop), 4)})`));
  const uae = smoothstep(range(t, ...T.s5.uae));
  show(R.dest, uae * (1 - exitOverlay), (el) =>
    el.setAttribute('transform', `translate(${n(d.x)} ${n(d.y)}) scale(${n(0.4 + 0.6 * uae, 4)})`));

  const pr = routeProgress(t);
  const routeOp = (pr > 0 ? 1 : 0) * (1 - exitOverlay);
  let head = null;
  if (show(R.route, routeOp)) {
    const dd = `M${n(o.x)},${n(o.y)}Q${n(c.x)},${n(c.y)} ${n(d.x)},${n(d.y)}`;
    R.route.setAttribute('d', dd);
    R.routeGlow.setAttribute('d', dd);
    const L = R.route.getTotalLength();
    const dash = `${n(pr * L, 3)} ${n(L + 40, 3)}`;
    R.route.setAttribute('stroke-dasharray', dash);
    R.routeGlow.setAttribute('stroke-dasharray', dash);
    const hp = R.route.getPointAtLength(pr * L);
    head = { x: hp.x, y: hp.y };
  }
  show(R.routeGlow, routeOp * 0.35);
  const headOp = routeOp * clamp(pr * 12);
  show(R.head, headOp, (el) => el.setAttribute('transform', `translate(${n(head.x)} ${n(head.y)})`));
  show(R.headGlow, headOp * 0.55, (el) => {
    el.setAttribute('cx', n(head.x));
    el.setAttribute('cy', n(head.y));
  });
  return { o, d, c, route: pr };
}

const routeProgress = (t) => ease.rc(range(t, ...T.s5.route));
/** Points along the drawn part of the route (card plane), for layout checks. */
function sampleQuad({ o, c, d }, upto, count = 24) {
  const out = [];
  for (let i = 0; i <= count; i++) {
    const u = (i / count) * upto, v = 1 - u;
    out.push({ x: v * v * o.x + 2 * v * u * c.x + u * u * d.x, y: v * v * o.y + 2 * v * u * c.y + u * u * d.y });
  }
  return out;
}

/* ── flat layers projected through the hero transform ─────────────── */

function applyBubble(b, t, tPop, tOut, anchor, hs) {
  const pop = spring(t - tPop, SP.labelPop);
  const out = ease.out(range(t, tOut, tOut + D.textOut));
  const op = clamp(pop * 3) * (1 - out) * (t >= tPop ? 1 : 0);
  if (!show(b.root, op) || !anchor) return null;
  const g = Math.max(0, pop);
  const w = b.w * g, h = b.h * g;
  const tipX = anchor[0], tipY = anchor[1] - 24 + 10 * (1 - clamp(pop)) + 8 * out;
  const ptrH = 9;
  const left = tipX - w / 2, top = tipY - ptrH - h + 1;
  b.root.style.left = '0px';
  b.root.style.top = '0px';
  b.root.style.filter = blurCSS(B.contentIn * 0.6 * (1 - clamp(pop)) + B.contentOut * out + hs.blur);
  const pl = b.pill.style;
  pl.left = px(left);
  pl.top = px(top);
  pl.width = px(w);
  pl.height = px(h);
  pl.boxShadow = shadow(mixHalo(HALO.bubbleFloat, HALO.bubbleSettled, clamp(pop)));
  const ins = b.inner.style;
  ins.left = px((w - b.w) / 2);
  ins.top = px((h - b.h) / 2);
  ins.opacity = n(clamp((pop - 0.45) / 0.4), 4);
  b.ptr.style.left = px(tipX - 11);
  b.ptr.style.top = px(tipY - ptrH - 0.5);
  b.ptr.style.opacity = n(clamp((pop - 0.3) / 0.4), 4);
  return { x: tipX - b.w / 2, y: tipY - ptrH - b.h, w: b.w, h: b.h + ptrH, op };
}

function applyPanel(t, hs, proj) {
  const p = ease.in(range(t, T.s4.panel, T.s4.panel + D.entrance));
  const q = ease.in(range(t, T.s4.panelContent, T.s4.panelContent + D.textIn));
  const s0 = T.s6.contentOut, g = T.s6.contentStagger;
  const outC = ease.out(range(t, s0, s0 + D.textOut));
  const outS = ease.out(range(t, s0 + 0.5 * g, s0 + 0.5 * g + D.exit * 0.7));
  const op = p * (1 - outS);
  if (!show(R.panel, op) || !proj) return null;
  const [ax, ay] = proj.card(PN.x, PN.y);
  const dx = PN.enterFrom.x * (1 - p), dy = PN.enterFrom.y * (1 - p) + 10 * outS;
  const x = ax + dx, y = ay + dy;
  const rz = (hs.rot * Math.PI) / 180;
  const st = R.panel.style;
  st.left = px(x);
  st.top = px(y);
  st.transformOrigin = '0px 0px';
  st.transform = `rotate(${n(hs.rot, 4)}deg)`;
  st.filter = blurCSS(B.contentIn * (1 - p) + B.contentOut * outS + hs.blur);
  // clip to the projected card outline (panel-local coords) so it can never leave the card
  const cos = Math.cos(-rz), sin = Math.sin(-rz);
  const poly = proj.outline().map(([X, Y]) => {
    const lx = X - x, ly = Y - y;
    return `${n(lx * cos - ly * sin, 2)}px ${n(lx * sin + ly * cos, 2)}px`;
  });
  st.clipPath = `polygon(${poly.join(',')})`;
  R.panelInner.style.opacity = n(q * (1 - outC), 4);
  // slider thumb + play pulse follow the route exactly
  const pr = routeProgress(t);
  const thumbX = pr * (R.trackW - 22);
  R.thumb.style.transform = `translateX(${n(thumbX, 3)}px)`;
  R.trackFill.style.width = px(thumbX + 11);
  const pulse = 1 + 0.06 * bump(t, T.s5.pulse[0], (T.s5.pulse[0] + T.s5.pulse[1]) / 2, T.s5.pulse[1]);
  R.play.style.transform = `scale(${n(pulse, 5)})`;
  return { x, y, w: PN.w, h: PN.h, rot: hs.rot, op };
}

/* ── seek ──────────────────────────────────────────────────────────── */

export function seek(tIn) {
  const dur = CFG.duration;
  const t = ((tIn % dur) + dur) % dur;
  const hs = heroState(t);
  applyHero(hs);
  applyIcon(t);
  applyLabel(t);
  applyFaceId(t);
  applyStack(t, hs);
  applyWallet(t, hs);
  const cam = sampleCamera(LUT, t);
  const pts = applyMap(t, hs, cam);
  const proj = t >= T.s4.graticule[0] ? makeProjector(hs) : null;
  const toStage = (p) => (proj && p ? proj.card(p.x, p.y) : null);
  const s6 = T.s6.contentOut, g6 = T.s6.contentStagger;
  const bO = applyBubble(R.bOrigin, t, T.s4.india, s6, toStage(pts && pts.o), hs);
  const bD = applyBubble(R.bDest, t, T.s5.dubai, s6 + g6, toStage(pts && pts.d), hs);
  const panel = applyPanel(t, hs, proj);
  return {
    t,
    hero: { cx: hs.cx, cy: hs.cy, w: hs.w, h: hs.h, opacity: hs.opacity, blur: hs.blur, rx: hs.rx, rot: hs.rot },
    outline: proj ? proj.outline() : null,
    bubbles: [bO, bD].filter(Boolean),
    panel,
    camera: cam,
    route: routeProgress(t),
    routePts: proj && pts && pts.route > 0 ? sampleQuad(pts, pts.route).map((p) => proj.card(p.x, p.y)) : null,
  };
}
