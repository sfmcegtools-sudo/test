// Pure math helpers: clamping, interpolation, cubic-bezier easing, closed-form springs, colour mixing.
// Nothing here keeps state between calls.

export const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Normalised progress of t through [t0, t1], clamped to 0..1. */
export const range = (t, t0, t1) => clamp((t - t0) / (t1 - t0));
export const smoothstep = (x) => {
  const u = clamp(x);
  return u * u * (3 - 2 * u);
};

/** Cubic-bezier easing (same maths as CSS timing functions). Returns y(x). */
export function cubicBezier([x1, y1, x2, y2]) {
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
  const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = (u) => ((ax * u + bx) * u + cx) * u;
  const sy = (u) => ((ay * u + by) * u + cy) * u;
  const dx = (u) => (3 * ax * u + 2 * bx) * u + cx;
  function solveX(x) {
    let u = x;
    for (let i = 0; i < 8; i++) {
      const e = sx(u) - x;
      if (Math.abs(e) < 1e-7) return u;
      const d = dx(u);
      if (Math.abs(d) < 1e-6) break;
      u -= e / d;
    }
    let lo = 0, hi = 1;
    u = x;
    for (let i = 0; i < 40; i++) {
      const v = sx(u);
      if (Math.abs(v - x) < 1e-7) return u;
      if (x > v) lo = u; else hi = u;
      u = (lo + hi) / 2;
    }
    return u;
  }
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sy(solveX(x)));
}

/**
 * Closed-form underdamped spring from rest at 0 toward 1.
 * x(t) = 1 − e^{−ζωt}(cos ω_d t + (ζω/ω_d) sin ω_d t), ω_d = ω√(1−ζ²); 0 for t ≤ 0.
 */
export function spring(t, { w, z }) {
  if (t <= 0) return 0;
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + ((z * w) / wd) * Math.sin(wd * t));
}

/** Smooth 0 → 1 → 0 bump: rises over [t0, tp], falls over [tp, t1] (sine-shaped, zero slope at ends). */
export function bump(t, t0, tp, t1) {
  if (t <= t0 || t >= t1) return 0;
  const u = t < tp ? (t - t0) / (tp - t0) : (t1 - t) / (t1 - tp);
  return 0.5 - 0.5 * Math.cos(Math.PI * u);
}

/* ── colour ─────────────────────────────────────────────────────────── */

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
/** Mix two hex colours (sRGB) → 'rgb(r,g,b)'. */
export function mixHex(a, b, t) {
  const A = hexToRgb(a), B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(lerp(v, B[i], clamp(t))));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* ── formatting ─────────────────────────────────────────────────────── */

/** Fixed-precision number for style strings (avoids '-0' and float noise). */
export const n = (v, d = 3) => {
  const s = (+v).toFixed(d);
  return s === '-0.000' || s === '-0.00' || s === '-0.0' || s === '-0' ? '0' : s;
};
export const px = (v) => `${n(v)}px`;
