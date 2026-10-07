// Entry point: build the static scene once fonts are ready, attach seek(), expose it to the
// capture scripts. Preview in a browser with ?t=3.1 (served over http — see README).

import CFG from '../timeline.config.js';
import { build } from './build.js';
import { attach, seek } from './seek.js';

async function init() {
  await document.fonts.ready;
  // make sure every weight is actually loaded before measuring text
  await Promise.all([400, 500, 600, 700].map((w) => document.fonts.load(`${w} 32px Inter`)));
  const refs = build(CFG, document.getElementById('stage'));
  attach(refs);
  window.seek = seek;
  window.CFG = CFG;
  const q = new URLSearchParams(location.search).get('t');
  seek(q !== null ? parseFloat(q) : 0);
  window.__ready = true;
}

init().catch((e) => {
  window.__error = String(e && e.stack ? e.stack : e);
  console.error(e);
});
