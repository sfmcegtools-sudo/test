// Builds the static DOM/SVG once from timeline.config.js and returns element references plus
// static measurements (path lengths, bubble sizes). Nothing here animates; seek(t) does that.

import { ICON, FACE_PATHS, squirclePath, scallopPath, plusButtonSVG, moneyBagSVG, playButtonSVG, creditCardSVG } from './art.js';
import { MAINLAND, AFRICA, ISLANDS, UAE_REGION, makeProjection, smoothPath, polyPath } from './geo.js';

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export function build(cfg, stage) {
  const P = cfg.palette;
  const TY = cfg.typography;
  const C = cfg.copy;
  const M = cfg.map;
  const project = makeProjection(M);
  const font = `${TY.family}, sans-serif`;

  /* ── stack cards (behind the hero) ── */
  const stackHTML = P.stack.map((c, i) => `<div class="stack-card" data-i="${i}" style="background:${c}"></div>`).join('');

  /* ── icon internals (inside hero) ── */
  const I = ICON;
  const edges = P.iconCardEdges.map((c, i) =>
    `<rect class="ic-edge" x="${I.edges.x}" y="${I.edges.tops[i]}" width="${I.edges.w}" height="${I.edges.h}" rx="${I.edges.rx}" fill="${c}"/>`).join('');
  const innerD = squirclePath(I.inner.x, I.inner.y, I.inner.w, I.inner.h, I.inner.r);
  const iconSVG = `<svg id="icon-art" viewBox="0 0 340 340" preserveAspectRatio="xMidYMid meet">
    <defs><clipPath id="ic-clip"><path d="${innerD}"/></clipPath></defs>
    <path id="ic-inner" d="${innerD}" fill="${P.iconInner}"/>
    <g clip-path="url(#ic-clip)">
      <g id="ic-edges">${edges}</g>
      <path id="ic-scallop" d="${scallopPath()}" fill="${P.iconScallop}"/>
      <rect id="ic-pocket" x="${I.inner.x}" y="${I.pocketTop}" width="${I.inner.w}" height="${I.inner.y + I.inner.h - I.pocketTop + 4}" fill="${P.iconPocket}"/>
    </g>
  </svg>`;

  /* ── map (inside hero, on the 3D card plane) ── */
  const step = M.graticuleStep;
  const grat = [];
  for (let lon = 30; lon <= 100; lon += step) {
    const a = project([lon, -5]), b = project([lon, 40]);
    grat.push({ d: `M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`, k: Math.abs(a[0] - M.width / 2) / M.width });
  }
  for (let lat = 0; lat <= 40; lat += step) {
    const a = project([25, lat]), b = project([105, lat]);
    grat.push({ d: `M${a[0].toFixed(2)},${a[1].toFixed(2)}L${b[0].toFixed(2)},${b[1].toFixed(2)}`, k: Math.abs(a[1] - M.height / 2) / M.height });
  }
  const mainD = smoothPath(MAINLAND.map(project));
  const landPaths = [mainD, smoothPath(AFRICA.map(project)), ...ISLANDS.map((isl) => smoothPath(isl.map(project)))];
  const uaeD = polyPath(UAE_REGION.map(project));

  const mapSVG = `<svg id="map" viewBox="0 0 ${M.width} ${M.height}" preserveAspectRatio="xMidYMid slice">
    <defs>
      <clipPath id="clip-mainland"><path d="${mainD}"/></clipPath>
      <filter id="f-land" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur id="f-land-blur" stdDeviation="0"/></filter>
      <filter id="f-route-glow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1120" height="690"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id="f-head-glow" filterUnits="userSpaceOnUse" x="-100" y="-100" width="1120" height="690"><feGaussianBlur stdDeviation="9"/></filter>
    </defs>
    <g id="cam">
      <g id="graticule" fill="none" stroke="${P.continents}" stroke-width="1.6" stroke-linecap="butt">
        ${grat.map((g) => `<path d="${g.d}" pathLength="1" data-k="${g.k.toFixed(4)}"/>`).join('')}
      </g>
      <g id="land" fill="${P.continents}">${landPaths.map((d) => `<path d="${d}"/>`).join('')}</g>
      <path id="uae" d="${uaeD}" fill="${P.destination}" clip-path="url(#clip-mainland)"/>
    </g>
    <g id="overlay">
      <path id="route-glow" fill="none" stroke="${P.route}" stroke-width="16" stroke-linecap="round" filter="url(#f-route-glow)" opacity="0.35"/>
      <path id="route" fill="none" stroke="${P.route}" stroke-width="6" stroke-linecap="round"/>
      <g id="dest"><circle r="11" fill="#FFFFFF"/><circle r="7" fill="${P.destination}"/></g>
      <g id="ring"><circle r="15" fill="#FFFFFF" stroke="${P.origin}" stroke-width="6"/><circle r="5.5" fill="${P.origin}"/></g>
      <circle id="head-glow" r="20" fill="${P.route}" filter="url(#f-head-glow)" opacity="0.55"/>
      <g id="head"><circle r="11" fill="#FFFFFF"/><circle r="7.5" fill="${P.route}"/></g>
    </g>
  </svg>`;

  /* ── wallet card content (flat layer clipped to the hero's 2D box) ── */
  const digits = (C.currency + C.balance).split('').map((ch) => `<span class="w-digit">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
  const walletHTML = `
    <div class="w-item w-title" style="font-size:${TY.walletTitle.size}px;font-weight:${TY.walletTitle.weight}">${esc(C.walletTitle)}</div>
    <div class="w-item w-plus">${plusButtonSVG(68, P.white, P.cardBottom)}</div>
    <div class="w-item w-bag">${moneyBagSVG(72, P.iconPocket, P.iconScallop, P.cardTop, C.currency, font)}</div>
    <div class="w-item w-bal-label" style="font-size:${TY.caption.size}px;font-weight:${TY.caption.weight}">${esc(C.balanceLabel)}</div>
    <div class="w-bal" style="font-size:${TY.balance.size}px;font-weight:${TY.balance.weight}">${digits}</div>
    <div class="w-item w-prog-label" style="font-size:${TY.caption.size}px;font-weight:${TY.caption.weight}">${esc(C.progressLabel)}</div>
    <div class="w-item w-track"><div class="w-fill" style="background:${P.progress}"></div></div>
    <div class="w-item w-cc">${creditCardSVG(803, 480, P)}
      <div class="cc-kind" style="font-size:${TY.cardText.size}px;font-weight:600">${esc(C.cardKind)}</div>
      <div class="cc-num" style="font-size:${TY.cardText.size}px;font-weight:${TY.cardText.weight}">${esc(C.cardNumber)}</div>
    </div>`;

  /* ── Face ID (full-stage SVG; glyph box translated to centre) ── */
  const F = cfg.faceId;
  const fx = F.cx - F.size / 2, fy = F.cy - F.size / 2;
  const facePaths = FACE_PATHS.map((p) => `<path id="fp-${p.id}" d="${p.d}"/>`).join('');
  const faceSVG = `<svg id="faceid" width="${cfg.canvas.width}" height="${cfg.canvas.height}" viewBox="0 0 ${cfg.canvas.width} ${cfg.canvas.height}">
    <defs>
      <filter id="fid-glow-a" filterUnits="userSpaceOnUse" x="-120" y="-120" width="570" height="570"><feGaussianBlur stdDeviation="7"/></filter>
      <filter id="fid-glow-b" filterUnits="userSpaceOnUse" x="-120" y="-120" width="570" height="570"><feGaussianBlur stdDeviation="20"/></filter>
    </defs>
    <g transform="translate(${fx} ${fy})" fill="none" stroke="${P.faceId}" stroke-linecap="round" stroke-linejoin="round">
      <g id="fid-glow-wide" filter="url(#fid-glow-b)" opacity="0.32"><use href="#fid-core" stroke-width="${F.stroke * 2.2}"/></g>
      <g id="fid-glow-near" filter="url(#fid-glow-a)" opacity="0.5"><use href="#fid-core" stroke-width="${F.stroke * 1.3}"/></g>
      <g stroke-width="${F.stroke}"><g id="fid-core">${facePaths}</g></g>
    </g>
  </svg>`;

  /* ── bubbles + stats panel (flat layers) ── */
  const bubble = (id, text, dot) => `<div class="bubble" id="${id}">
      <div class="pill" style="background:${P.ink}"><div class="pill-in" style="font-size:${TY.bubble.size}px;font-weight:${TY.bubble.weight}"><span class="b-dot" style="background:${dot}"></span><span class="b-txt">${esc(text)}</span></div></div>
      <svg class="ptr" width="22" height="10" viewBox="0 0 22 10"><path d="M0,0H22L13.2,8.6C12,9.8 10,9.8 8.8,8.6Z" fill="${P.ink}"/></svg>
    </div>`;
  const PN = cfg.panel;
  const stats = C.stats.map((s) => `<div class="stat"><div class="s-lbl" style="font-size:${TY.statLabel.size}px;font-weight:${TY.statLabel.weight}">${esc(s.label)}</div><div class="s-val" style="font-size:${TY.statValue.size}px;font-weight:${TY.statValue.weight}">${esc(s.value)}</div></div>`).join('');
  const panelHTML = `<div id="panel" style="width:${PN.w}px;height:${PN.h}px;border-radius:${PN.radius}px;background:${P.glass}">
      <div class="p-in"><div class="stats">${stats}</div>
      <div class="ctrl"><div class="play">${playButtonSVG(40, P.play)}</div>
        <div class="track"><div class="track-fill"></div><div class="thumb"></div></div></div></div>
    </div>`;

  stage.innerHTML = `
    <div id="stack">${stackHTML}</div>
    <div id="hero">${iconSVG}${mapSVG}</div>
    <div id="wallet-ui">${walletHTML}</div>
    ${faceSVG}
    <div id="icon-label" style="font-size:${TY.iconLabel.size}px;font-weight:${TY.iconLabel.weight};color:${P.ink}">${esc(C.iconLabel)}</div>
    ${bubble('b-origin', C.origin, P.origin)}
    ${bubble('b-dest', C.destination, P.destination)}
    ${panelHTML}`;

  const $ = (s) => stage.querySelector(s);
  const $$ = (s) => Array.from(stage.querySelectorAll(s));

  // Static measurements (layout is font-dependent → measured once after fonts are ready).
  const faces = FACE_PATHS.map((p) => {
    const el = $(`#fp-${p.id}`);
    const L = el.getTotalLength();
    const a = el.getPointAtLength(L * p.anchor);
    return { ...p, el, L, ax: a.x, ay: a.y };
  });
  const measureBubble = (id) => {
    const root = $('#' + id);
    const inner = root.querySelector('.pill-in');
    return { root, pill: root.querySelector('.pill'), inner, ptr: root.querySelector('.ptr'), w: Math.ceil(inner.offsetWidth), h: Math.ceil(inner.offsetHeight) };
  };
  const track = $('#panel .track');

  return {
    project,
    stack: $$('.stack-card'),
    hero: $('#hero'),
    iconArt: $('#icon-art'),
    icInner: $('#ic-inner'),
    icEdges: $$('.ic-edge'),
    icScallop: $('#ic-scallop'),
    icPocket: $('#ic-pocket'),
    map: $('#map'),
    cam: $('#cam'),
    graticule: $('#graticule'),
    gratLines: $$('#graticule path').map((el) => ({ el, k: +el.dataset.k })),
    land: $('#land'),
    landBlur: $('#f-land-blur'),
    uae: $('#uae'),
    route: $('#route'),
    routeGlow: $('#route-glow'),
    ring: $('#ring'),
    dest: $('#dest'),
    head: $('#head'),
    headGlow: $('#head-glow'),
    wallet: $('#wallet-ui'),
    wTitle: $('.w-title'),
    wPlus: $('.w-plus'),
    wBag: $('.w-bag'),
    wBalLabel: $('.w-bal-label'),
    wDigits: $$('.w-digit'),
    wProgLabel: $('.w-prog-label'),
    wTrack: $('.w-track'),
    wFill: $('.w-fill'),
    wCC: $('.w-cc'),
    faceSvg: $('#faceid'),
    faces,
    label: $('#icon-label'),
    labelW: $('#icon-label').offsetWidth,
    bOrigin: measureBubble('b-origin'),
    bDest: measureBubble('b-dest'),
    panel: $('#panel'),
    panelInner: $('#panel .p-in'),
    play: $('#panel .play'),
    trackFill: $('#panel .track-fill'),
    thumb: $('#panel .thumb'),
    trackW: track.offsetWidth,
  };
}
