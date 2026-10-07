# Master prompt — "Cutting Edge School · UI Morph" (20s promo)

Copy everything below the line into Claude Code (with the HyperFrames skills installed: `npx skills add heygen-com/hyperframes`). Attach the official logo file with it.

---

## 1. What to make

Build a **20-second, 1920×1080, 60fps promo video** for **The Cutting Edge School** (https://cuttingedge.school), a company that trains leadership teams and organisations to adopt AI across operations, marketing and sales. Use **HyperFrames** (HTML + GSAP, rendered by the HyperFrames CLI).

**Style reference:** the viral "Claude Opus 5.5 UI-motion" clip by Miles / Refine Studio (https://x.com/uxmiles/status/2104962333936353601, reposted at https://x.com/vibecastingapp/status/2105348357644288195). If you can't open it, the style is:

- **One physical object morphs continuously through interface states** (button → loader → check → input → slider → toggle → tabs → notification → button). It **never cuts** to a different object.
- A big macOS-style **cursor** really operates every state: clicks, a drag, typing.
- A near-black canvas with a faint **dot grid**, oversized tactile UI, heavy grotesk headlines, and **one accent colour**.
- Tuned springs with only a tiny overshoot, gentle camera reframing, and no dead frames.

## 2. Non-negotiable client feedback (already given — do not regress)

1. **Official logo only.** Use the attached Cutting Edge School logo; never retype or redraw it as text. The source is black-on-white, so **remove the background**: make it white on transparent (alpha = inverted luminance) and crop it tight. No box, plate or black/white rectangle may ever show behind it. Use the high-res file directly; do not trace or upscale a small one.
2. **Not too fast.** A 10s cut and a 15s cut both felt rushed. The film is **20s**, every state holds ≥0.8s after its interaction, and large morphs take 0.5–0.65s, never under 0.4s.
3. **Sound effects at low volume.** Short UI SFX only (clicks, soft whooshes, pops, typing, one notification chime, one bass hit on the logo), mixed at **0.12–0.32 volume**, peaking around **−9 dBFS**. No music bed, no voiceover.
4. **Shape morphing is the transition.** Every change of state is a geometry morph of the same object, never a cut or a crossfade between scenes.
5. **Smooth, professional cuts.** No hard pops: content inside the object fades/blurs out *before* the morph and in *after* it, and headlines blur in and out. Render at **60fps**.
6. **No timecode or HUD clutter.** No running timestamp, frame counter or progress readout anywhere.
7. **Black theme throughout, including the end page.** The end card is black (dot grid + soft blue glow), with the white logo and a blue CTA. It is not a blue or white end card.
8. **No invented claims.** Stats come only from the website: **53+ countries, 4.7★ average satisfaction, 25+ enterprise AI programs**. UI copy (notification text, typed prompt) is illustrative and must not read as a factual claim.

## 3. Design system

| Token | Value |
|---|---|
| Background | `#0B0C0F` + dot grid (white 12% dots, 2.2px, 64px spacing) + one soft blue radial glow (`rgba(37,99,235,0.2)`) drifting slowly + edge vignette |
| Accent (brand blue) | `#2563EB`; highlight text `#4D8BFF` |
| Surfaces | card/input `#17181D`, track `#2B2D33`, notification `#1E1F25`, hairline `rgba(255,255,255,0.12)` |
| Text | ink `#F3F4F6`, muted `#8B8F9A`, inactive label `#5D616B` |
| Headlines | **Inter Display Bold**, 130px, tracking −0.045em, centred, top ≈250px; the last word of each line in `#4D8BFF` |
| UI text | Inter SemiBold/Medium (button 50px, input 46px, tabs 38px, slider labels 32px) |
| Labels | JetBrains Mono 500, uppercase, +0.08em (notification header, stats line, URL) |
| Cursor | macOS arrow, black fill, 2.4px white outline, 58×80px, soft drop shadow |

Bundle all fonts, GSAP 3.14 and MorphSVGPlugin locally. No CDN or network at render time.

## 4. Storyboard (exact timing)

The object is a container at canvas centre (960, 640) plus a "knob" that lives with it. All times are in seconds.

| Time | Object state | Cursor / interaction | Headline (word-masked) |
|---|---|---|---|
| 0.3–1.2 | Blue dot pops in (scale 0→1, back.out) and morphs into a **pill button 520×150**, label "Get started" | enters 1.0, settles on button | "AI moves **fast.**" (0.5–1.95) |
| 1.8–3.5 | Click → button squashes (496×140, 80ms) → morphs into **loader circle 150** (dark surface, hairline) with a spinning blue arc → circle fills blue, pops 1.08×, **check mark draws** (3.08) | clicks 1.8, exits | "Keep **up.**" (2.1–3.55) |
| 3.6–6.3 | Check fades; circle stretches into a **prompt bar 1160×150** (dark); the knob grows in as a **blue send button (100)** inside the right end | clicks bar 4.5; types **"Upskill my leadership team on AI"** (≈31ms/char) with a blue caret; moves to send, clicks 6.05 | "Ask **anything.**" (3.85–6.2) |
| 6.3–8.9 | Text clears; bar collapses into a **slider track 1000×22** (`#2B2D33`); the send button becomes the **white slider knob (72)** at the left end; labels **Beginner · Practitioner · Expert · AI Champion** | grabs 7.2; drags knob left→right 7.3–8.6 (power1.inOut) while a blue fill follows; each label lights as it's passed (last one blue) | "Level **up.**" (6.6–8.8) |
| 8.9–11.0 | Track snaps into a **toggle 330×184**; the knob becomes the **white toggle knob (160)** at the off position. **Box and knob use the same ease** so the knob never floats outside. | click 9.8 → knob springs to on (back.out 1.6), track turns blue | "Switch your team **on.**" (9.2–10.95) |
| 11.0–13.6 | Toggle widens into **tabs 1080×130** (dark); the knob becomes the **blue highlight pill (340×106)** under "Operations"; tabs **Operations · Marketing · Sales** | clicks Marketing 12.2, Sales 12.9; the pill slides with back.out 1.3 | "Every **team.**" (11.4–13.5) |
| 13.6–15.9 | Tabs become a **notification card 900×170** (`#1E1F25`, radius 44); the knob becomes the **app icon (96, black, radius 24)** holding the logo; header "CUTTING EDGE SCHOOL · NOW", body "Your team is AI-ready ✦"; below it, a mono stats line "53+ COUNTRIES · 4.7★ SATISFACTION · 25+ ENTERPRISE PROGRAMS" | (none) + notification chime | "Real **results.**" (14.0–15.85) |
| 15.9–20.0 | Notification morphs (and slides down) into the blue **CTA pill 760×150 at y=800**, label "Enquire for Trainings →"; the icon/knob fades early (by 16.1) so nothing rides on top of the CTA. The **official logo** (600px wide, white) resolves above it (scale 0.9→1, blur 14→0) at 16.45 with a bass hit; "cuttingedge.school" in mono below | arrives 17.2; clicks CTA 18.0 (pill squash, thin white pulse ring, not a filled disc); leaves 18.6 | logo replaces the headline |

## 5. Motion rules

- **One shape vocabulary.** Build every container and knob state as the *same* 8-segment rounded rectangle path (4 lines + 4 cubic corners, k = 0.5523·r). Morph with **GSAP MorphSVGPlugin** (`fromTo`, `shapeIndex: 0`) on two SVG paths (`#box`, `#knob`), so points interpolate one-to-one with no twisting. Tween `fill` alongside the shape, and add a hairline stroke only on dark surface states.
- **Morph easing.** `expo.inOut` for state changes; `back.out(1.3–1.6)` only for small settles (toggle knob, tab pill); squash presses last 70–80ms (`power2.in`) and spring back with `back.out(2.5–3)`.
- **Content choreography.** Outgoing content blurs and fades (≈0.2s) *before* the morph starts, and incoming content enters *after* the shape lands. Never let text sit on top of a moving shape.
- **Headlines.** Words in overflow-masked spans rise from 115% with blur 10px→0 (`expo.out`, 0.7s, stagger 0.06), then exit up with blur (`power3.in`, 0.3s, stagger 0.03). Hide each headline completely outside its window so two never overlap.
- **Cursor.** Arrives with `power3.out` (≈0.45–0.6s) and leaves with `power2.in` while fading. A click is a 0.86× press for 70ms, then `back.out(3)`. During drags it moves exactly with the knob.
- **Camera.** Gently scale the whole stage around (960, 600): 1.12 for the small states (button/loader/check), 1.0 for the wide states (input/slider/tabs), 1.14 for the toggle, 1.06 for the notification, 1.0 at the CTA, then a slow drift to 1.035 by the end. Reframes use `expo.inOut`.
- **Never** cut, flash white, or leave a frame with nothing moving except the final ≈1s hold on the end card.

## 6. Sound cue sheet (all low)

| t (s) | SFX | vol |
|---|---|---|
| 0.30 | pop (dot) | 0.14 |
| 0.55, 1.95, 3.60, 6.30, 8.90, 11.0, 13.6 | short whoosh (each morph) | 0.12–0.13 |
| 1.80, 6.05, 9.80, 12.2, 12.9, 18.0 | click (button, send, toggle, tabs, CTA) | 0.26–0.32 |
| 3.05 | pop (check) | 0.20 |
| 4.50, 7.20 | soft click (focus, grab) | 0.22–0.24 |
| 4.60 | typing burst (≈1.0s) | 0.20 |
| 7.83, 8.07, 8.60 | key tick (slider labels) | 0.20–0.22 |
| 14.1 | notification chime (≈1.3s) | 0.14 |
| 15.9 | whoosh (to CTA) | 0.17 |
| 16.45 | bass impact (logo) | 0.28 |
| 18.1 | sparkle | 0.12 |

Use HyperFrames' bundled SFX library (Pixabay licence, free commercial use) or equivalent licence-clean files. Every `<audio>` needs an `id`.

## 7. Build & QA (do all of this before delivering)

1. Run `npx hyperframes init <dir> --non-interactive --example=blank`. Use a single `index.html`, one paused GSAP timeline registered on `window.__timelines["main"]`, root `data-duration="20" data-fps="60"`, and a deterministic build (no `Math.random`, no clocks, no network).
2. `npx hyperframes check .` must report **0 errors**. Fix layout/overlap/contrast findings, or mark intentional bleed with `data-layout-allow-overflow`.
3. Take snapshots at 0.75, 1.6, 2.6, 3.3, 5.5, 8.0, 10.3, 12.6, 14.8, 17.0, 18.2 and 19.9s and inspect them. Also check mid-morph frames: the knob stays inside its container, no text clips or overflows its card, no two headlines are visible at once, and the logo never shows a background box.
4. Render with `npx hyperframes render . -q high --fps 60 -o renders/cutting-edge-ui-morph-20s.mp4`. Verify duration is **20.000s**, 60fps, 1920×1080 H.264 + AAC, and audio peak ≤ −8 dBFS.
5. Deliver the MP4, a contact sheet of frames pulled from the **rendered file**, and the project folder (`index.html`, `assets/brand/logo.png`, `assets/sfx/`, `assets/vendor/`, `fonts/`).
