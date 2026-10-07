# Build "Wallet — Unlock to Route" UI Motion Piece

## Objective
Create an 8.0-second, 60 fps, deterministic UI animation of a Wallet app: the app icon comes into focus, a Face ID scan unlocks it, a card stack fans out with a black balance card, then the view flips into a tilted 3D map card that flattens, shows an India → Dubai route, and ends on a frosted-glass stats panel. Build it as HTML/CSS/JS driven by a single `seek(t)` function and render it to MP4 with Playwright + FFmpeg.

## Visual Style
- **Canvas**: 1080 × 1920 (9:16, portrait phone UI), rendered at device scale 1. The phone screen fills the canvas; no device frame.
- **Background**: near-black `#0A0A0C` with a very subtle radial lift to `#16161A` at center.
- **Palette** (do not add others):
  - Face ID / route blue: `#2F7BFF`, glow `rgba(47,123,255,0.55)`
  - Card blue `#2F6BFF`, card green `#1FB866`, card red `#FF4B4B`
  - Black card `#050505` with 1px border `rgba(255,255,255,0.08)`
  - Progress green `#34E07A` on track `rgba(255,255,255,0.12)`
  - Text: primary `#FFFFFF`, secondary `rgba(255,255,255,0.6)`
  - Map: land `#1C1F26`, water `#0E1015`, borders `rgba(255,255,255,0.08)`
- **Typography**: Inter (load locally or via Google Fonts, wait for `document.fonts.ready`). Balance 96px / 700 / tabular numerals; labels 28px / 500; stat values 52px / 700 tabular; stat labels 24px / 500 secondary.
- **Radii**: app icon 96px (on a 420px icon), cards 44px, glass panel 56px, buttons fully round.
- **Shadows**: cards `0 40px 80px rgba(0,0,0,0.5)`; blue elements get a soft outer glow (`drop-shadow(0 0 24px glow)`), not hard shadows.
- **Frosted glass**: `backdrop-filter: blur(40px) saturate(160%)`, fill `rgba(255,255,255,0.08)`, 1px border `rgba(255,255,255,0.14)`, inner top highlight.
- **Icons**: single consistent 3px-stroke line style (play, flag, clock, timer, distance).

## Animation Sequence
Total 8.00 s = 480 frames. Every screen change uses the shared **blur-swap** transition (defined under Motion Behaviour).

| # | Time (s) | State |
|---|----------|-------|
| 1 | 0.00–0.80 | **Icon focus.** Wallet app icon (420px, black tile with blue/green/red card glyph) centered. Starts blur 28px, scale 0.86, opacity 0 → ends blur 0, scale 1.0, opacity 1. |
| 2 | 0.80–1.10 | Blur-swap: icon → Face ID screen. |
| 3 | 1.10–2.40 | **Face ID scan.** Four blue corner brackets (each 120px arms, 8px stroke, round caps) form a 360px square. Brackets draw in via stroke length 0→100% (1.10–1.40). Inside, a 5×5 grid of 10px blue dots pulses in a diagonal wave (each dot scale 0.6→1.0→0.6, opacity 0.35→1→0.35, 0.6 s period, 60 ms stagger along the diagonal). A horizontal glowing scan line sweeps top→bottom (1.40–2.00). **Success at 2.00:** brackets contract inward 24px with a soft spring, dots fade out, a blue checkmark strokes on (2.05–2.35). |
| 4 | 2.40–2.70 | Blur-swap: Face ID → Wallet. |
| 5 | 2.70–3.40 | **Card fan.** Three cards (900 × 560) start stacked dead-center. They fan to final offsets with 80 ms stagger (red first, then green, then blue on top): red `y −220, rotate −6°`, green `y −130, rotate −3°`, blue `y −40, rotate 0°`. Each card shows a white network wordmark and last-4 digits. |
| 6 | 3.20–4.20 | **Black balance card** slides up from `y +900` (off-screen bottom) to rest overlapping the stack bottom (3.20–3.75). Contents enter after the card reaches ~70% of travel: label "Balance" fades/rises 16px; value counts up `$0.00 → $12,480.50` (3.55–4.05, ease-out, tabular so width never jumps); green progress bar fills 0 → 68% (3.70–4.20) with label "68% of monthly goal". |
| 7 | 4.20–4.80 | **Flip into map.** The whole wallet view rotates `rotateX 0 → −90°` (perspective 1600px, origin center) while blurring 0 → 18px; at 4.50 swap to the map card, which continues from `rotateX 90°` toward its tilted rest. |
| 8 | 4.80–5.50 | **Map flattens.** Map card (full width minus 48px gutters, 1300px tall, radius 44px) settles from `rotateX 38°, scale 0.92, blur 10px` → `rotateX 0°, scale 1.0, blur 0`. |
| 9 | 5.10–5.50 | **Flag pins** drop in: India pin (labelled "India", placed at Mumbai) then Dubai pin, 140 ms stagger. Each falls 60px, scale 0.6 → 1.0 with slight overshoot, small ground shadow fades in. |
| 10 | 5.40–6.50 | **Route line** draws India → Dubai as a quadratic/cubic Bézier arcing north over the Arabian Sea: 6px blue stroke + 18px glow underlay, round caps, `stroke-dashoffset` 100% → 0 with ease-in-out. A small leading dot rides the stroke head. |
| 11 | 6.00–6.60 | **Glass panel** rises from bottom (`y +320 → 0`, blur 16px → 0) over the map. Contains: three stats in a row — **Time** `03:05`, **Minutes** `185`, **Distance** `1,930 km` — then a slider track with thumb, and a 112px round play button on the right. Stats stagger in 60 ms each, counting up from 0. |
| 12 | 6.60–7.60 | **Live state.** Play button pressed at 6.60 (scale 1 → 0.92 → 1, icon cross-fades play → pause). Slider thumb travels 0% → 62% of the track; the stats tick live with it (time counts down from 03:05, minutes count down, distance remaining counts down) and a plane/dot marker moves along the route at the same progress value. |
| 13 | 7.60–8.00 | Hold. Everything settled; only the moving marker eases to rest by 7.80. |

