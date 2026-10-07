// Static SVG artwork (icon internals, Face ID strokes, money bag, buttons, credit card).
// Geometry only — colours come from the config palette passed in.

/** Rounded rect with superelliptic corners (exponent 4 ≈ CSS `corner-shape: squircle`). */
export function squirclePath(x, y, w, h, r, exp = 4, seg = 10) {
  const q = 2 / exp;
  const pts = [];
  const corner = (cx, cy, a0) => {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      const c = Math.cos(a), s = Math.sin(a);
      pts.push([cx + r * Math.sign(c) * Math.abs(c) ** q, cy + r * Math.sign(s) * Math.abs(s) ** q]);
    }
  };
  corner(x + w - r, y + r, -Math.PI / 2); // top-right
  corner(x + w - r, y + h - r, 0); // bottom-right
  corner(x + r, y + h - r, Math.PI / 2); // bottom-left
  corner(x + r, y + r, Math.PI); // top-left
  return 'M' + pts.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join('L') + 'Z';
}

/* ── Wallet icon (340 × 340 viewBox; the outer squircle is the hero element itself) ── */
export const ICON = {
  inner: { x: 48, y: 48, w: 244, h: 244, r: 76 },
  edges: { x: 74, w: 192, tops: [76, 97, 118, 139], h: 100, rx: 16 },
  scallop: { y: 176, bumpR: 6, count: 17 },
  pocketTop: 181,
};

export function scallopPath() {
  const { x, w } = ICON.inner;
  const { y, bumpR, count } = ICON.scallop;
  const bw = w / count;
  let d = `M${x},${y + 12}L${x},${y}`;
  for (let i = 0; i < count; i++) d += `a${(bw / 2).toFixed(3)},${bumpR} 0 0 1 ${bw.toFixed(3)},0`;
  d += `L${x + w},${y + 12}Z`;
  return d;
}

/* ── Face ID glyph: 330 × 330 box, 14 px round-cap strokes ──
 * anchor = fraction along the path where the dot sits and from which the stroke stretches. */
export const FACE_PATHS = [
  { id: 'br-tl', group: 'bracket', d: 'M7,99V41C7,22.2 22.2,7 41,7H99', anchor: 0.5 },
  { id: 'br-tr', group: 'bracket', d: 'M231,7H289C307.8,7 323,22.2 323,41V99', anchor: 0.5 },
  { id: 'br-br', group: 'bracket', d: 'M323,231V289C323,307.8 307.8,323 289,323H231', anchor: 0.5 },
  { id: 'br-bl', group: 'bracket', d: 'M99,323H41C22.2,323 7,307.8 7,289V231', anchor: 0.5 },
  { id: 'eye-l', group: 'eye', d: 'M112,116V150', anchor: 0.5 },
  { id: 'eye-r', group: 'eye', d: 'M218,116V150', anchor: 0.5 },
  { id: 'nose', group: 'nose', d: 'M165,116V188C165,199 158,205 147,205H141', anchor: 0 },
  { id: 'smile', group: 'smile', d: 'M106,234C132,265 198,265 224,234', anchor: 0.5 },
];

/* ── small icons ── */
export function plusButtonSVG(size, fill, ink) {
  const c = size / 2, a = size * 0.22;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${c}" fill="${fill}"/>` +
    `<path d="M${c - a},${c}H${c + a}M${c},${c - a}V${c + a}" stroke="${ink}" stroke-width="${(size * 0.075).toFixed(2)}" stroke-linecap="round"/></svg>`;
}

export function moneyBagSVG(size, fill, tie, ink, currency, font) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 72 72">` +
    `<path d="M25,6C29,9 33,9.5 36,9.5C39,9.5 43,9 47,6C49,5 50.5,6.5 49.5,8.5L44.5,19H27.5L22.5,8.5C21.5,6.5 23,5 25,6Z" fill="${fill}"/>` +
    `<rect x="25.5" y="18.5" width="21" height="6" rx="3" fill="${tie}"/>` +
    `<path d="M29,25C17,32 9,43 9,53C9,63 18,68 36,68C54,68 63,63 63,53C63,43 55,32 43,25Z" fill="${fill}"/>` +
    `<text x="36" y="56" text-anchor="middle" font-family="${font}" font-weight="700" font-size="24" fill="${ink}" letter-spacing="-0.48">${currency.trim()}</text>` +
    `</svg>`;
}

export function playButtonSVG(size, fill) {
  const c = size / 2;
  const s = size * 0.2;
  // optically centred triangle
  const x0 = c - s * 0.7, x1 = c + s * 1.0;
  return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><circle cx="${c}" cy="${c}" r="${c}" fill="${fill}"/>` +
    `<path d="M${x0.toFixed(2)},${(c - s).toFixed(2)}L${x1.toFixed(2)},${c}L${x0.toFixed(2)},${(c + s).toFixed(2)}Z" fill="#FFFFFF" stroke="#FFFFFF" stroke-width="${(size * 0.06).toFixed(2)}" stroke-linejoin="round"/></svg>`;
}

/** Credit card face (shapes only; text is HTML on top). */
export function creditCardSVG(w, h, P) {
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<defs><linearGradient id="cc-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.stack[0]}"/><stop offset="1" stop-color="${P.faceId}"/></linearGradient></defs>` +
    `<rect width="${w}" height="${h}" rx="30" fill="url(#cc-g)"/>` +
    // chip
    `<rect x="48" y="150" width="86" height="64" rx="14" fill="${P.iconPocket}"/>` +
    `<path d="M48,182H134M77,150V214M105,150V214" stroke="${P.stack[0]}" stroke-width="3" opacity="0.55"/>` +
    // contactless arcs
    `<g fill="none" stroke="#FFFFFF" stroke-width="5" stroke-linecap="round" opacity="0.9">` +
    `<path d="M${w - 92},166A22,22 0 0 1 ${w - 92},198"/><path d="M${w - 78},156A36,36 0 0 1 ${w - 78},208"/><path d="M${w - 64},146A50,50 0 0 1 ${w - 64},218"/></g>` +
    `</svg>`;
}
