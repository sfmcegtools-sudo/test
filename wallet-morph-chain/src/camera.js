// Camera lookup table: zoom + centre baked at a fixed step (1/240 s) over the camera window.
// seek(t) samples it (linear interpolation between baked entries). Applied to the map content only.

import { cubicBezier, clamp, lerp } from './math.js';

/**
 * @param cfg  timeline config
 * @param from {x,y} base-px camera centre at zoom 1 (map centre)
 * @param to   {x,y} base-px camera target (Mumbai–Dubai midpoint)
 */
export function bakeCameraLUT(cfg, from, to) {
  const [t0, t1] = cfg.camera.window;
  const step = cfg.camera.lutStep;
  const ease = cubicBezier(cfg.easing.routeCamera);
  const count = Math.round((t1 - t0) / step);
  const lnZ = Math.log(cfg.camera.zoom);
  const entries = new Float64Array((count + 1) * 3);
  for (let i = 0; i <= count; i++) {
    const e = ease(i / count);
    // Zoom interpolates in log space (perceptually even push); centre follows the same ease.
    entries[i * 3] = Math.exp(lnZ * e);
    entries[i * 3 + 1] = lerp(from.x, to.x, e);
    entries[i * 3 + 2] = lerp(from.y, to.y, e);
  }
  return { t0, t1, step, count, entries };
}

/** Sample the LUT at time t → { z, x, y } (holds the end values outside the window). */
export function sampleCamera(lut, t) {
  const f = clamp((t - lut.t0) / lut.step, 0, lut.count);
  const i = Math.min(Math.floor(f), lut.count - 1);
  const u = f - i;
  const E = lut.entries;
  return {
    z: lerp(E[i * 3], E[i * 3 + 3], u),
    x: lerp(E[i * 3 + 1], E[i * 3 + 4], u),
    y: lerp(E[i * 3 + 2], E[i * 3 + 5], u),
  };
}
