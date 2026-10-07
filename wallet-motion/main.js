/*
 * Wallet — Unlock to Route
 * Deterministic 8.0 s timeline. Every visual property is a pure function of t:
 *   window.seek(t)  — t in seconds (0 … 8)
 * No CSS transitions/animations, no timers, no Math.random, no state carried between frames.
 * `?preview` loops seek(performance.now()/1000 % 8) with requestAnimationFrame (viewing only).
 * `?t=4.35`  renders a single static time.
 */
(function () {
  'use strict';

  /* ════════════════════════ math helpers ════════════════════════ */

  const DURATION = 8.0;
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, p) => a + (b - a) * p;
  /** progress of t through [a, b], clamped to 0..1 */
  const range = (t, a, b) => clamp((t - a) / (b - a));

  /** CSS-equivalent cubic-bezier(x1, y1, x2, y2) evaluator (Newton + bisection, deterministic). */
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sampleX = (s) => ((ax * s + bx) * s + cx) * s;
    const sampleY = (s) => ((ay * s + by) * s + cy) * s;
    const slopeX = (s) => (3 * ax * s + 2 * bx) * s + cx;
    return function ease(x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let s = x;
      for (let i = 0; i < 8; i++) {
        const err = sampleX(s) - x;
        if (Math.abs(err) < 1e-7) return sampleY(s);
        const d = slopeX(s);
        if (Math.abs(d) < 1e-6) break;
        s -= err / d;
      }
      let lo = 0, hi = 1;
      s = x;
      for (let i = 0; i < 48; i++) {
        const v = sampleX(s);
        if (Math.abs(v - x) < 1e-7) break;
        if (v < x) lo = s; else hi = s;
        s = (lo + hi) / 2;
      }
      return sampleY(s);
    };
  }

  /** Default entrance ease — fast start, long soft settle. */
  const easeOut = cubicBezier(0.22, 1, 0.36, 1);
  /** Line draws, flip, exits. */
  const easeInOut = cubicBezier(0.65, 0, 0.35, 1);
  /** Counters. */
  const easeOutCubic = (p) => 1 - Math.pow(1 - clamp(p), 3);

  /**
   * Analytic damped spring (step response from rest), stiffness 220, damping 26, mass 1.
   * x(t) = 1 − e^{−ζω t}(cos ω_d t + (ζω/ω_d) sin ω_d t)
   */
  const SPRING = { stiffness: 220, damping: 26, mass: 1 };
  const SP_W0 = Math.sqrt(SPRING.stiffness / SPRING.mass);
  const SP_ZETA = SPRING.damping / (2 * Math.sqrt(SPRING.stiffness * SPRING.mass));
  const SP_WD = SP_W0 * Math.sqrt(1 - SP_ZETA * SP_ZETA);
  function spring(dt) {
    if (dt <= 0) return 0;
    const e = Math.exp(-SP_ZETA * SP_W0 * dt);
    return 1 - e * (Math.cos(SP_WD * dt) + (SP_ZETA * SP_W0 / SP_WD) * Math.sin(SP_WD * dt));
  }

  /**
   * Shared blur-swap (300 ms). Outgoing: blur 0→20, opacity 1→0, scale 1→1.04 over the first 180 ms.
   * Incoming starts at +120 ms: blur 20→0, opacity 0→1, scale 0.96→1 over 180 ms.
   * Outgoing uses easeInOut, incoming the default ease: outgoing is already < 10 % when the
   * incoming layer passes 30 %, so text never visibly doubles (verified in checks.js).
   */
  function blurSwap(t, start) {
    const po = easeInOut(range(t, start, start + 0.18));
    const pi = easeOut(range(t, start + 0.12, start + 0.30));
    return {
      outOpacity: 1 - po, outBlur: 20 * po, outScale: 1 + 0.04 * po,
      inOpacity: pi, inBlur: 20 * (1 - pi), inScale: 0.96 + 0.04 * pi,
    };
  }

  /** Cubic Hermite from 0→1 with normalised end tangents m0, m1. */
  function hermite(s, m0, m1) {
    const s2 = s * s, s3 = s2 * s;
    return (-2 * s3 + 3 * s2) + m0 * (s3 - 2 * s2 + s) + m1 * (s3 - s2);
  }

  /* ════════════════════════ schedule ════════════════════════ */

  const T = {
    iconIn: [0.00, 0.80],
    swap1: 0.80,               // icon → Face ID
    bracketDraw: [1.10, 1.40],
    dotsStart: 1.10, dotPeriod: 0.6, dotStagger: 0.06,
    scan: [1.40, 2.00],
    success: 2.00,
    check: [2.05, 2.35],
    swap2: 2.40,               // Face ID → wallet
    fanStart: 2.70, fanStagger: 0.08,
    blackStart: 3.20,
    balance: [3.55, 4.05],
    goal: [3.70, 4.20],
    flip: [4.20, 4.50, 4.80],  // start, swap at exactly 90°, tilted pose reached
    tiltEnd: 5.42,             // rotation + blur finish together …
    scaleEnd: 5.50,            // … scale lands 80 ms later
    pins: 5.10, pinStagger: 0.14,
    route: [5.40, 6.50],
    panel: [6.00, 6.60],
    statStart: 6.12, statStagger: 0.06, statCount: 0.36,
    live: [6.60, 7.60],
    markerRest: 7.80,
  };

  /* ════════════════════════ flip curve ════════════════════════
   * One continuous gesture expressed as a "front-equivalent" angle φ:
   *   φ = 0 at 4.20, 90 at 4.50 (swap, exactly edge-on), 142 at 4.80 (map at its 38° tilted rest),
   *   180 at 5.42 (map flat). Wallet shows rotateX(−φ); map shows rotateX(180 − φ).
   * Velocity is continuous through the swap and through 4.80 (C¹), so the flip reads as a single
   * motion: ease-in from rest → peak speed near the swap → long soft settle into flat.
   */
  const FLIP_V1 = 270;                    // deg/s at the swap (4.50)
  const FLIP_V2 = 2.0 * 38 / 0.62;        // deg/s at 4.80 — matches settle curve's initial slope (2.0)
  const flipSettle = cubicBezier(0.2, 0.4, 0.36, 1);
  function flipAngle(t) {
    const [a, b, c] = T.flip;
    if (t <= a) return 0;
    if (t < b) return 90 * hermite((t - a) / (b - a), 0, FLIP_V1 * (b - a) / 90);
    if (t < c) return 90 + 52 * hermite((t - b) / (c - b), FLIP_V1 * (c - b) / 52, FLIP_V2 * (c - b) / 52);
    if (t < T.tiltEnd) return 142 + 38 * flipSettle((t - c) / (T.tiltEnd - c));
    return 180;
  }
  /**
   * Perspective push-back: a 3D-tilted card's near edge is magnified by P/(P − z). To keep the
   * near edge inside the 1080 canvas (no clipping during flip/tilt) the card is pushed back along
   * z just enough, with a C¹ soft start so it is exactly 0 when no correction is needed.
   */
  const PERSPECTIVE = 1600;
  function pushBack(nearZ, halfWidth, limit = 516) {
    const allowed = PERSPECTIVE * (1 - halfWidth / limit);
    const x = nearZ - allowed;
    const k = 30;
    return x > 0 ? x - k + k * Math.exp(-x / k) : 0;
  }

  /** Slider progress p(t): the single source of truth for thumb, fill, stats and marker. */
  const SLIDER_MAX = 0.62;
  const sliderP = (t) => SLIDER_MAX * easeInOut(range(t, T.live[0], T.live[1]));

  /* ════════════════════════ map data ════════════════════════
   * Hand-authored simplified coastlines in [lon, lat]; projected with Mercator into the
   * 984 × 1300 map card (lon 51.5°E … 79.5°E). Smoothed with a Catmull-Rom → Bézier pass.
   */
  const MAP = { W: 984, H: 1300, LON0: 51.5, LAT0: 35.2, S: 984 / 28 };
  const mercY = (lat) => (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  const MERC_Y0 = mercY(MAP.LAT0);
  const project = ([lon, lat]) => [(lon - MAP.LON0) * MAP.S, (MERC_Y0 - mercY(lat)) * MAP.S];

  const MUMBAI = [72.83, 18.94];
  const DUBAI = [55.27, 25.20];
  // Cubic Bézier controls: a single convex arch (no S-bend) bowing ≈ 37 px north of the chord over
  // the open Arabian Sea, entering Dubai through the Gulf of Oman. Chosen by a search that keeps the
  // line ≥ 20 px clear of the Kathiawar and Makran coasts (see checks.js).
  const ROUTE_C1 = [66.5, 22.5];
  const ROUTE_C2 = [61.5, 24.5];

  // Arabia + Iraq/Iran + Pakistan + India as one landmass (bays: Persian Gulf, Gulf of Oman,
  // Gulf of Kutch, Gulf of Khambhat). Off-frame points close the polygon.
  const MAINLAND = [
    [44.0, 12.9], [45.5, 13.1], [47.0, 13.5], [48.2, 13.95], [49.2, 14.5], [50.2, 14.85], [51.25, 15.2],
    [52.24, 15.6], [52.2, 15.95], [52.17, 16.2], [52.7, 16.45], [53.1, 16.65], [53.5, 16.78],
    [54.1, 17.0], [54.7, 16.98], [55.3, 17.35], [55.6, 17.85], [56.3, 17.95], [56.9, 18.45],
    [57.4, 18.85], [57.85, 18.97], [57.72, 19.6], [58.05, 20.25], [58.5, 20.7], [58.95, 21.15],
    [59.35, 21.45], [59.6, 21.9], [59.82, 22.48], [59.5, 22.6], [59.2, 22.85], [58.92, 23.25],
    [58.6, 23.6], [58.2, 23.68], [57.88, 23.72], [57.4, 23.86], [56.95, 24.2], [56.72, 24.4],
    [56.47, 24.75], [56.36, 25.08], [56.36, 25.35], [56.28, 25.62], [56.38, 25.98], [56.4, 26.36],
    [56.24, 26.2], [56.08, 26.02], [55.95, 25.79], [55.55, 25.56], [55.4, 25.36], [55.27, 25.2],
    [55.03, 25.0], [54.65, 24.76], [54.37, 24.48], [53.95, 24.2], [53.4, 24.13], [52.75, 24.12],
    [52.2, 23.98], [51.75, 24.06], [51.58, 24.26], [51.42, 24.6], [51.58, 24.98], [51.53, 25.3],
    [51.62, 25.62], [51.55, 25.92], [51.22, 26.15], [51.03, 25.98], [50.85, 25.66], [50.78, 25.42],
    [50.82, 25.0], [50.8, 24.72], [50.55, 25.1], [50.42, 25.5], [50.2, 25.9], [50.1, 26.42],
    [50.16, 26.66], [49.95, 26.86], [49.65, 27.02], [49.2, 27.4], [48.85, 27.7], [48.5, 28.42],
    [48.38, 28.9], [48.0, 29.35], [48.2, 29.85], [48.6, 29.95], [48.95, 30.02], [49.5, 30.06],
    [50.17, 30.05], [50.5, 29.58], [50.82, 28.95], [51.05, 28.5], [51.35, 28.05], [51.95, 27.84],
    [52.6, 27.47], [53.1, 27.1], [53.7, 26.82], [54.3, 26.68], [54.88, 26.55], [55.35, 26.6],
    [55.75, 26.88], [56.28, 27.18], [56.75, 27.1], [57.05, 26.85], [57.12, 26.55], [57.25, 26.2],
    [57.38, 25.88], [57.78, 25.65], [58.35, 25.57], [58.9, 25.49], [59.5, 25.42], [60.1, 25.36],
    [60.62, 25.3], [61.1, 25.2], [61.5, 25.15], [61.77, 25.06], [62.33, 25.12], [62.9, 25.22],
    [63.47, 25.26], [64.1, 25.3], [64.63, 25.21], [65.3, 25.36], [66.1, 25.48], [66.6, 25.42],
    [66.98, 24.83], [67.2, 24.6], [67.35, 24.2], [67.5, 23.95], [67.9, 23.75], [68.35, 23.65],
    [68.6, 23.45], [68.72, 23.22], [69.0, 22.95], [69.35, 22.83], [69.72, 22.76], [70.0, 22.88],
    [70.22, 23.0], [70.45, 22.97], [70.35, 22.75], [70.1, 22.58], [69.83, 22.43], [69.4, 22.45],
    [69.08, 22.47], [68.97, 22.24], [69.2, 21.95], [69.6, 21.64], [69.85, 21.35], [70.1, 21.12],
    [70.37, 20.91], [70.7, 20.75], [70.98, 20.71], [71.37, 20.87], [71.76, 21.08], [72.1, 21.2],
    [72.2, 21.5], [72.2, 21.77], [72.35, 22.12], [72.62, 22.3], [72.72, 22.0], [72.58, 21.7],
    [72.65, 21.4], [72.65, 21.1], [72.78, 20.85], [72.88, 20.6], [72.83, 20.4], [72.72, 20.15],
    [72.7, 19.97], [72.7, 19.62], [72.8, 19.35], [72.82, 19.1], [72.83, 18.94], [72.87, 18.64],
    [72.96, 18.32], [73.0, 18.0], [73.17, 17.58], [73.25, 17.25], [73.3, 16.99], [73.33, 16.6],
    [73.33, 16.38], [73.47, 16.06], [73.62, 15.86], [73.8, 15.5], [73.8, 15.41], [73.95, 15.1],
    [74.1, 14.8], [74.3, 14.55], [74.45, 14.28], [74.55, 13.97], [74.67, 13.62], [74.7, 13.34],
    [74.82, 12.9], [74.98, 12.5], [75.35, 11.87], [75.77, 11.25], [75.92, 10.77], [76.05, 10.4],
    [76.24, 9.97], [76.32, 9.5], [76.57, 8.88], [76.93, 8.48], [77.54, 8.08], [78.1, 8.5],
    [78.15, 8.78], [78.5, 9.15], [79.3, 9.3], [79.85, 10.3], [79.85, 11.0], [80.3, 13.0],
    [81.5, 16.0], [82.5, 24.0], [82.5, 40.0], [44.0, 40.0], [42.0, 20.0],
  ];
  const HORN = [
    [42.0, 11.6], [44.0, 10.45], [45.0, 10.6], [46.5, 10.75], [47.6, 11.15], [48.6, 11.3],
    [49.2, 11.28], [50.1, 11.55], [50.8, 11.95], [51.27, 11.83], [51.12, 11.1], [51.4, 10.45],
    [51.0, 10.35], [50.85, 9.6], [50.45, 8.9], [49.85, 7.95], [49.1, 6.6], [48.55, 5.35],
    [47.9, 4.3], [46.9, 3.0], [45.33, 2.04], [43.0, 0.5], [41.0, -2.0], [38.0, -6.0], [36.0, 4.0],
  ];
  const SOCOTRA = [
    [53.31, 12.6], [53.55, 12.71], [53.85, 12.68], [54.2, 12.7], [54.48, 12.55], [54.2, 12.36],
    [53.9, 12.32], [53.6, 12.35], [53.4, 12.45],
  ];
  const MASIRAH = [[58.62, 20.17], [58.72, 20.42], [58.87, 20.68], [58.96, 20.6], [58.9, 20.35], [58.75, 20.15]];
  const QESHM = [[55.3, 26.62], [55.7, 26.78], [56.05, 26.95], [56.28, 26.93], [56.15, 26.72], [55.8, 26.6], [55.5, 26.55]];
  const BAHRAIN = [[50.45, 26.24], [50.62, 26.25], [50.62, 25.82], [50.5, 25.8]];
  const SRI_LANKA = [[79.9, 9.75], [80.3, 9.85], [81.0, 8.6], [81.9, 7.0], [81.6, 6.4], [80.6, 5.92], [80.05, 6.1], [79.85, 7.2], [79.75, 8.3], [79.95, 9.0]];

  const BORDERS = [
    // India – Pakistan
    [[68.4, 23.62], [69.0, 24.17], [69.6, 24.28], [70.1, 24.25], [70.6, 24.4], [71.05, 24.65], [70.95, 25.15], [70.6, 25.7], [70.15, 26.15], [70.1, 26.55], [69.55, 26.95], [69.55, 27.2], [70.05, 27.7], [70.6, 28.0], [71.9, 28.6], [72.4, 29.05], [73.05, 29.6], [73.4, 30.1], [74.0, 30.55], [74.55, 31.05], [74.55, 31.6], [74.95, 32.05], [75.35, 32.3], [74.65, 32.75], [74.25, 33.1], [73.95, 33.6], [74.15, 34.05], [73.95, 34.6], [74.4, 34.8], [75.5, 34.9], [76.8, 35.3]],
    // Iran – Pakistan
    [[61.62, 25.18], [61.75, 25.8], [61.85, 26.25], [62.3, 26.5], [63.2, 26.65], [63.3, 27.1], [62.8, 27.25], [62.78, 28.0], [62.4, 28.4], [61.65, 28.8], [61.4, 29.25], [60.87, 29.86]],
    // Pakistan – Afghanistan
    [[60.87, 29.86], [62.4, 29.4], [63.6, 29.5], [64.8, 29.6], [66.3, 29.85], [66.4, 30.5], [66.8, 31.2], [67.7, 31.4], [68.5, 31.8], [69.3, 31.95], [69.4, 32.7], [70.0, 33.0], [70.3, 33.4], [69.9, 34.0], [71.1, 34.4], [71.5, 35.0], [71.6, 35.6], [71.2, 36.4]],
    // Iran – Afghanistan
    [[60.87, 29.86], [61.3, 30.9], [61.8, 31.3], [60.85, 31.5], [60.6, 33.1], [60.5, 34.3], [61.0, 34.6], [61.2, 35.6], [61.0, 36.6]],
    // UAE – Saudi Arabia
    [[51.58, 24.26], [51.9, 23.9], [52.6, 22.95], [55.15, 22.7]],
    // UAE – Oman
    [[55.15, 22.7], [55.6, 23.4], [55.75, 24.0], [55.95, 24.3], [56.0, 24.75], [56.37, 24.98]],
    // Musandam
    [[56.08, 26.02], [56.15, 25.85], [56.28, 25.62]],
    // Saudi Arabia – Oman
    [[55.15, 22.7], [55.65, 22.0], [55.0, 20.0], [52.0, 19.0]],
    // Saudi Arabia – Yemen
    [[52.0, 19.0], [49.1, 18.6], [48.2, 18.15], [47.4, 17.1], [46.4, 17.2]],
    // Oman – Yemen
    [[52.0, 19.0], [52.75, 17.3], [53.1, 16.65]],
    // Qatar – Saudi Arabia
    [[50.82, 24.75], [51.12, 24.55], [51.42, 24.6]],
  ];

  function catmullRomPath(pts, closed) {
    const n = pts.length;
    const P = (i) => (closed ? pts[(i + n) % n] : pts[clamp(i, 0, n - 1)]);
    const f = (v) => v.toFixed(1);
    let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
    const segs = closed ? n : n - 1;
    for (let i = 0; i < segs; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
    }
    return closed ? d + 'Z' : d;
  }

  /* ════════════════════════ DOM ════════════════════════ */

  const SVGNS = 'http://www.w3.org/2000/svg';
  const $ = (sel) => document.querySelector(sel);
  const el = {};
  let routeLen = 0, bracketLen = 0, checkLen = 0;
  const dots = [];
  let routeStart = null, routeEnd = null;

  /** Seeded PRNG (mulberry32) — used only for the static background dither. */
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** Background: #0A0A0C with a radial lift to #16161A at centre, float-computed + TPDF-dithered. */
  function paintBackground() {
    const canvas = $('#bg');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const img = ctx.createImageData(W, H);
    const d = img.data;
    const rnd = mulberry32(0x5EED1080);
    const base = [10, 10, 12], lift = [22, 22, 26];
    const rx = 0.78 * W, ry = 0.58 * H;
    for (let y = 0; y < H; y++) {
      const dy = (y + 0.5 - H / 2) / ry;
      for (let x = 0; x < W; x++) {
        const dx = (x + 0.5 - W / 2) / rx;
        const r2 = dx * dx + dy * dy;
        const f = r2 >= 1 ? 0 : (1 - r2) * (1 - r2);
        const i = (y * W + x) * 4;
        const n = rnd() + rnd() - 1;            // triangular noise in (−1, 1), shared by RGB (no chroma noise)
        d[i] = Math.round(base[0] + (lift[0] - base[0]) * f + n);
        d[i + 1] = Math.round(base[1] + (lift[1] - base[1]) * f + n);
        d[i + 2] = Math.round(base[2] + (lift[2] - base[2]) * f + n);
        d[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }

  /** Glass fallback: only used if backdrop-filter is unsupported, or forced with ?glassFallback. */
  function setupGlassFallback() {
    const forced = new URLSearchParams(location.search).has('glassFallback');
    const supported = CSS.supports('backdrop-filter', 'blur(1px)') || CSS.supports('-webkit-backdrop-filter', 'blur(1px)');
    if (supported && !forced) return;
    el.panel.classList.add('fallback');
    const wrap = document.createElement('div');
    wrap.className = 'panel-backdrop';
    const clone = $('#mapsvg').cloneNode(true);
    clone.removeAttribute('id');
    clone.querySelectorAll('#route, #route-glow, #route-head, #marker, .pin').forEach((n) => n.remove());
    wrap.appendChild(clone);
    el.panel.insertBefore(wrap, el.panel.firstChild);
    el.panelBackdrop = clone;
  }

  function build() {
    paintBackground();
    el.icon = $('#icon');
    el.faceid = $('#faceid');
    el.wallet = $('#wallet');
    el.map = $('#map');
    el.panel = $('#panel');

    // Face ID: 5×5 dot grid (10 px dots, 44 px pitch).
    const dotsG = $('#fid-dots');
    for (let j = 0; j < 5; j++) {
      for (let i = 0; i < 5; i++) {
        const c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('r', '5');
        c.setAttribute('fill', '#2F7BFF');
        dotsG.appendChild(c);
        dots.push({ node: c, x: -88 + 44 * i, y: -88 + 44 * j, d: i + j });
      }
    }
    el.brackets = Array.from(document.querySelectorAll('#fid-brackets .bracket')).map((g) => ({
      g, path: g.querySelector('path'), sx: +g.dataset.sx, sy: +g.dataset.sy,
    }));
    bracketLen = el.brackets[0].path.getTotalLength();
    el.scan = $('#fid-scan');
    el.check = $('#fid-check');
    checkLen = el.check.getTotalLength();
    el.check.setAttribute('stroke-dasharray', `${checkLen} ${checkLen}`);

    // Wallet.
    el.cards = [
      { node: $('#card-red'), y: -220, r: -6 },
      { node: $('#card-green'), y: -130, r: -3 },
      { node: $('#card-blue'), y: -40, r: 0 },
    ];
    el.black = $('#card-black');
    el.balLabel = $('#bal-label');
    el.balValue = $('#bal-value');
    el.goal = $('#goal');
    el.goalFill = $('#goal-fill');

    // Map.
    const land = $('#map-land');
    for (const poly of [MAINLAND, HORN, SOCOTRA, MASIRAH, QESHM, BAHRAIN, SRI_LANKA]) {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', catmullRomPath(poly.map(project), true));
      land.appendChild(p);
    }
    const borders = $('#map-borders');
    for (const line of BORDERS) {
      const p = document.createElementNS(SVGNS, 'path');
      p.setAttribute('d', catmullRomPath(line.map(project), false));
      borders.appendChild(p);
    }
    const a = project(MUMBAI), c1 = project(ROUTE_C1), c2 = project(ROUTE_C2), b = project(DUBAI);
    const f2 = (p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`;
    const routeD = `M${f2(a)} C${f2(c1)} ${f2(c2)} ${f2(b)}`;
    el.route = $('#route');
    el.routeGlow = $('#route-glow');
    el.route.setAttribute('d', routeD);
    el.routeGlow.setAttribute('d', routeD);
    routeLen = el.route.getTotalLength();
    for (const r of [el.route, el.routeGlow]) r.setAttribute('stroke-dasharray', `${routeLen} ${routeLen}`);
    routeStart = el.route.getPointAtLength(0);
    routeEnd = el.route.getPointAtLength(routeLen);
    el.routeHead = $('#route-head');
    el.marker = $('#marker');
    el.markerHalo = $('#marker-halo');
    el.markerDot = $('#marker-dot');
    // Pins sit exactly on the route endpoints.
    el.pins = [
      { node: $('#pin-india'), at: routeStart, start: T.pins },
      { node: $('#pin-dubai'), at: routeEnd, start: T.pins + T.pinStagger },
    ].map((p) => ({
      ...p,
      shadow: p.node.querySelector('.pin-shadow'),
      body: p.node.querySelector('.pin-body'),
    }));
    for (const p of el.pins) p.node.setAttribute('transform', `translate(${p.at.x.toFixed(2)} ${p.at.y.toFixed(2)})`);

    // Panel.
    el.stats = [0, 1, 2].map((i) => $(`#stat-${i}`));
    el.valTime = $('#val-time');
    el.valMin = $('#val-min');
    el.valDist = $('#val-dist');
    el.slider = $('#slider');
    el.sliderFill = $('#slider-fill');
    el.sliderGlow = $('#slider-glow');
    el.thumb = $('#thumb');
    el.thumbGlow = $('#thumb-glow');
    el.play = $('#play');
    el.icoPlay = $('#ico-play');
    el.icoPause = $('#ico-pause');
    setupGlassFallback();

    // Debug/validation hooks (read-only).
    window.__wm = {
      T, MAP, project, routeLen, routeStart, routeEnd, flipAngle, sliderP, spring, easeOut, easeInOut,
      blurSwap, pushBack, mainland: MAINLAND.map(project), polys: [MAINLAND, HORN, SOCOTRA, MASIRAH, QESHM, BAHRAIN, SRI_LANKA].map((p) => p.map(project)),
      routePoint: (len) => { const q = el.route.getPointAtLength(len); return { x: q.x, y: q.y }; },
    };
  }

  /* ════════════════════════ style helpers ════════════════════════ */

  const n4 = (v) => (Math.abs(v) < 1e-6 ? 0 : +v.toFixed(4));

  /** Apply opacity / blur / transform to a layer. Hidden layers are skipped entirely. */
  function setLayer(node, opacity, blur, transform) {
    if (opacity <= 0.0005) {
      node.style.visibility = 'hidden';
      node.style.opacity = '0';
      node.style.filter = 'none';
      node.style.transform = 'none';
      return false;
    }
    node.style.visibility = 'visible';
    node.style.opacity = opacity >= 0.9995 ? '1' : String(n4(opacity));
    node.style.filter = blur > 0.01 ? `blur(${n4(blur)}px)` : 'none';
    node.style.transform = transform || 'none';
    return true;
  }
  const scaleT = (s) => (Math.abs(s - 1) < 1e-5 ? '' : `scale(${n4(s)})`);
  const fade = (node, o, transform) => {
    node.style.opacity = o >= 0.9995 ? '1' : String(n4(o));
    node.style.transform = transform || 'none';
  };

  function groupThousands(n) {
    const s = String(n);
    let out = '';
    for (let i = 0; i < s.length; i++) {
      if (i > 0 && (s.length - i) % 3 === 0) out += ',';
      out += s[i];
    }
    return out;
  }
  function fmtMoney(v) {
    const cents = Math.round(v * 100);
    const whole = Math.floor(cents / 100), frac = cents % 100;
    return '$' + groupThousands(whole) + '.' + String(frac).padStart(2, '0');
  }
  const fmtHM = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  /* ════════════════════════ seek(t) ════════════════════════ */

  function seek(tIn) {
    const t = clamp(+tIn || 0, 0, DURATION);
    const sw1 = blurSwap(t, T.swap1);
    const sw2 = blurSwap(t, T.swap2);
    const phi = flipAngle(t);

    /* ── 1 · App icon ─────────────────────────────────────── */
    {
      let o, b, s;
      if (t < T.swap1) {
        const p = easeOut(range(t, T.iconIn[0], T.iconIn[1]));
        o = p; b = 28 * (1 - p); s = 0.86 + 0.14 * p;
      } else {
        o = sw1.outOpacity; b = sw1.outBlur; s = sw1.outScale;
      }
      setLayer(el.icon, o, b, scaleT(s));
    }

    /* ── 2 · Face ID ──────────────────────────────────────── */
    {
      const o = t < T.swap2 ? sw1.inOpacity : sw2.outOpacity;
      const b = t < T.swap2 ? sw1.inBlur : sw2.outBlur;
      const s = t < T.swap2 ? sw1.inScale : sw2.outScale;
      if (setLayer(el.faceid, o, b, scaleT(s))) {
        // Brackets: stroke grows outward from each corner, 0 → 100 % (1.10–1.40).
        const pd = easeInOut(range(t, T.bracketDraw[0], T.bracketDraw[1]));
        const contract = 24 * spring(t - T.success);
        const shown = pd > 0.0005;
        for (const br of el.brackets) {
          const len = bracketLen * pd;
          br.path.setAttribute('stroke-dasharray', `${n4(len)} ${n4(bracketLen + 1)}`);
          br.path.setAttribute('stroke-dashoffset', String(n4(-(bracketLen - len) / 2)));
          br.path.style.opacity = shown ? String(n4(range(t, T.bracketDraw[0], T.bracketDraw[0] + 0.04))) : '0';
          br.g.setAttribute('transform', `translate(${n4(br.sx * contract)} ${n4(br.sy * contract)}) scale(${br.sx} ${br.sy})`);
        }
        // Dot grid: diagonal wave, 0.6 s period, 60 ms stagger; fades out on success.
        const out = easeOut(range(t, T.success, T.success + 0.18));
        for (const d of dots) {
          const u = (t - T.dotsStart - d.d * T.dotStagger) / T.dotPeriod;
          const w = u <= 0 ? 0 : 0.5 - 0.5 * Math.cos(2 * Math.PI * u);
          const sc = (0.6 + 0.4 * w) * (1 - 0.45 * out);
          const op = (0.35 + 0.65 * w) * (1 - out);
          d.node.setAttribute('transform', `translate(${d.x} ${d.y}) scale(${n4(sc)})`);
          d.node.setAttribute('opacity', String(n4(op)));
        }
        // Scan line: top → bottom (1.40–2.00).
        const ps = easeInOut(range(t, T.scan[0], T.scan[1]));
        const so = Math.min(range(t, T.scan[0], T.scan[0] + 0.08), 1 - range(t, T.scan[1] - 0.08, T.scan[1]));
        el.scan.setAttribute('transform', `translate(0 ${n4(-150 + 300 * ps)})`);
        el.scan.setAttribute('opacity', String(n4(so)));
        // Checkmark strokes on (2.05–2.35).
        const pc = easeInOut(range(t, T.check[0], T.check[1]));
        el.check.setAttribute('stroke-dashoffset', String(n4(checkLen * (1 - pc))));
        el.check.style.opacity = pc > 0.0005 ? '1' : '0';
      }
    }

    /* ── 3 · Wallet (fan, balance card, flip-out) ─────────── */
    {
      let o, b, tr;
      if (t < T.flip[0]) {
        o = sw2.inOpacity; b = sw2.inBlur; tr = scaleT(sw2.inScale);
      } else if (t < T.flip[1]) {
        o = 1;
        b = 18 * (phi / 90);
        const D = pushBack(547 * Math.sin((phi * Math.PI) / 180), 477);
        tr = `perspective(${PERSPECTIVE}px) translateZ(${n4(-D)}px) rotateX(${n4(-phi)}deg)`;
      } else {
        o = 0; b = 0; tr = '';
      }
      if (setLayer(el.wallet, o, b, tr)) {
        // Card fan: spring, 80 ms stagger red → green → blue.
        el.cards.forEach((c, i) => {
          const s = spring(t - (T.fanStart + i * T.fanStagger));
          const y = c.y * s, r = c.r * s;
          c.node.style.transform = Math.abs(y) < 1e-4 && Math.abs(r) < 1e-4 ? 'none' : `translateY(${n4(y)}px) rotate(${n4(r)}deg)`;
        });
        // Black card: spring slide from +900, overshoot soft-clamped to ≤ 12 px.
        const sb = spring(t - T.blackStart);
        let off = 900 * (1 - sb);
        if (off < 0) off = -12 * Math.tanh(-off / 12);
        el.black.style.visibility = off > 899.5 ? 'hidden' : 'visible';
        el.black.style.transform = Math.abs(off) < 1e-3 ? 'none' : `translateY(${n4(off)}px)`;
        // Contents enter once the card has covered ~70 % of its travel (≈ 3.35 s).
        const tc = T.blackStart + 0.15;
        const pl = easeOut(range(t, tc, tc + 0.5));
        fade(el.balLabel, pl, pl < 1 ? `translateY(${n4(16 * (1 - pl))}px)` : '');
        const pv = easeOut(range(t, tc + 0.08, tc + 0.58));
        fade(el.balValue, pv, pv < 1 ? `translateY(${n4(16 * (1 - pv))}px)` : '');
        el.balValue.textContent = fmtMoney(12480.5 * easeOutCubic(range(t, T.balance[0], T.balance[1])));
        const pg = easeOut(range(t, T.goal[0] - 0.1, T.goal[0] + 0.3));
        fade(el.goal, pg, pg < 1 ? `translateY(${n4(16 * (1 - pg))}px)` : '');
        const fillP = easeOut(range(t, T.goal[0], T.goal[1]));
        el.goalFill.style.transform = `translateX(${n4(-100 * (1 - fillP))}%)`;
      }
    }

    /* ── 4 · Map card (flip-in, tilt → flat, pins, route, marker) ─ */
    {
      let o = 0, b = 0, tr = '';
      if (t >= T.flip[1]) {
        o = 1;
        const theta = 180 - phi;                                   // 90 → 38 → 0
        const scale = t < T.flip[2] ? 0.92 : 0.92 + 0.08 * easeOut(range(t, T.flip[2], T.scaleEnd));
        b = theta >= 38 ? 10 + 8 * ((theta - 38) / 52) : 10 * (theta / 38);
        if (theta > 1e-4 || scale < 0.99999) {
          const D = pushBack(650 * scale * Math.sin((theta * Math.PI) / 180), 492 * scale);
          tr = `perspective(${PERSPECTIVE}px) translateZ(${n4(-D)}px) rotateX(${n4(theta)}deg) scale(${n4(scale)})`;
        }
      }
      if (setLayer(el.map, o, b, tr)) {
        // Pins: drop 60 px, scale 0.6 → 1 with the spring; ground shadow fades in.
        for (const p of el.pins) {
          const s = spring(t - p.start);
          const po = range(t, p.start, p.start + 0.12);
          p.body.setAttribute('transform', `translate(0 ${n4(-60 * (1 - s))}) scale(${n4(0.6 + 0.4 * s)})`);
          p.body.setAttribute('opacity', String(n4(po)));
          p.shadow.setAttribute('opacity', String(n4(clamp(s) * po)));
          p.shadow.setAttribute('transform', `scale(${n4(0.5 + 0.5 * clamp(s))})`);
        }
        // Route: dash-offset draw with ease-in-out; a leading dot rides the head.
        const pr = easeInOut(range(t, T.route[0], T.route[1]));
        const drawn = pr > 0.0005;
        for (const r of [el.route, el.routeGlow]) {
          r.setAttribute('stroke-dashoffset', String(n4(routeLen * (1 - pr))));
          r.style.opacity = drawn ? '1' : '0';
        }
        const ho = Math.min(range(t, T.route[0], T.route[0] + 0.06), 1 - range(t, T.route[1] - 0.06, T.route[1] + 0.08));
        if (ho > 0.0005) {
          const h = el.route.getPointAtLength(routeLen * pr);
          el.routeHead.setAttribute('transform', `translate(${n4(h.x)} ${n4(h.y)})`);
          el.routeHead.setAttribute('opacity', String(n4(ho)));
        } else {
          el.routeHead.setAttribute('opacity', '0');
        }
        // Live marker: position = getPointAtLength(p · length), p from the slider.
        const mo = easeOut(range(t, T.route[1] + 0.02, T.route[1] + 0.18));
        if (mo > 0.0005) {
          const p = sliderP(t);
          const m = el.route.getPointAtLength(routeLen * p);
          const active = t < T.live[1]
            ? easeOut(range(t, T.live[0], T.live[0] + 0.2))
            : 1 - easeOut(range(t, T.live[1], T.markerRest));
          el.marker.setAttribute('transform', `translate(${n4(m.x)} ${n4(m.y)})`);
          el.marker.setAttribute('opacity', String(n4(mo)));
          el.markerDot.setAttribute('transform', `scale(${n4((0.4 + 0.6 * mo) * (1 + 0.18 * active))})`);
          el.markerHalo.setAttribute('opacity', String(n4(0.55 + 0.45 * active)));
          el.markerHalo.setAttribute('transform', `scale(${n4(0.8 + 0.35 * active)})`);
        } else {
          el.marker.setAttribute('opacity', '0');
        }
      }
    }

    /* ── 5 · Glass panel ─────────────────────────────────── */
    {
      const pp = easeOut(range(t, T.panel[0], T.panel[1]));
      const o = easeOut(range(t, T.panel[0], T.panel[0] + 0.3));
      const ty = 320 * (1 - pp);
      if (setLayer(el.panel, o, 16 * (1 - pp), ty > 1e-3 ? `translateY(${n4(ty)}px)` : '')) {
        if (el.panelBackdrop) el.panelBackdrop.style.transform = ty > 1e-3 ? `translateY(${n4(-ty)}px)` : 'none';
        const p = sliderP(t);
        const remaining = 1 - p;
        const live = t >= T.live[0];
        el.stats.forEach((node, i) => {
          const s0 = T.statStart + i * T.statStagger;
          const a = easeOut(range(t, s0, s0 + 0.45));
          fade(node, a, a < 1 ? `translateY(${n4(16 * (1 - a))}px)` : '');
        });
        const cnt = (i) => easeOutCubic(range(t, T.statStart + i * T.statStagger, T.statStart + i * T.statStagger + T.statCount));
        const minutes = Math.round(185 * (live ? remaining : cnt(0)));
        const minutes2 = Math.round(185 * (live ? remaining : cnt(1)));
        const km = Math.round(1930 * (live ? remaining : cnt(2)));
        el.valTime.textContent = fmtHM(minutes);
        el.valMin.textContent = String(minutes2);
        el.valDist.textContent = groupThousands(km) + ' km';

        // Slider: thumb + fill from p(t). Pressed (1.15, brighter glow) while moving; spring release.
        el.sliderFill.style.transform = `translateX(${n4(-686 * (1 - p))}px)`;
        el.sliderGlow.style.transform = el.sliderFill.style.transform;
        el.sliderGlow.style.opacity = String(n4(0.9 * clamp(p / 0.04)));
        let press;
        if (t < T.live[1]) press = easeOut(range(t, T.live[0], T.live[0] + 0.12));
        else press = 1 - spring(t - T.live[1]);
        el.thumb.style.transform = `translateX(${n4(686 * p)}px) scale(${n4(1 + 0.15 * press)})`;
        el.thumbGlow.style.opacity = String(n4(0.45 + 0.55 * clamp(press)));
        el.thumbGlow.style.transform = `scale(${n4(0.85 + 0.35 * clamp(press))})`;

        // Play button: press 1 → 0.92 at 6.60, spring back; icon cross-fades play → pause.
        let ps = 1;
        if (t >= T.live[0]) {
          const down = easeOut(range(t, T.live[0], T.live[0] + 0.08));
          ps = t < T.live[0] + 0.08 ? 1 - 0.08 * down : 0.92 + 0.08 * spring(t - (T.live[0] + 0.08));
        }
        el.play.style.transform = Math.abs(ps - 1) < 1e-5 ? 'none' : `scale(${n4(ps)})`;
        const x = easeOut(range(t, T.live[0] + 0.02, T.live[0] + 0.2));
        fade(el.icoPlay, 1 - x, x > 0 ? `scale(${n4(1 - 0.35 * x)})` : '');
        fade(el.icoPause, x, x < 1 ? `scale(${n4(0.65 + 0.35 * x)})` : '');
      }
    }
  }

  /* ════════════════════════ boot ════════════════════════ */

  async function boot() {
    build();
    if (document.fonts && document.fonts.ready) {
      try {
        await Promise.all([
          document.fonts.load('500 28px Inter'), document.fonts.load('700 96px Inter'),
          document.fonts.load('italic 800 46px Inter'), document.fonts.load('700 52px Inter'),
        ]);
      } catch (e) { /* system font — nothing to fetch */ }
      await document.fonts.ready;
    }
    const q = new URLSearchParams(location.search);
    window.seek = seek;
    seek(q.has('t') ? parseFloat(q.get('t')) : 0);
    window.__ready = true;
    if (q.has('preview')) {
      const loop = () => { seek((performance.now() / 1000) % DURATION); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  }

  window.seek = seek;
  boot();
})();
