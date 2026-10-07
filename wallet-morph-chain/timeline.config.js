// timeline.config.js — single source of truth for Wallet Morph Chain.
// Every timing (seconds), spring, easing curve, blur peak, colour, size, copy string and city
// coordinate used by src/seek.js lives here. Edit values, re-run `node scripts/stills.mjs --fast`.
//
// Conventions
//   • times are absolute seconds on the 0–7 s loop
//   • [a, b] pairs are start/end windows
//   • springs: closed-form underdamped, x(t) = 1 − e^{−ζωt}(cos ω_d t + (ζω/ω_d) sin ω_d t)
//   • easing curves are cubic-bezier control points [x1, y1, x2, y2]

export default {
  duration: 7,
  fps: 60,
  canvas: { width: 1080, height: 1080 },

  segments: {
    S1: [0.0, 1.0], // tiny blurred squircle → Wallet icon
    S2: [1.0, 2.2], // icon → glowing dots → Face ID strokes
    S3: [2.2, 3.8], // Face ID frame → small black card → tall Wallet card
    S4: [3.8, 5.0], // Wallet card → tilted white map card → flat map
    S5: [5.0, 6.3], // camera push, Dubai, route
    S6: [6.3, 7.0], // map card → tiny blurred squircle (== t=0)
  },

  springs: {
    emergence: { w: 15, z: 0.72 },
    cardGrowth: { w: 16, z: 0.82 },
    mapFlatten: { w: 14, z: 0.85 },
    labelPop: { w: 26, z: 0.7 },
  },

  easing: {
    entrance: [0.22, 1, 0.36, 1],
    routeCamera: [0.65, 0, 0.35, 1],
    exit: [0.55, 0, 1, 0.45], // accelerate away (content exits)
    exitMorph: [0.45, 0, 0.2, 1], // S6 hero morph: quick, lands at rest exactly on t = 7
  },

  // Entrances use `entrance`; exits are ~40 % faster (0.6 ×).
  durations: {
    entrance: 0.4,
    exit: 0.24,
    textIn: 0.34,
    textOut: 0.16,
    digit: 0.3,
    strokeStretch: 0.24,
    strokeRetract: 0.144,
  },

  // Blur peaks (px). Morph midpoints peak here; incoming content starts at the same blur.
  blur: {
    squircle: 20, // the t = 0 / t = 7 state
    iconToFaceId: 20,
    faceIdToCard: 18,
    cardToMap: 16,
    contentIn: 12, // text / panel / bubbles entering
    contentOut: 10, // text leaving
    landIn: 6, // continents crossfading in (SVG units)
  },

  // Soft-gray halos: black at low alpha only. { y offset, blur radius, spread, alpha }
  halo: {
    float: { y: 34, blur: 90, spread: 4, a: 0.16 }, // tiny blurred squircle (t = 0)
    icon: { y: 16, blur: 40, spread: 0, a: 0.13 },
    card: { y: 22, blur: 70, spread: 0, a: 0.2 },
    mapFloat: { y: 70, blur: 150, spread: 10, a: 0.26 },
    mapSettled: { y: 18, blur: 46, spread: 0, a: 0.11 },
    bubbleFloat: { y: 16, blur: 30, a: 0.22 },
    bubbleSettled: { y: 6, blur: 14, a: 0.16 },
  },

  palette: {
    background: '#FFFFFF',
    vignette: '#F5F5F6',
    faceId: '#1E90FF',
    cardTop: '#151515',
    cardBottom: '#000000',
    stack: ['#489CCB', '#5CC24A', '#F07566'],
    progress: '#22E83C',
    continents: '#BFBFBF',
    route: '#2F8CFF',
    origin: '#FFC83D',
    destination: '#EF5B55',
    glass: 'rgba(70,70,70,0.55)',
    play: '#0A84FF',
    white: '#FFFFFF',
    ink: '#151515', // dark text on white (icon label, bubble fill)
    // Wallet icon neutrals (not in the brief's palette list — restrained neutrals, see README)
    iconOuter: '#E9E9EB',
    iconInner: '#2B2B2D',
    iconPocket: '#F4EBD9',
    iconScallop: '#F07566',
    // the icon's four thin card edges, back → front
    iconCardEdges: ['#489CCB', '#5CC24A', '#F07566', '#FFC83D'],
  },

  typography: {
    family: 'Inter',
    tracking: '-0.02em',
    iconLabel: { size: 36, weight: 600 },
    walletTitle: { size: 56, weight: 600 },
    caption: { size: 26, weight: 500 },
    balance: { size: 64, weight: 700 },
    cardText: { size: 32, weight: 500 },
    bubble: { size: 28, weight: 600 },
    statLabel: { size: 20, weight: 500 },
    statValue: { size: 26, weight: 600 },
  },

  copy: {
    iconLabel: 'Wallet',
    walletTitle: 'Wallet',
    currency: '$', // brief's symbol was lost in transit — swap for '₹', '€', 'AED ' …
    balance: '120,000', // revealed digit-by-digit (never counted up)
    balanceLabel: 'Balance',
    progressLabel: 'Savings goal',
    cardKind: 'Debit',
    cardNumber: '•••• 4092',
    origin: 'India',
    destination: 'Dubai',
    stats: [
      { label: 'Time', value: '3h 05m' },
      { label: 'Flight', value: '185 min' },
      { label: 'Distance', value: '1,930 km' },
    ],
  },

  cities: {
    origin: { name: 'Mumbai', lon: 72.88, lat: 19.08 },
    destination: { name: 'Dubai', lon: 55.27, lat: 25.2 },
  },

  // Map card plane: 920 × 490 viewBox. Base view is Mercator, centred on lon/lat at `scale` px/deg.
  map: {
    width: 920,
    height: 490,
    radius: 36,
    center: { lon: 64.0, lat: 19.5 },
    scale: 16.3, // px per degree at zoom 1
    graticuleStep: 5, // degrees
    routeBow: 0.06, // control-point offset as a fraction of chord length (bows south over the sea)
    tilt: { rotateX: 24, rotateZ: -8, perspective: 1700 },
  },

  camera: {
    window: [5.0, 5.8], // push (eased with easing.routeCamera)
    zoom: 2.3, // on the Mumbai–Dubai midpoint
    lutStep: 1 / 240, // baked lookup table resolution
  },

  // Hero geometry keyframes (stage px; cx/cy = centre; k = corner-shape superellipse exponent)
  hero: {
    squircle: { cx: 540, cy: 512, w: 120, h: 120, r: 38, k: 2, rot: -12, opacity: 0.55 },
    icon: { cx: 540, cy: 500, w: 340, h: 340, r: 104, k: 2, rot: 0, opacity: 1 },
    condensed: { cx: 540, cy: 520, w: 236, h: 236, r: 72, k: 2, rot: -4 },
    glyphFrame: { cx: 540, cy: 540, w: 330, h: 330, r: 92, k: 2, rot: -12 },
    smallCard: { cx: 540, cy: 540, w: 220, h: 140, r: 26, k: 1.4, rot: -12 },
    walletCard: { cx: 540, cy: 718, w: 907, h: 900, r: 44, k: 1, rot: 0 }, // top = 268, cropped below
    mapCard: { cx: 540, cy: 540, w: 920, h: 490, r: 36, k: 1, rot: 0 },
  },

  stackCards: { peek: 34, inset: 18, height: 220 },
  faceId: { size: 330, stroke: 14, cx: 540, cy: 540 },
  iconLabelGap: 26,

  // Stats panel (map-card plane px, lower-left)
  panel: { x: 24, y: 318, w: 452, h: 148, radius: 28, enterFrom: { x: -14, y: 14 } },

  times: {
    s1: {
      hero: 0.0, // emergence spring start
      inner: 0.1, // inner squircle (content trails the outer shape by 100 ms)
      edges: 0.15, // four card edges…
      edgeStagger: 0.04,
      pocket: 0.31,
      scallop: 0.35,
      label: 0.47, // label pop spring
    },
    s2: {
      labelOut: 1.0,
      blur: [1.0, 1.2, 1.42], // rise, peak, settle (icon → dots, shared by both)
      condense: [1.0, 1.34], // icon shrinks while blurring
      heroFade: [1.08, 1.34],
      dotsIn: [1.06, 1.28],
      dotsTravel: [1.04, 1.36],
      frameMorph: [1.34, 1.8], // invisible hero bounds become the glyph frame
      strokes: 1.35, // first stretch (brackets → eyes → nose → smile)
      strokeStagger: 0.04,
    },
    s3: {
      retract: 2.2, // strokes shrink back into dots (reverse stagger)
      retractStagger: 0.015,
      converge: [2.26, 2.46], // dots pull in toward the forming card
      glyphBlur: [2.22, 2.38],
      glyphFade: [2.3, 2.46],
      emerge: [2.2, 2.45], // glyph frame → small black card (blur-through)
      alphaIn: [2.27, 2.45],
      growth: 2.45, // card-growth spring
      stack: 2.7,
      stackStagger: 0.04,
      creditCard: 2.84,
      title: 2.95,
      plus: 2.99,
      bag: 3.03,
      balanceLabel: 3.05,
      digits: 3.08,
      digitStagger: 0.04,
      cardText: 3.1,
      progressLabel: 3.12,
      progressTrack: 3.12,
      progress: [3.15, 3.7], // 48 % → 80 %
      progressFrom: 0.48,
      progressTo: 0.8,
    },
    s4: {
      contentOut: 3.8,
      contentStagger: 0.03,
      stackSink: [3.8, 4.06],
      morph: [3.84, 4.34],
      blur: [3.84, 4.0, 4.22],
      fill: [3.9, 4.1],
      opacityDip: 0.72,
      tiltIn: [3.84, 4.3],
      graticule: [4.04, 4.3],
      ring: 4.2,
      india: 4.3,
      continents: [4.3, 4.62],
      graticuleOut: [4.34, 4.62],
      flatten: 4.4, // map flatten spring
      panel: 4.58,
      panelContent: 4.68,
    },
    s5: {
      uae: [5.3, 5.58],
      dubai: 5.42,
      route: [5.5, 6.12],
      pulse: [5.5, 5.8], // play button 1.0 → 1.06 → 1.0
    },
    s6: {
      contentOut: 6.3, // bubbles + panel text, then panel glass, then route
      contentStagger: 0.03,
      mapFade: [6.4, 6.64],
      morph: [6.38, 7.0],
    },
  },
};
