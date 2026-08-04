/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.10.57).
   ────────────────────────────────────────────────────────────────────────
   v3.10.57: Z-ORDER FIX v2 — group by size, sort by y within
   each group, append bigs first then smalls. v3.10.56 sorted
   ALL tiles together by top y, which put some smalls behind
   the big whenever the small's top y was higher than the
   big's top y — and a small whose body sat on the big (top
   above the big's top, body inside the big's vertical range)
   would pop behind when the big fully appeared. Buddie:
   "when there are two smalls on a big image and then the big
   image fully appear one of the small pops from behind of the
   image." Now: sort each group by top y (higher first = behind,
   lower last = on top), then bigs first then smalls. Smalls
   always sit on top of bigs; within smalls, higher y is behind
   (z-switching fix preserved within the group).

   v3.10.56: Z-ORDER FIX — tiles now appended to the DOM in
   y-sorted order so the SVG render order matches the visual
   stacking. The previous code did `bigs.concat(smalls).forEach`
   for the clone-creation loop, which meant all big clones got
   appended first, then all small clones — so every small was
   always on top of every big regardless of their actual y
   position. During the wrap transition this caused a z-switching
   bug: a small that entered from the left (behind a big) would
   suddenly pop to the front as it scrolled into view, because
   the small's clone was always rendered after the big's clone.
   Fix: pre-compute y for every tile, sort by y (higher first =
   behind, lower last = on top; same y → bigs after smalls), then
   iterate the sorted list when creating/append the clones.
   Buddie: "if they spawn below they stay below and if they
   spawn on top they stay on top don't be swithching like that."

   v3.10.55: Mobile big lowered 30px. v3.10.52 set BIG_Y=0 on
   mobile (big anchored flush at the top of the SVG), but Buddie
   said "now on mobile are a touch high" — the top-anchored big
   sat right against the 72px sticky nav with no breathing room.
   Mobile override now BIG_Y=30: big spans y=30 to y=730, center
   y=380, with 30px of headroom at the top (visible above the
   text overlay) and 170px below for the hero text. PC untouched
   (still lifted 50px above geometric center per v3.10.54).

   v3.10.54: BIG_Y lifted 50px above geometric center. v3.10.52
   centered the big at y=450 (viewBox center) but Buddie said
   "i think the big ones are a little low still" — the hero text
   sits at the top of the hero and the big's optical center at
   y=450 made the composition feel bottom-heavy. New formula:
     BIG_Y = 400 - 250 * SCALE
     SCALE=1.0 → BIG_Y=150, big 500px, lifted (150-650, mid 400)
     SCALE=1.4 → BIG_Y= 50, big 700px, lifted ( 50-750, mid 400)
   At SCALE=1.4 the top 10-12px of the big now sit behind the
   72px sticky nav (which has backdrop-filter blur, so the big
   shows through softly). Mobile BIG_Y=0 override still wins.

   v3.10.53: PC SMALLS centering — the smalls' Y range was still
   off-center on PC after v3.10.52. Big was centered (y=100-800,
   midpoint 450) but small tops [140, 560] at SCALE=1.4 gave small
   centers in [280, 700] with midpoint 490 — 40px below the
   viewBox center. Fix: re-derive the formula so small CENTERS
   are centered on the viewBox at any SCALE:
     SMALL_Y_MIN = 450 - 250 * SCALE
     SMALL_Y_MAX = 450 +  50 * SCALE
     SCALE=1.0 → tops [200, 500], centers [300, 600], mid 450 ✓
     SCALE=1.4 → tops [100, 520], centers [240, 660], mid 450 ✓
   Mobile override ([0, 420] tops → centers [140, 560] → mid 350)
   still wins on mobile — smalls orbit the big there, not the
   viewBox. Buddie: "in pc i don't feel its centered on the
   section the big and small images."

   v3.10.52: POSITION FIXES — two related centering issues from
   the v3.10.51 SCALE bump.

   1) PC big was too low at SCALE=1.4. The old formula
      BIG_Y = 200 * SCALE = 280 put the 700-tall big at y=280
      to y=980, clipping 80px off the bottom of the viewBox.
      Fix: BIG_Y = 450 - 250 * SCALE, which centers the big
      vertically in the 900-tall viewBox at any SCALE
      (SCALE=1.0 → BIG_Y=200, SCALE=1.4 → BIG_Y=100). Mobile
      still overrides to BIG_Y=0 (big anchors at the top so the
      text sits in the empty space below).

   2) Mobile smalls were not centered on the big. At SCALE=1.4
      the big is y=0-700 (center y=350) but the default small
      tops [140, 560] gave small CENTERS in [280, 700] — clustered
      in the lower half. Fix: mobile override drops SMALL_Y_MIN/MAX
      to [0, 420] so small centers land in [140, 560], symmetric
      around 350. PC keeps the default (Buddie: "i think the small
      ones are good on pc").

   v3.10.51: SCALE bumped to 1.4 on BOTH mobile and PC. Buddie:
   "i don't want to rescalate but i want the images bigger so make
   them bigger" — was mobile=1.2, PC=1.0; both now 1.4 (the "new
   1.0"). Since they end up equal, the ternary is gone — SCALE is
   just 1.4 unconditionally. All layout constants (BIG_WIDTH,
   BIG_HEIGHT, SMALL_WIDTH, SMALL_HEIGHT, BIG_SPACING,
   INITIAL_OFFSET, WRAP_MARGIN, BIG_Y, SMALL_GAP, SMALL_Y_MIN/MAX,
   SMALL_X_OFFSET_RANGE) multiply by SCALE, so the whole carousel
   scales proportionally. Net effect: bigs 500→700px, smalls
   200→280px, spacing 900→1260px, etc. Mobile/desktop split on
   SCALE removed; other mobile-vs-PC splits (velocity scaling,
   touch-action, wheel-sensitivity) are unchanged.

   v3.10.50: PRESS-DECAY — when the user presses (or taps) during
   release momentum, the carousel no longer snaps to the press
   position. Instead the RAF keeps running with a slower friction
   (PRESS_DECAY_FRICTION = 0.97 vs the normal FRICTION = 0.95),
   so the carousel coasts to a "future position" — the place it
   would have reached if the user hadn't pressed. The drag, if it
   happens, picks up from wherever the carousel is at that moment
   (re-anchored in onPointerMove). If the user just taps (no drag),
   the coast continues until the momentum naturally decays and
   the carousel stops at the future position. This gives a much
   more pronounced "simulated positions" feel — the carousel
   visibly settles over ~2s instead of stopping immediately.

   v3.10.49: SCRATCHED the GSAP Observer for drag/touch — replaced
   with native Pointer Events (pointerdown / pointermove / pointerup /
   pointercancel) plus a requestAnimationFrame loop for the release
   momentum. The Observer's internal state (self.deltaX, self.startX,
   even onPress itself) does not reset cleanly for rapid
   click-release-click sequences — it treats the second click as a
   continuation of the first gesture, leaking residual travel into
   the new drag. After 4 attempts (v3.10.45, 46, 47, 48) to work
   around this within the Observer, the cleanest fix is to bypass
   the Observer entirely for the gesture layer and use native events,
   which fire reliably for every click and don't carry cross-gesture
   state.

   What stays the same from v3.10.48:
   • GSAP ticker still drives the per-frame tick() — it's the right
     tool for the per-tile wrap math, the idle auto-scroll, and the
     lerp toward phase.
   • Phase-based positioning, per-tile parallax (smalls 2×), infinite
     wrap, idle auto-scroll, wheel handler, band detection, the lerp
     smoothing for drag — all unchanged.
   • All v3.10.32-38 constants (DRAG_SENSITIVITY, FRICTION, AUTO_SCROLL
     VELOCITY, WHEEL_IDLE_DELAY, LERP_FACTOR, WHEEL_SENSITIVITY,
     PC_VELOCITY_SCALE) are unchanged.

   What's new in v3.10.49:
   • Native Pointer Events on the hero for drag detection.
     setPointerCapture on pointerdown so move events keep flowing
     even if the pointer leaves the element.
   • Press position captured in the hero's LOCAL coordinate system
     (e.clientX - hero.getBoundingClientRect().left) so it works
     regardless of which child element the pointer is over. This
     was the coordinate-mismatch bug in v3.10.46.
   • requestAnimationFrame loop for release momentum, with FRICTION
     decay. The loop updates both phase and currentPhase together
     so the lerp doesn't fight it. A new pointerdown during momentum
     cancels the RAF — this is what fixes the "snap back" for good,
     because the cancellation is explicit, not dependent on the
     Observer's internal state.
   • Removed: GSAP Observer block, FLING_VELOCITY constant,
     flingOccurred flag, the GSAP-mode momentum in tick() (now
     handled by the RAF loop), the 3-mode tick() (now 2-mode:
     auto-scroll vs. lerp, with momentum handled outside).
   ════════════════════════════════════════════════════════════════════════ */
  /*
   v3.9.3 → v3.10 → v3.10.1 → v3.10.2 → v3.10.3 → v3.10.9 → v3.10.10
   → v3.10.11 → v3.10.12 (Buddie: "add the carousel to the mobile
   version"):

   v3.9.3 ran the carousel on desktop only. v3.10 brought it to
   mobile with a 2/3 split layout + a touch gate. v3.10.1 scrapped
   the split and removed the touch gate. v3.10.2 bumped SCALE
   0.4 → 0.65 and centered the bigs vertically. v3.10.3 anchored
   the big at the top of the SVG on mobile (BIG_Y=0). v3.10.9
   dropped the mobile-specific SCALE / INITIAL_OFFSET / WRAP_MARGIN
   overrides (mobile = desktop layout) and fixed the mobile drag
   (preventDefault:true on the Observer, dropped the band gate
   on fling gestures). v3.10.10 fixed touch drag jiggling
   (touch-action: pan-y on .hero) and narrowed the smalls Y range
   to a 300-unit band. v3.10.11 bumped DRAG_SENSITIVITY 60 → 500
   so a full-width mobile swipe moves the carousel a useful
   distance (~7.5% of the loop).

   v3.10.12: on mobile, INITIAL_OFFSET=550 instead of the
   desktop's 200. The 500-unit-wide big now centers at x=800 in
   the viewBox — the same horizontal axis as the hero text and
   the CTAs (which are already centered on the hero). Previously
   the big sat at x=200 (desktop's left-margin composition),
   offset to the left of the text and buttons, so the three
   weren't on the same vertical axis. (Buddie: "i think it would
   be better if the images where centered on the section itself
   not just to the text, like having in mind the buttons.")
   Desktop keeps INITIAL_OFFSET=200 (the v3.9.2 left-margin
   composition stays — different visual on desktop is fine,
   mobile is what Buddie was looking at when asking for this).

   No band rule gates the drag itself. The only inCarouselBand
   checks that survived are:
     • onWheel handler (mouse wheel only, never fires on touch) —
       returns early if the mouse isn't in the outer 20% of the
       hero. This is the desktop wheel-zone split (outer 20%
       scrubs, middle 60% scrolls the page).
     • Cursor hint (desktop only) — changes cursor to ew-resize
       when the mouse is in the band.
   The drag (pointerdown / pointermove / pointerup) fires
   regardless of where on the hero the touch lands.

   What stayed the same from v3.10.3:
   • Mobile layout is the same as desktop — carousel fills the
     hero, text content is overlaid on top. No flex column.
   • SCALE is 1.0 on every viewport; the hero shrinks to its
     content on mobile (CSS), so the carousel's slice scale
     naturally adapts to the shorter hero height.
   • setupClipPaths() rebuilds the clip-paths at runtime with
     the current tile sizes (proportional rx).
   • The 'if (window.innerWidth < MOBILE_MAX_WIDTH) return;'
     skip in init() is gone — the carousel runs everywhere.

   What stayed the same (still true from v3.8):
   • Phase-based scrub (global phase, lerped to currentPhase).
   • Band-based wheel zones (outer 20% scrubs, middle 60% scrolls
     the page). On mobile the wheel rarely fires, so this is
     effectively a desktop-only behavior.
   • Data-driven layout: `<image data-size="big|small">` in HTML.
   • Seamless wrap: each tile gets two clones (±X_RANGE).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Mobile breakpoint: below this width the layout switches to a
  // mobile-optimized version (BIG_Y=0 to anchor the big at the
  // top of the SVG). v3.10.9: SCALE and the other layout
  // constants are no longer mobile-specific — they use the
  // desktop values, so the mobile carousel matches the "no
  // refresh" look (desktop layout applied to a mobile viewport).
  var MOBILE_MAX_WIDTH = 768;

  // SCALE: 1.4 on BOTH mobile and PC. v3.10.51: Buddie asked for
  // the images bigger across the board — "the new 1.0". Mobile
  // was 1.2, PC was 1.0; both bumped to 1.4. Since they end up
  // the same, the mobile/desktop split is gone for SCALE (the
  // other mobile-vs-PC splits — isMobile velocity scaling,
  // touch-action, wheel-sensitivity — are all unchanged and
  // still in their respective branches). All layout constants
  // below (BIG_WIDTH, BIG_HEIGHT, SMALL_WIDTH, SMALL_HEIGHT,
  // BIG_SPACING, INITIAL_OFFSET, WRAP_MARGIN, BIG_Y, SMALL_GAP)
  // multiply by SCALE, so the whole carousel scales
  // proportionally — tiles AND spacing grow together, the
  // layout stays the same shape just at 1.4×.
  // Buddie: "i don't want to rescalate but i want the images
  // bigger so make them bigger".
  var isMobile = window.innerWidth < MOBILE_MAX_WIDTH;
  var SCALE = 1.4;

  // Per-tile phase multipliers. 1.0 = full speed, 2.0 = 2× parallax.
  // Smalls scroll 2× faster than bigs for the CodePen depth effect.
  var BIG_PHASE_FRAC = 1.0;
  var SMALL_PHASE_FRAC = 2.0;

  // Smoothing. The lerp factor for current → target each frame.
  // 0.18 = noticeable glide without feeling laggy. Higher = snappier.
  var LERP_FACTOR = 0.18;

  // Wheel sensitivity. deltaY values vary wildly (trackpad ~2-10,
  // mouse wheel ~100-300), so we multiply by a tuned constant.
  // v3.10.39: dropped 1.0 → 0.3. The old 1.0 made each mouse-wheel
  // click add ~100-300 phase units to phase, then the lerp had
  // to chase currentPhase toward that for 10+ frames — the
  // carousel visibly lagged behind the wheel, felt "harsh" and
  // "steppy". At 0.3, a mouse-wheel click adds ~30-90 phase
  // units (the lerp still chases, but the catch-up is much
  // shorter — feels like a smooth scroll, not a jump-and-glide).
  // A trackpad tick (deltaY ~5) now advances phase ~1.5 units,
  // which the lerp covers in ~2 frames — imperceptible lag.
  var WHEEL_SENSITIVITY = 0.3;

  // Drag/touch sensitivity. GSAP Observer's self.deltaX is the total
  // horizontal drag distance in pixels since the gesture started.
  // phase = dragStartPhase + deltaX * DRAG_SENSITIVITY / 1000
  // → so DRAG_SENSITIVITY is "phase units per 1000px of drag".
  //
  // v3.10.11: bumped 60 → 500. The old value was tuned for desktop
  // mouse drags (10–50px), but on mobile a single finger swipe is
  // routinely 100–375px. At 60/1000, a full-width 375px swipe only
  // moved the phase by ~22 units (0.9% of the 2500-unit loop) — so
  // the carousel barely budged and Buddie said "its moving but so
  // slow." At 500, the same 375px swipe moves the phase by ~187
  // units (7.5% of the loop) — enough to bring the next big into
  // view in one swipe. (Desktop drag is still 10–50px so it now
  // moves 5–25 units per gesture — feels responsive, not jumpy.)
  var DRAG_SENSITIVITY = 500;

  // ── Layout constants (scaled by SCALE for mobile) ────────────
  var BIG_WIDTH = 500 * SCALE;
  var BIG_HEIGHT = 500 * SCALE;
  var SMALL_WIDTH = 200 * SCALE;
  var SMALL_HEIGHT = 200 * SCALE;

  // Big spacing. The original v3.5+ layout had gaps between bigs
  // (BIG_SPACING = 900) so smalls could fit in the gaps. v3.9 tried
  // BIG_SPACING = BIG_WIDTH = 500 (bigs abutting) to close a perceived
  // "phantom" slot, but Buddie's QA clarified that's not what they
  // wanted — they want the GAPS back. The real "phantom" was a 100px
  // empty band AFTER the last tile, before the loop wrapped. The fix
  // for that is in buildLayout(): X_RANGE is computed from the actual
  // rightmost tile's right edge, not hard-coded.
  var BIG_SPACING = 900 * SCALE;
  var X_RANGE = BIG_SPACING * 4; // upper bound; buildLayout() refines it

  // Left margin: how far right the first big is from x=0 on load.
  // Buddie's QA on v3.9.2: "add a margin to the first photo" /
  // "the first photo more centered when first loaded or at least
  // not at the start of the page". 200 = a comfortable "breath"
  // without making big 0 feel off-center. On mobile this default
  // is overridden in buildLayout() — see below.
  var INITIAL_OFFSET = 200 * SCALE;

  // Wrap margin: trailing space AFTER the last big, before the
  // loop wraps. So big 0's right clone doesn't start right where
  // big 2 ends (Buddie's QA: "the last and the first photos always
  // are together"). 200 = a small visible gap at the wrap point.
  var WRAP_MARGIN = 200 * SCALE;

  // Y positions
  // v3.10.52: BIG_Y centers the big vertically in the 900-unit
  // viewBox at any SCALE. v3.10.54 lifts it 50px above geometric
  // center because the hero text (eyebrow/headline/lede) sits at
  // the top of the hero and the big's optical center sitting at
  // y=450 made the whole composition feel bottom-heavy — Buddie:
  // "i think the big ones are a little low still."
  // Formula: (viewBoxH - BIG_HEIGHT)/2 - 50
  //        = 450 - 250*SCALE - 50
  //        = 400 - 250*SCALE
  //   SCALE=1.0  → BIG_Y=150, big 500px, lifted (150-650, mid 400)
  //   SCALE=1.4  → BIG_Y= 50, big 700px, lifted ( 50-750, mid 400)
  // The SCALE=1.4 big now starts at viewBox y=50, which on a
  // 1920x1080 viewport (1.2× SVG scale) maps to hero y=60 — 12px
  // into the 72px sticky-nav area. The sticky nav has a
  // backdrop-filter blur, so the top sliver of the big shows
  // through softly rather than being hard-clipped. Mobile
  // BIG_Y=0 override still wins on mobile.
  var BIG_Y = 400 - 250 * SCALE;
  // (Each small spawns at a random y in [SMALL_Y_MIN, SMALL_Y_MAX]
  // defined further down — the old single-anchor SMALL_Y is gone.)

  // Gap between smalls and bigs
  var SMALL_GAP = 10 * SCALE;

  // Y range for smalls. Each small spawns at a random y in this range
  // so they look like a scattered set, not a row. v3.10.10 narrowed
  // the band to [100, 400] (tops) at SCALE=1.0, but those values put
  // the small CENTERS in [240, 540] with midpoint y=390 — 60px above
  // the viewBox center (y=450). v3.10.52 re-derives the formula so
  // the small centers are centered on the viewBox at any SCALE:
  //   range width (tops)         = 300 * SCALE
  //   small half-height          = 100 * SCALE
  //   tops midpoint              = 450 (viewBox center)
  //   → SMALL_Y_MIN = 450 - 150*SCALE - 100*SCALE = 450 - 250*SCALE
  //   → SMALL_Y_MAX = 450 + 150*SCALE - 100*SCALE = 450 +  50*SCALE
  //   SCALE=1.0 → tops [200, 500], centers [300, 600], mid 450 ✓
  //   SCALE=1.4 → tops [100, 520], centers [240, 660], mid 450 ✓
  // Buddie: "in pc i don't feel its centered on the section the big
  // and small images." Mobile overrides these to [0, 420] so the
  // smalls center on the big (y=350) instead of the viewBox (y=450)
  // — on mobile the big anchors at the top (BIG_Y=0) and the smalls
  // orbit it, not the section.
  var SMALL_Y_MIN = 450 - 250 * SCALE;
  var SMALL_Y_MAX = 450 +  50 * SCALE;

  // Per-tile horizontal random offset for smalls (slot + offset
  // distribution). "A little random" per Buddie's QA. Scaled down
  // on mobile so the ±30px desktop random becomes ±12px on mobile
  // (proportional to the smaller tile size).
  var SMALL_X_OFFSET_RANGE = 60 * SCALE;

  // Carousel band: outer X% on each side of the hero.
  var BAND_FRACTION = 0.20;
  var BAND_MIN_PX = 100;

  // Set true if your mouse's wheel is inverted (deltaY polarity
  // is the opposite of what we expect). E.g. some Linux distros
  // with "natural scrolling" enabled.
  var WHEEL_INVERTED = false;

  // === Momentum (mobile-like inertial scroll) ===
  // v3.10.33: after a drag or fling, the carousel continues moving
  // in the drag direction and gradually decelerates, like native
  // Android/iOS page scrolling. "If i scroll fast they scroll
  // smoothly and then stop, like when on android you scroll down
  // a page — the same effect but sideway."
  //
  // How it works:
  //   - During onDrag, we sample (deltaX, time) → compute instant
  //     velocity (phase units / ms), keep the last N samples.
  //   - On onDragEnd, average the samples → convert to phase/frame
  //     → that's the momentum. If a fling (onLeft/onRight) already
  //     fired, use that velocity instead.
  //   - In tick(), if velocity > VELOCITY_THRESHOLD, advance
  //     phase + currentPhase by velocity*deltaRatio, then decay
  //     velocity by FRICTION^deltaRatio. deltaRatio() makes the
  //     physics framerate-independent (works at 30/60/120fps).
  //   - When velocity drops below threshold, momentum stops and
  //     the normal lerp takes over.
  // v3.10.36: PC gets a much smaller momentum. v3.10.35's
  // FLING_VELOCITY=30 was tuned for mobile (375px swipes), but
  // on PC a 10-50px mouse drag produces the same velocity
  // samples — the carousel "goes flying" off a tiny drag and
  // "the scroll is harsh, not smooth". FLING_VELOCITY stays at
  // 30 for mobile, but on PC we scale the final velocity by
  // PC_VELOCITY_SCALE = 0.25 — quarter the push, quarter the
  // distance, same smooth deceleration. Mobile is unchanged.
  var FRICTION = 0.95;            // velocity decay per frame at 60fps
  var PRESS_DECAY_FRICTION = 0.97; // v3.10.50: slower decay during press-decay,
                                    // so the coast to a "future position" is
                                    // more pronounced (≈2s coast at typical
                                    // release velocities vs ≈1s with FRICTION).
                                    // Closer to 1 = slower decay = more positions
                                    // simulated before the carousel stops.
  var VELOCITY_THRESHOLD = 0.05;  // below this, stop momentum
  var VELOCITY_SAMPLE_COUNT = 4;   // how many recent samples to average
  var PC_VELOCITY_SCALE = 0.25;   // velocity multiplier on PC (quarter the push)

  // === Idle auto-scroll (v3.10.37) ===
  // When the user isn't touching the carousel and there's no
  // momentum, the carousel slowly drifts to the right on its
  // own — like a museum display or a portfolio showcase. The
  // user can grab it at any time (which pauses auto-scroll);
  // after they release and the momentum settles, auto-scroll
  // resumes from wherever the carousel is. Wheel scrolling also
  // pauses auto-scroll for WHEEL_IDLE_DELAY ms so the two
  // motions don't fight.
  //
  // The user said: "i want an animation that makes them move, so
  // they scroll when the user is not, but if the user scrolls
  // the animation stops and does what the user wants. after
  // the user stops the animation will resume where it is and
  // start scrolling again. i imagine this animation slow".
  //
  // AUTO_SCROLL_VELOCITY = 0.6 phase/frame at 60fps = 36
  // phase/second. One big-tile slot is BIG_SPACING = 900
  // phase, so a full slot takes ~25 seconds to traverse.
  // v3.10.38 (Buddie: "put it to 0.6 the auto scroll") —
  // doubled from the original 0.3 — the original was
  // almost imperceptible, the new pace is a clearly visible
  // drift without feeling like a screensaver.
  var AUTO_SCROLL_VELOCITY = 0.6;  // phase/frame, slow drift when idle
  var WHEEL_IDLE_DELAY = 2000;     // ms after last wheel before auto-scroll resumes (v3.10.38: 1500→2000)

  // === Build the layout from the SVG's <image> elements ===
  // Each entry has:
  //   tile     — the <image> element to position
  //   size     — 'big' or 'small' (used for sizing)
  //   baseX    — this tile's position in the loop (without phase)
  //   offset   — clone offset: -X_RANGE (left clone), 0 (original),
  //              or +X_RANGE (right clone). Used to wrap displayX.
  //   stepFrac — per-tile phase multiplier (parallax).
  function buildLayout(stage) {
    var allTiles = Array.from(stage.querySelectorAll('.hc-row image'));
    if (!allTiles.length) return [];

    var bigs = allTiles.filter(function (t) {
      return t.getAttribute('data-size') === 'big';
    });
    var smalls = allTiles.filter(function (t) {
      return t.getAttribute('data-size') === 'small';
    });
    var bigCount = bigs.length;
    if (bigCount === 0) return [];

    // On desktop, the top-level INITIAL_OFFSET (= 200 * SCALE = 200)
    // and WRAP_MARGIN (= 200 * SCALE = 200) are the user-tuned
    // "left margin" and trailing-gap values from v3.9.3 and they
    // stay as-is. WRAP_MARGIN still inherits the desktop value
    // on mobile (v3.10.9).
    //
    // v3.10.12: mobile now overrides INITIAL_OFFSET too, to 550,
    // so the 500-unit-wide big centers at x=800 in the viewBox
    // (the visible-region center on a 375-wide phone, which is
    // also where the hero text and CTAs are centered). The
    // desktop keeps INITIAL_OFFSET=200 (left-margin composition
    // from v3.9.2 — Buddie's "add a margin to the first photo"
    // QA). Buddie: "i think it would be better if the images
    // where centered on the section itself not just to the text,
    // like having in mind the buttons."
    if (isMobile) {
      // INITIAL_OFFSET: 550 = 800 (viewBox center) - 250 (half of
      // BIG_WIDTH). Centers the big horizontally on the hero, in
      // line with the text and the CTAs.
      INITIAL_OFFSET = 550;
      // v3.10.55: BIG_Y = 30 on mobile. Was 0 (big anchored flush
      // at the top of the SVG), but Buddie: "now on mobile are a
      // touch high" — the top-anchored big sat right against the
      // 72px sticky nav with no breathing room. 30px of headroom
      // (matching the PC lift's 50px-of-headroom feel, just a
      // touch less since the text overlay sits in the empty space
      // below the big on mobile). Big now spans y=30 to y=730,
      // center y=380, leaving 30px above and 170px below for the
      // hero text.
      BIG_Y = 30;
      // v3.10.52: re-center the smalls' Y range around the big.
      // Big on mobile: y=30 to 730 (BIG_Y=30, BIG_HEIGHT=700 at
      // SCALE=1.4), center at y=380. The default SMALL_Y_MIN/MAX
      // (= [140, 560] at SCALE=1.4) gives small CENTERS in
      // [280, 700], which is not centered on 380. Override to
      // tops [0, 420] so centers land in [140, 560], midpoint
      // 350 — sits 30px above the new big center (380), which
      // is fine because the smalls cluster in the visual-weight
      // portion of the big (just below the text overlay).
      // Buddie: "the small ones don't spawn centered to the
      // big ones ... the max and min point is not centered."
      // PC keeps the default [140, 560] tops (Buddie: "i think
      // the small ones are good on pc").
      SMALL_Y_MIN = 0;
      SMALL_Y_MAX = 420;
    }

    // Compute X_RANGE = (bigs' span) + WRAP_MARGIN.
    // Two things make the loop look right:
    //  • The bigs start at INITIAL_OFFSET, not at x=0 (left margin).
    //  • The loop has WRAP_MARGIN of trailing space, so big 0's
    //    right clone doesn't start right where big 2 ends.
    //   For 3 bigs at BIG_SPACING=900, INITIAL_OFFSET=200,
    //   WRAP_MARGIN=200:
    //     big 0 at 200–700, big 1 at 1100–1600, big 2 at 2000–2500
    //     X_RANGE = 2*900 + 500 + 200 = 2500  (initial offset does
    //       NOT enter here — it just shifts the layout right)
    //     big 0's right clone starts at 200+2500=2700, with a
    //     200px gap after big 2's right edge (2500). ✓
    // Smalls are placed in the content area [INITIAL_OFFSET,
    // X_RANGE - WRAP_MARGIN - SMALL_WIDTH] with random x/y.
    var bigsSpan = (bigCount - 1) * BIG_SPACING + BIG_WIDTH;
    X_RANGE = bigsSpan + WRAP_MARGIN;

    // v3.10.57: Z-ORDER FIX v2 — group by size, sort by y within
    // each group, append bigs first then smalls. v3.10.56 sorted
    // ALL tiles together by top y, which put some smalls behind
    // the big whenever the small's top y was higher than the
    // big's top y. That made a small whose body sat on the big
    // (top above the big's top, body inside the big's vertical
    // range) get hidden when the big fully appeared — Buddie:
    // "when there are two smalls on a big image and then the big
    // image fully appear one of the small pops from behind of the
    // image." The intent: a small that is "on" a big should
    // always sit in front of that big.
    //
    // Fix: sort bigs by y among themselves, sort smalls by y among
    // themselves, then append bigs first (behind) and smalls last
    // (on top). Within each group, higher y = behind, lower y =
    // on top, so the z-switching fix from v3.10.56 is preserved
    // within each group (the cross-group rule is just "smalls on
    // top of bigs", which is what the visual stacking wants).
    var tileY = new Map();
    bigs.forEach(function (tile) { tileY.set(tile, BIG_Y); });
    smalls.forEach(function (tile) {
      var yOverride = tile.getAttribute('data-y');
      var y = yOverride !== null
        ? parseFloat(yOverride)
        : SMALL_Y_MIN + Math.random() * (SMALL_Y_MAX - SMALL_Y_MIN);
      tileY.set(tile, y);
    });

    // Sort each group by top y: higher y first (behind), lower y
    // last (on top). All bigs share BIG_Y so this is effectively
    // a no-op for them; smalls get the real y-spread sort.
    function byYDesc(a, b) {
      return tileY.get(b) - tileY.get(a);
    }
    var bigsSorted = bigs.slice().sort(byYDesc);
    var smallsSorted = smalls.slice().sort(byYDesc);
    // bigs appended first (behind), then smalls (on top).
    var allTilesForZ = bigsSorted.concat(smallsSorted);

    // Create left (-X_RANGE) and right (+X_RANGE) clones of every
    // original tile. The clones share the same href (cloneNode(true)
    // preserves attributes including href), so when one copy slides
    // off-screen, the replacement copy is the same photo — no visible
    // teleport. v3.10.56: iterates in y-sorted order so the DOM
    // append order matches the visual z-stacking (see comment above).
    var leftClone = new WeakMap();
    var rightClone = new WeakMap();
    allTilesForZ.forEach(function (tile) {
      var lc = tile.cloneNode(true);
      lc.setAttribute('data-clone', 'left');
      tile.parentNode.appendChild(lc);
      leftClone.set(tile, lc);

      var rc = tile.cloneNode(true);
      rc.setAttribute('data-clone', 'right');
      tile.parentNode.appendChild(rc);
      rightClone.set(tile, rc);
    });

    // Helper: push three entries for one tile (left clone, original,
    // right clone). All three share the same baseX and stepFrac, so
    // they move in lockstep with the global phase.
    var layout = [];
    function pushThree(tile, size, baseX, y, stepFrac) {
      var lc = leftClone.get(tile);
      var rc = rightClone.get(tile);
      layout.push({ tile: lc,  size: size, baseX: baseX, offset: -X_RANGE, y: y, stepFrac: stepFrac });
      layout.push({ tile: tile, size: size, baseX: baseX, offset: 0,         y: y, stepFrac: stepFrac });
      layout.push({ tile: rc,  size: size, baseX: baseX, offset: +X_RANGE, y: y, stepFrac: stepFrac });
    }

    // Bigs: start at INITIAL_OFFSET (left margin), then spaced by
    // BIG_SPACING. With 3 bigs at BIG_SPACING=900 and
    // INITIAL_OFFSET=200: big 0 at 200, big 1 at 1100, big 2 at 2000.
    bigs.forEach(function (tile, i) {
      var x = INITIAL_OFFSET + i * BIG_SPACING;
      pushThree(tile, 'big', x, tileY.get(tile), BIG_PHASE_FRAC);
    });

    // Smalls: each at a unique (x, y) in the CONTENT area (not in
    // the left/right padding). X is evenly distributed across the
    // content area with a small ±30px random offset (avoids landing
    // on a perfect grid line). Y was pre-computed in tileY above
    // (for the z-order sort); we just look it up here. No per-frame
    // jitter — positions are fixed at init.
    // data-y attribute still overrides the random y for fine-tuning.
    var smallsLeft = INITIAL_OFFSET;
    var smallsRight = X_RANGE - WRAP_MARGIN - SMALL_WIDTH;
    var xSlotWidth = (smallsRight - smallsLeft) / smalls.length;
    smalls.forEach(function (tile, i) {
      var xSlot = smallsLeft + (i + 0.5) * xSlotWidth;
      var xOffset = (Math.random() - 0.5) * SMALL_X_OFFSET_RANGE; // ±30 desktop, ±12 mobile
      var x = Math.max(smallsLeft, Math.min(smallsRight, xSlot + xOffset));

      pushThree(tile, 'small', x, tileY.get(tile), SMALL_PHASE_FRAC);
    });

    return layout;
  }

  function isInCarouselBand(hero, clientX, clientY) {
    var rect = hero.getBoundingClientRect();
    if (clientY < rect.top || clientY > rect.bottom) return false;
    var bandWidth = Math.max(BAND_MIN_PX, rect.width * BAND_FRACTION);
    var x = clientX - rect.left;
    return x < bandWidth || x > (rect.width - bandWidth);
  }

  function readWheelDelta(e) {
    if (e.deltaY) return e.deltaY;
    if (e.wheelDeltaY) return -e.wheelDeltaY;
    if (e.wheelDelta)  return -e.wheelDelta;
    if (e.detail)      return -e.detail;
    return 0;
  }

  // Recreate the clip-paths in <defs> with the current (possibly
  // scaled) BIG/SMALL sizes. The HTML has fixed 500/200 clip-paths
  // (assumed to match desktop); on mobile SCALE=0.4 so the rects
  // and rounded corners shrink proportionally.
  function setupClipPaths(stage) {
    var defs = stage.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      stage.insertBefore(defs, stage.firstChild);
    }
    defs.innerHTML = '';
    var bigRx = Math.max(2, Math.round(BIG_WIDTH * 0.044));   // 22/500 = 0.044
    var smallRx = Math.max(2, Math.round(SMALL_WIDTH * 0.08)); // 16/200 = 0.08
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var cp1 = document.createElementNS(SVG_NS, 'clipPath');
    cp1.id = 'hc-cp1';
    var r1 = document.createElementNS(SVG_NS, 'rect');
    r1.setAttribute('width', BIG_WIDTH);
    r1.setAttribute('height', BIG_HEIGHT);
    r1.setAttribute('rx', bigRx);
    cp1.appendChild(r1);
    defs.appendChild(cp1);
    var cp2 = document.createElementNS(SVG_NS, 'clipPath');
    cp2.id = 'hc-cp2';
    var r2 = document.createElementNS(SVG_NS, 'rect');
    r2.setAttribute('width', SMALL_WIDTH);
    r2.setAttribute('height', SMALL_HEIGHT);
    r2.setAttribute('rx', smallRx);
    cp2.appendChild(r2);
    defs.appendChild(cp2);
  }

  function init() {
    var hero = document.getElementById('top');
    var stage = document.getElementById('hero-carousel-svg');
    if (!hero || !stage) return;
    if (typeof gsap === 'undefined') return;

    // v3.10+: the carousel runs on mobile too. The previous
    // `if (window.innerWidth < MOBILE_MAX_WIDTH) return;` short-circuit
    // is gone — the CSS now shows the SVG in the top 2/3 of the hero
    // on mobile, and the tile layout is scaled by SCALE in buildLayout
    // so the visible region on a 375-wide phone shows 1.5–2 bigs.

    // Build the layout from the photos in the SVG
    var layout = buildLayout(stage);
    if (!layout.length) return;

    // Recreate clip-paths with the (scaled) tile sizes so the rounded
    // corners still match.
    setupClipPaths(stage);

    // Set initial sizing + position for each tile (phase = 0).
    gsap.set(stage.querySelectorAll('image'), {
      attr: { preserveAspectRatio: 'xMidYMid slice' }
    });
    layout.forEach(function (item) {
      if (item.size === 'big') {
        gsap.set(item.tile, {
          attr: { width: BIG_WIDTH, height: BIG_HEIGHT, 'clip-path': 'url(#hc-cp1)' },
          x: item.baseX,
          y: item.y
        });
      } else {
        gsap.set(item.tile, {
          attr: { width: SMALL_WIDTH, height: SMALL_HEIGHT, 'clip-path': 'url(#hc-cp2)', opacity: 0.9 },
          x: item.baseX,
          y: item.y
        });
      }
    });

    // Reduced motion: keep the visual composition, drop the interactivity.
    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // === Phase-based scrub state ===
    //   phase       — target value, updated by wheel/drag events
    //   currentPhase — smoothly-lerped value, drives the actual tile x
    //                  each frame
    // phase is allowed to grow unbounded (positive or negative). We
    // wrap displayX per-tile, not phase itself, which avoids the
    // "lerp the long way around" problem at wrap boundaries.
    var phase = 0;
    var currentPhase = 0;

    // === Drag state (v3.10.49) ===
    //   isDragging        — true between pointerdown and pointerup.
    //                       While true, the native pointermove handler
    //                       updates phase directly; the tick() does
    //                       the per-tile wrap math but skips auto-
    //                       scroll and lerp (they'd fight the drag).
    //   pressX            — pointer x at pointerdown, in the hero's
    //                       LOCAL coordinate system
    //                       (e.clientX - rect.left). Capturing in
    //                       local coords — NOT e.offsetX, which is
    //                       relative to the event target (could be
    //                       a child <image>) — is what fixes the
    //                       coordinate-mismatch bug from v3.10.46.
    //   dragStartPhase    — phase at pointerdown. The drag delta
    //                       (currentX - pressX) * sensitivity is
    //                       added to this, so the carousel follows
    //                       the finger relative to the press point.
    //   velocitySamples   — recent (phase/ms) samples from pointer
    //                       move, averaged at pointerup to get the
    //                       release velocity for momentum. Keeps
    //                       last VELOCITY_SAMPLE_COUNT.
    //   lastDragPhase/Time — used to compute instant velocity
    //                       between successive pointermove events.
    var isDragging = false;
    var pressX = 0;
    var dragStartPhase = 0;
    var velocitySamples = [];
    var lastDragPhase = 0;
    var lastDragTime = 0;

    // === Momentum state (v3.10.49) ===
    // Momentum is now driven by a requestAnimationFrame loop
    // (momentumLoop, defined below) instead of the GSAP tick. This
    // is the cleanest way to ensure a rapid pointerdown during
    // momentum cancels the in-flight RAF and starts fresh — no
    // reliance on the GSAP Observer's internal state.
    //   momentumVelocity  — current momentum (phase/frame at 60fps).
    //                       Decays by FRICTION each frame.
    //   momentumRAF       — the requestAnimationFrame id, or null
    //                       when no momentum is running. Stored so
    //                       a new pointerdown can cancel it.
    //   isMomentumActive  — true while the RAF loop is running.
    //                       tick() checks this and skips auto-
    //                       scroll/lerp so the loop owns the phase
    //                       update exclusively.
    var momentumVelocity = 0;
    var momentumRAF = null;
    var isMomentumActive = false;
    // v3.10.50: true while a press during momentum is "coasting"
    // the carousel to its natural stop position. During this phase
    // momentumLoop uses PRESS_DECAY_FRICTION (slower decay) instead
    // of FRICTION, so the coast is more pronounced — the carousel
    // stops at a "future position" (where the momentum would have
    // carried it) rather than at the abrupt-stop position. Cleared
    // on pointermove (user starts dragging) or when velocity drops
    // below threshold.
    var inPressDecay = false;

    // === Auto-scroll state (v3.10.37, unchanged) ===
    //   isUserPressing  — kept for clarity; equivalent to isDragging
    //                     in v3.10.49 (we have only one input
    //                     source now). tick() still reads it for
    //                     the auto-scroll gate.
    //   lastWheelTime   — timestamp of the most recent wheel
    //                     event. Auto-scroll stays paused for
    //                     WHEEL_IDLE_DELAY ms after each wheel
    //                     click so the wheel's phase update
    //                     doesn't get mixed with the auto-drift.
    var isUserPressing = false;
    var lastWheelTime = 0;

    // === Band-based zone detection ===
    var inCarouselBand = false;
    function updateBand(clientX, clientY) {
      var wasIn = inCarouselBand;
      inCarouselBand = isInCarouselBand(hero, clientX, clientY);
      if (inCarouselBand !== wasIn) {
        hero.style.cursor = inCarouselBand ? 'ew-resize' : 'default';
      }
    }
    function leaveBand() {
      if (!inCarouselBand) return;
      inCarouselBand = false;
      hero.style.cursor = 'default';
    }

    hero.addEventListener('mousemove', function (e) {
      updateBand(e.clientX, e.clientY);
    });
    hero.addEventListener('mouseleave', leaveBand);
    // Capture the band at pointer/touch PRESS time, not only on
    // mousemove. Otherwise a user who clicks before moving the mouse
    // would see inCarouselBand=false (stale initial value) and the
    // drag would silently no-op.
    hero.addEventListener('pointerdown', function (e) {
      updateBand(e.clientX, e.clientY);
    });
    hero.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches[0]) {
        updateBand(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    hero.addEventListener('touchstart', function (e) {
      if (e.touches && e.touches[0]) {
        updateBand(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    hero.addEventListener('touchend', leaveBand);
    hero.addEventListener('touchcancel', leaveBand);

    // === Per-frame update ===
    // Two modes (v3.10.49 — momentum moved to a RAF loop, see
    // momentumLoop below):
    //   1) Auto-scroll (idle, no user input, no recent wheel):
    //      advance both phase and currentPhase by the constant
    //      AUTO_SCROLL_VELOCITY. The carousel drifts right at
    //      a slow, steady pace — like a museum display.
    //   2) At rest (lerp): currentPhase eases toward phase. Used
    //      when the user is actively dragging, or within
    //      WHEEL_IDLE_DELAY ms of a wheel event (so the wheel
    //      doesn't combine with the auto-drift).
    //
    // When momentum is active (isMomentumActive = true), the RAF
    // loop owns the phase update, so tick() does nothing for the
    // phase/currentPhase math — it just runs the per-tile wrap.
    // This keeps the two update paths from fighting each other.
    // gsap.ticker.deltaRatio() scales the physics by frame time
    // so the auto-scroll velocity feels right at 30/60/120fps.
    function tick() {
      if (!isMomentumActive) {
        var now = performance.now();
        if (!isUserPressing && (now - lastWheelTime) > WHEEL_IDLE_DELAY) {
          // Mode 1: idle auto-scroll. Both phase and currentPhase
          // advance by the same delta so they stay in sync — no
          // lerp needed. deltaRatio() keeps the speed framerate-
          // independent.
          var deltaRatio = gsap.ticker.deltaRatio();
          phase += AUTO_SCROLL_VELOCITY * deltaRatio;
          currentPhase += AUTO_SCROLL_VELOCITY * deltaRatio;
        } else {
          // Mode 2: lerp toward phase. currentPhase eases into
          // the latest target the user/wheel set. This is what
          // smooths the drag (the user's pointermove updates
          // phase; the lerp eases currentPhase to catch up over
          // 1-3 frames, filtering the touch-sensor noise that
          // v3.10.39/40/41 tried to handle with dead zones —
          // see the v3.10.42 rollback note below).
          currentPhase += (phase - currentPhase) * LERP_FACTOR;
        }
      }
      // Snap when very close, to avoid a permanent fractional tween
      if (Math.abs(phase - currentPhase) < 0.05) currentPhase = phase;

      layout.forEach(function (item) {
        var displayX = item.baseX + currentPhase * item.stepFrac;
        // Wrap into the tile's valid range.
        while (displayX > item.offset + X_RANGE) displayX -= X_RANGE;
        while (displayX < item.offset) displayX += X_RANGE;
        gsap.set(item.tile, { x: displayX });
      });
    }
    gsap.ticker.add(tick);

    // === Release momentum loop (v3.10.49) ===
    // requestAnimationFrame-driven momentum decay. On pointerup we
    // start this loop (if release velocity > VELOCITY_THRESHOLD).
    // Each frame: advance phase and currentPhase by the current
    // velocity, then decay velocity by FRICTION^deltaRatio (so the
    // physics is framerate-independent). Exits when velocity drops
    // below threshold; tick() then resumes its normal auto-scroll
    // vs. lerp decision.
    //
    // The critical property: if a new pointerdown fires while the
    // loop is running, pointerdown cancels the RAF and zeroes
    // momentumVelocity. The next tick() frame sees isMomentumActive
    // = false and resumes normal behavior. There is NO global
    // accumulator that leaks between gestures — that's what fixes
    // the snap-back bug Buddie reported. Each click is a clean slate.
    function momentumLoop() {
      momentumRAF = null;
      if (Math.abs(momentumVelocity) <= VELOCITY_THRESHOLD) {
        isMomentumActive = false;
        momentumVelocity = 0;
        inPressDecay = false;
        return;
      }
      var deltaRatio = gsap.ticker.deltaRatio();
      phase += momentumVelocity * deltaRatio;
      currentPhase += momentumVelocity * deltaRatio;
      // v3.10.50: use PRESS_DECAY_FRICTION (slower decay) when
      // the user pressed during momentum and the carousel is
      // coasting to a "future position". Otherwise use the
      // normal FRICTION (post-release glide from a drag).
      // Closer to 1 = slower decay = more positions simulated.
      var currentFriction = inPressDecay ? PRESS_DECAY_FRICTION : FRICTION;
      momentumVelocity *= Math.pow(currentFriction, deltaRatio);
      momentumRAF = requestAnimationFrame(momentumLoop);
    }

    // === Wheel handler ===
    // Raw deltaY → phase increment. Proportional to the wheel
    // intensity (trackpad small deltas produce small moves; big
    // mouse wheel turns produce big moves).
    // v3.10.37: also stamp lastWheelTime so the idle auto-scroll
    // in tick() stays paused for WHEEL_IDLE_DELAY ms after each
    // wheel event — without this, the wheel's phase update would
    // be combined with the auto-drift and the carousel would
    // appear to scroll faster than the user wheeled it.
    function onWheel(e) {
      if (!inCarouselBand) return;
      e.preventDefault();
      var deltaY = readWheelDelta(e);
      if (WHEEL_INVERTED) deltaY = -deltaY;
      if (!deltaY) return;
      phase += deltaY * WHEEL_SENSITIVITY;
      lastWheelTime = performance.now();
    }
    hero.addEventListener('wheel', onWheel, { passive: false });

    // === Native Pointer Events (v3.10.49) — replaces GSAP Observer ===
    // Why native over the Observer:
    //   The GSAP Observer tracks gesture state (self.deltaX,
    //   self.startX, the onPress callback itself) across the
    //   pointerdown/pointerup cycle, and that state does NOT
    //   reset cleanly when the user does a rapid
    //   click-release-click during momentum. The Observer treats
    //   the second click as a continuation of the first gesture,
    //   leaking residual travel into the new drag — which is
    //   exactly the "snap back to the first hold" bug Buddie
    //   reported (v3.10.45, 46, 47, 48 were all attempts to
    //   work around this within the Observer; none fully fixed
    //   it).
    //
    //   Native Pointer Events fire reliably for every click, with
    //   no global state to worry about. The press position is
    //   captured fresh on every pointerdown, in the hero's LOCAL
    //   coordinate system, and the drag delta is computed
    //   relative to that local position. There is literally no
    //   cross-gesture state that can leak.
    //
    // setPointerCapture (v3.10.49):
    //   Called on pointerdown so the hero continues to receive
    //   pointermove events even if the pointer leaves the
    //   element's bounds mid-drag. Without this, fast drags
    //   would lose tracking when the cursor went off the hero.
    //
    // preventDefault on pointerdown (v3.10.9 carryover, was on
    // the Observer before):
    //   Critical on mobile: without it, the browser would
    //   scroll the page horizontally instead of letting the
    //   carousel capture the drag, so mobile users couldn't
    //   see the other tiles. We do it in the listener now.

    function onPointerDown(e) {
      // v3.10.50: Press-during-momentum now COASTS to a "future
      // position" instead of snapping to the press position.
      // If there's in-flight release momentum, we DON'T cancel
      // the RAF — we let it keep running, but flag it as
      // "press decay" so momentumLoop uses PRESS_DECAY_FRICTION
      // (slower decay) for a more pronounced coast. The drag
      // will pick up from wherever the carousel is at that
      // moment. If the user never drags (just taps), the coast
      // continues until the momentum naturally decays, and the
      // carousel stops at the "future position" — the place
      // it would have reached if the user hadn't pressed.
      //
      // The snap-back fix from v3.10.49 is still intact for the
      // case where the user actually DRAGS: pointermove cancels
      // the press decay (see below) and zeroes the velocity, so
      // the drag starts clean. The flag distinguishes "tap during
      // momentum" (let it coast) from "drag during momentum"
      // (cancel and take over).
      if (momentumRAF !== null) {
        inPressDecay = true;
        // DON'T cancel momentumRAF, DON'T zero momentumVelocity.
        // The RAF is still updating phase + currentPhase each
        // frame, and momentumLoop will check inPressDecay to
        // apply the slower friction.
      } else {
        inPressDecay = false;
      }

      // Capture press position in the hero's LOCAL coordinate
      // system. This is the fix for the v3.10.46 coordinate-
      // mismatch bug: e.offsetX would be relative to whatever
      // child element the pointer was over (an <image>, the
      // text, etc.), but e.clientX - rect.left is always
      // relative to the hero regardless of which child was
      // hit-tested. Both sides of the drag-delta subtraction
      // (pressX and the current pointerX) are in the same
      // frame, so the math is always correct.
      var rect = hero.getBoundingClientRect();
      pressX = e.clientX - rect.left;

      // Snapshot the phase so the drag is relative to the
      // press point, not absolute. (Equivalent to v3.10.45's
      // dragStartPhase = phase in the Observer's onPress.)
      dragStartPhase = phase;

      // Reset velocity sampling for the new gesture.
      lastDragPhase = phase;
      lastDragTime = performance.now();
      velocitySamples = [];

      isDragging = true;
      isUserPressing = true;

      // Keep move events flowing even if pointer leaves the hero.
      try { hero.setPointerCapture(e.pointerId); } catch (err) {}

      // Stop the browser from doing its own thing (page scroll on
      // mobile, text selection on desktop).
      e.preventDefault();
    }

    function onPointerMove(e) {
      // Only act on moves while we're actually dragging. The
      // pointermove event fires for any pointer movement over
      // the element, not just drags — gating on isDragging
      // prevents accidental phase updates from a stray hover.
      if (!isDragging) return;

      // v3.10.50: If we were in press decay (tap during
      // momentum), the user is now actually dragging — cancel
      // the press decay, zero the velocity, and re-anchor the
      // drag to the CURRENT position so the math is clean.
      // Without this re-anchor, the drag would be relative to
      // the press position while the phase has been moving
      // forward from the coast, which would feel laggy/wrong.
      if (inPressDecay) {
        if (momentumRAF !== null) {
          cancelAnimationFrame(momentumRAF);
          momentumRAF = null;
        }
        isMomentumActive = false;
        momentumVelocity = 0;
        inPressDecay = false;
        // Re-anchor: the drag starts from the current phase
        // and the current pointer position, so the delta
        // (currentX - pressX) is zero at this moment and
        // grows from here as the user drags.
        var pressRect = hero.getBoundingClientRect();
        pressX = e.clientX - pressRect.left;
        dragStartPhase = phase;
        lastDragPhase = phase;
        lastDragTime = performance.now();
        velocitySamples = [];
      }

      // Same coordinate frame as the press (see onPointerDown).
      var rect = hero.getBoundingClientRect();
      var currentX = e.clientX - rect.left;
      var deltaX = currentX - pressX;

      var now = performance.now();
      var newPhase = dragStartPhase + deltaX * DRAG_SENSITIVITY / 1000;

      // Sample instant velocity (phase per ms) for the release-
      // momentum calculation in onPointerUp. We track the last
      // VELOCITY_SAMPLE_COUNT samples and average them on
      // release — averaging smooths out jitter from individual
      // pointermove events (touch sensor noise, mouse
      // acceleration curves, etc.).
      var dt = now - lastDragTime;
      if (dt > 0) {
        var instantVelocity = (newPhase - lastDragPhase) / dt;
        velocitySamples.push(instantVelocity);
        if (velocitySamples.length > VELOCITY_SAMPLE_COUNT) {
          velocitySamples.shift();
        }
      }
      lastDragPhase = newPhase;
      lastDragTime = now;

      // Only update phase here — NOT currentPhase. The lerp in
      // tick() catches currentPhase up to phase over 1-3 frames,
      // which is what filters the touch-sensor noise on every
      // pointermove. Bypassing the lerp (setting currentPhase
      // directly here) was tried in v3.10.39 and reintroduced
      // stutter on fast drags — see the v3.10.42 rollback note.
      phase = newPhase;

      e.preventDefault();
    }

    function onPointerUp(e) {
      // If we're not in a drag (e.g., a stray pointerup from a
      // click that started before the carousel initialized),
      // bail. The release-momentum + auto-scroll logic below
      // would still run, but isDragging gates that.
      if (!isDragging) return;
      isDragging = false;
      isUserPressing = false;

      // Release the pointer capture so the browser can do its
      // normal thing again.
      try { hero.releasePointerCapture(e.pointerId); } catch (err) {}

      // v3.10.50: If we're in press decay, the user just
      // tapped (no drag happened) — the RAF is still running
      // and will continue coasting to the "future position".
      // Do NOT compute a release velocity (velocitySamples is
      // empty since the user didn't move) and do NOT start a
      // new RAF. Just bail and let the existing coast play out.
      if (inPressDecay) {
        return;
      }

      // Compute release velocity from samples. If the user
      // didn't move enough to produce samples, no momentum
      // (they just clicked without dragging).
      if (velocitySamples.length > 0) {
        var sum = 0;
        for (var i = 0; i < velocitySamples.length; i++) {
          sum += velocitySamples[i];
        }
        var avgVelocityPerMs = sum / velocitySamples.length;
        // Convert phase/ms → phase/frame (16.67ms at 60fps).
        // The RAF loop scales by deltaRatio() (from
        // gsap.ticker) for variable framerates.
        momentumVelocity = avgVelocityPerMs * 16.67;
        // v3.10.36 carryover: PC gets a quarter of the push,
        // so a 10-50px mouse drag doesn't go flying across
        // the loop. Mobile is unchanged.
        if (!isMobile) momentumVelocity *= PC_VELOCITY_SCALE;

        // Only start the momentum loop if the release velocity
        // is meaningful. Otherwise, isMomentumActive stays
        // false and tick()'s auto-scroll takes over
        // immediately (after the WHEEL_IDLE_DELAY if relevant).
        if (Math.abs(momentumVelocity) > VELOCITY_THRESHOLD) {
          isMomentumActive = true;
          momentumRAF = requestAnimationFrame(momentumLoop);
        }
      }
    }

    hero.addEventListener('pointerdown',   onPointerDown);
    hero.addEventListener('pointermove',   onPointerMove);
    hero.addEventListener('pointerup',     onPointerUp);
    hero.addEventListener('pointercancel', onPointerUp);
    // pointerleave is NOT a cancel — the user might just be
    // moving the pointer off the hero briefly. With
    // setPointerCapture we keep getting pointermove events
    // even outside the hero, so we don't need pointerleave
    // to do anything special.

    // === Resize: re-check the mobile breakpoint ===
    // If the user resizes from desktop down to mobile (or vice versa),
    // the carousel state needs to be re-evaluated. On resize to mobile,
    // we don't actually stop the ticker (would require more plumbing)
    // — but the SVG is hidden via CSS so the user sees the static
    // background, not the carousel. The state will be correct on
    // next page load.
  }

  function boot() {
    if (typeof gsap === 'undefined') {
      setTimeout(boot, 60);
      return;
    }
    init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();