## Motion Behaviour
- **Blur-swap transition (used between every screen, 300 ms):** outgoing layer blur 0 → 20px, opacity 1 → 0, scale 1 → 1.04 over the first 180 ms; incoming layer starts at 120 ms with blur 20px → 0, opacity 0 → 1, scale 0.96 → 1 over 180 ms. Overlap is intentional but outgoing must be below 30% opacity before incoming text exceeds 30%, so text never visibly doubles.
- **Default ease**: `cubic-bezier(0.22, 1, 0.36, 1)` (fast start, long soft settle) for entrances; `cubic-bezier(0.65, 0, 0.35, 1)` for line draws and the flip.
- **Spring** (computed analytically from t, not simulated per frame): stiffness 220, damping 26, mass 1 → ~4% overshoot. Use for bracket contraction, card fan, pin drops, play-button press. No other bounce.
- **Black card slide**: same spring, but clamp overshoot to ≤ 12px so it doesn't bob.
- **Counters**: ease-out cubic on value, round to display precision each frame, tabular numerals.
- **Flip**: hold `backface-visibility: hidden`; swap content at exactly 90° so neither face is seen edge-on with content.
- **Map tilt**: rotation and blur finish together; scale finishes 80 ms later for a soft landing.

## Interaction
No visible cursor. The play press (6.60) and slider drag (6.60–7.60) are shown as UI-driven state: the thumb position `p(t)` is the single source of truth, and the stats, marker position on the route (`getPointAtLength(p · length)`), and slider fill are all derived from `p(t)` every frame. Slider thumb shows a pressed state (scale 1.15, brighter glow) while moving and releases with the spring at 7.60.

## Timing & Audio
No music or SFX — silent video. Timing is the absolute schedule above in seconds; frame = round(t × 60).

## Technical Requirements
- Single `index.html` + `main.js` + `styles.css`. SVG for brackets, dots, checkmark, route, pins, icons, and the map (simple stylised land shapes for India, Arabian Peninsula and surrounding coast — no external map tiles or network calls at render time).
- Expose `window.seek(t)` that sets every visual property purely from `t` (seconds). No CSS transitions/animations, no `requestAnimationFrame` loops in render mode, no timers, no `Math.random` (use a seeded value if any noise is needed), no state carried between frames.
- A `?preview` mode may loop `seek(performance.now()/1000 % 8)` for live viewing; render mode must not.
- Keep the scene graph flat: one layer per screen (icon, faceid, wallet, map, panel), toggled by opacity/visibility from `t`.
- Use `transform` and `filter` only; do not animate layout properties.

## Rendering Pipeline
1. Playwright Chromium (`executablePath: '/opt/pw-browsers/chromium'` if the pinned version differs), viewport 1080 × 1920.
2. For each output frame `f` in 0…479, render 4 subframes at `t = (f + k/4) / 60`, k = 0…3; call `seek(t)`, `await` two `requestAnimationFrame`s, screenshot PNG.
3. FFmpeg: read the 1920 subframes at 240 fps, `tmix=frames=4:weights='1 1 1 1'`, then `fps=60` (select every 4th) for motion blur → 480 frames.
4. Encode H.264, `-pix_fmt yuv420p -crf 16 -preset slow`, 60 fps, output `out/wallet-motion.mp4`. Also export a `-crf 28` 540×960 preview.

## Validation
Before the final render:
1. Render stills at 0.4, 1.0, 1.7, 2.2, 2.55, 3.3, 3.9, 4.35, 4.5, 5.0, 5.5, 6.2, 6.6, 7.1, 7.9 s and inspect them.
2. Confirm every state hits its listed time (± 1 frame).
3. Check no text overlaps during blur-swaps and counters don't shift width.
4. Check the flip never shows a mirrored or edge-on face with content.
5. Check pins sit exactly on the route endpoints and the marker stays on the curve.
6. Check nothing clips at the canvas edges during the card fan, card slide-up or map tilt.
7. Check the glass panel actually blurs the map behind it in headless Chromium (if `backdrop-filter` fails, fall back to a pre-blurred copy of the map clipped to the panel).
8. Render the same timestamp twice and diff the PNGs — must be identical.
9. Fix issues, then run the full render.

## Constraints
- Do not add colours, cursor, music, extra screens or decorative particles beyond what is listed.
- No overshoot beyond the specified spring; no bouncing text.
- Avoid `will-change` on scaled text (keeps it crisp); avoid blur on text at rest.
- Not a loop — first and last frames do not need to match.
- Keep the stylised map clean: no labels besides the two pin labels.

## Deliverables
- `index.html`, `styles.css`, `main.js` (with `seek(t)`), `render.js` (Playwright frame dump), `render.sh` (FFmpeg pipeline).
- `out/wallet-motion.mp4` (1080×1920, 60 fps, 8.0 s) and `out/wallet-motion-preview.mp4`.
- `out/stills/` containing the validation frames.
