/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.10.39).
   ────────────────────────────────────────────────────────────────────────
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
   The drag (onDrag), the flings (onLeft/onRight), and the
   Observer's onPress all fire regardless of where on the hero
   the touch lands.

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

  // SCALE: 1.0 on desktop, 1.2 on mobile. v3.10.32: bumped mobile
  // from 1.0 → 1.2 per Buddie's request — the carousel tiles
  // (bigs + smalls) read a bit small on a 375–414px phone and
  // the user wanted them larger. All layout constants below
  // (BIG_WIDTH, BIG_HEIGHT, SMALL_WIDTH, SMALL_HEIGHT,
  // BIG_SPACING, INITIAL_OFFSET, WRAP_MARGIN, BIG_Y, SMALL_GAP)
  // multiply by SCALE, so scaling it up scales the whole
  // carousel proportionally — tiles get bigger AND the
  // spacing between them gets bigger, the layout stays the
  // same shape just at 1.2× on mobile. Desktop stays 1.0.
  // Buddie: "can we do the images more large on mobile? like 1.2".
  var isMobile = window.innerWidth < MOBILE_MAX_WIDTH;
  var SCALE = isMobile ? 1.2 : 1.0;

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
  var BIG_Y = 200 * SCALE;
  // (Each small spawns at a random y in [SMALL_Y_MIN, SMALL_Y_MAX]
  // defined further down — the old single-anchor SMALL_Y is gone.)

  // Gap between smalls and bigs
  var SMALL_GAP = 10 * SCALE;

  // Y range for smalls. Each small spawns at a random y in this range
  // so they look like a scattered set, not a row. The range was wide
  // in v3.9.3 ([50, ~750], 700 units) but Buddie found that "they
  // spawn all over the place on the y aspect" on mobile and asked
  // to "limit that so they spawn less freely." v3.10.10 narrows the
  // band to [100, 400] = 300 units — the smalls still have plenty
  // of vertical variation per tile (300 / 4 smalls = 75 units
  // average spread) but they cluster around the big instead of
  // spraying to the top and bottom of the 900-unit viewBox.
  var SMALL_Y_MIN = 100 * SCALE;
  var SMALL_Y_MAX = 400 * SCALE;

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
  var VELOCITY_THRESHOLD = 0.05;  // below this, stop momentum
  var VELOCITY_SAMPLE_COUNT = 4;   // how many recent samples to average
  var FLING_VELOCITY = 30;        // phase/frame for onLeft/onRight flings (mobile)
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
      // BIG_Y=0: anchor the big at the TOP of the SVG so the
      // empty area below it (where the overlaid text sits) is
      // the only "space" on the hero. (Buddie: "the space could
      // start perfectly on the highest point of the images.")
      BIG_Y = 0;
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

    // Create left (-X_RANGE) and right (+X_RANGE) clones of every
    // original tile. The clones share the same href (cloneNode(true)
    // preserves attributes including href), so when one copy slides
    // off-screen, the replacement copy is the same photo — no visible
    // teleport.
    var leftClone = new WeakMap();
    var rightClone = new WeakMap();
    bigs.concat(smalls).forEach(function (tile) {
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
      pushThree(tile, 'big', x, BIG_Y, BIG_PHASE_FRAC);
    });

    // Smalls: each at a unique (x, y) in the CONTENT area (not in
    // the left/right padding). X is evenly distributed across the
    // content area with a small ±30px random offset (avoids landing
    // on a perfect grid line). Y is a wide random in [SMALL_Y_MIN,
    // SMALL_Y_MAX] so each small sits at a clearly different vertical
    // position. No per-frame jitter — positions are fixed at init.
    // data-y attribute still overrides the random y for fine-tuning.
    var smallsLeft = INITIAL_OFFSET;
    var smallsRight = X_RANGE - WRAP_MARGIN - SMALL_WIDTH;
    var xSlotWidth = (smallsRight - smallsLeft) / smalls.length;
    smalls.forEach(function (tile, i) {
      var xSlot = smallsLeft + (i + 0.5) * xSlotWidth;
      var xOffset = (Math.random() - 0.5) * SMALL_X_OFFSET_RANGE; // ±30 desktop, ±12 mobile
      var x = Math.max(smallsLeft, Math.min(smallsRight, xSlot + xOffset));

      var yOverride = tile.getAttribute('data-y');
      var y = yOverride !== null
        ? parseFloat(yOverride)
        : SMALL_Y_MIN + Math.random() * (SMALL_Y_MAX - SMALL_Y_MIN);
      pushThree(tile, 'small', x, y, SMALL_PHASE_FRAC);
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

    // === Momentum state (v3.10.33) ===
    //   velocity          — phase units per frame, positive = right.
    //                       Non-zero = momentum is active.
    //   velocitySamples   — recent (phase/ms) samples from onDrag,
    //                       averaged at onDragEnd to get the
    //                       release velocity. Keeps last N.
    //   lastDragPhase/Time — used to compute instant velocity
    //                       between successive onDrag calls.
    //   flingOccurred     — flag: onLeft/onRight already set the
    //                       velocity, so onDragEnd should NOT
    //                       overwrite it with the sample average.
    var velocity = 0;
    var velocitySamples = [];
    var lastDragPhase = 0;
    var lastDragTime = 0;
    var flingOccurred = false;

    // === Auto-scroll state (v3.10.37) ===
    //   isUserPressing  — true while the user is actively touching
    //                     or clicking the carousel. Disables
    //                     auto-scroll so the drag is the only
    //                     force acting on phase.
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
    // Three modes (v3.10.37):
    //   1) Momentum (velocity != 0): advance both phase and
    //      currentPhase by velocity, then decay velocity by
    //      FRICTION. Skips the lerp entirely so the tiles
    //      follow the momentum exactly — no chase lag.
    //   2) Auto-scroll (idle, no user input, no recent wheel):
    //      advance both phase and currentPhase by the constant
    //      AUTO_SCROLL_VELOCITY. The carousel drifts right at
    //      a slow, steady pace — like a museum display.
    //   3) At rest (lerp): currentPhase eases toward phase. Used
    //      when the user is actively dragging, or within
    //      WHEEL_IDLE_DELAY ms of a wheel event (so the wheel
    //      doesn't combine with the auto-drift).
    // gsap.ticker.deltaRatio() scales the physics by frame time
    // so the same FRICTION / velocity feel right at 30, 60, 120fps.
    function tick() {
      if (Math.abs(velocity) > VELOCITY_THRESHOLD) {
        // Mode 1: momentum.
        var deltaRatio = gsap.ticker.deltaRatio();
        phase += velocity * deltaRatio;
        currentPhase += velocity * deltaRatio;
        // Decay: velocity *= FRICTION per 60fps frame.
        // Math.pow(FRICTION, deltaRatio) gives the right decay
        // for the current frame's elapsed time.
        velocity *= Math.pow(FRICTION, deltaRatio);
      } else {
        velocity = 0;
        // v3.10.37: choose between auto-scroll and lerp.
        // Auto-scroll runs only when the user is NOT pressing
        // AND the last wheel event was more than
        // WHEEL_IDLE_DELAY ms ago. If either condition fails,
        // fall through to the lerp so the user/wheel's phase
        // changes settle without the auto-drift piling on top.
        var now = performance.now();
        if (!isUserPressing && (now - lastWheelTime) > WHEEL_IDLE_DELAY) {
          // Mode 2: idle auto-scroll. Both phase and currentPhase
          // advance by the same delta so they stay in sync — no
          // lerp needed. deltaRatio() keeps the speed framerate-
          // independent (0.3 phase/frame at 60fps, scaled by
          // deltaRatio for other rates).
          var deltaRatio = gsap.ticker.deltaRatio();
          phase += AUTO_SCROLL_VELOCITY * deltaRatio;
          currentPhase += AUTO_SCROLL_VELOCITY * deltaRatio;
        } else {
          // Mode 3: lerp toward phase. currentPhase eases into
          // the latest target the user/wheel set.
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

    // === GSAP Observer (drag / touch gestures) ===
    if (typeof Observer !== 'undefined') {
      // onDrag / onDragEnd capture total horizontal travel since the
      // gesture started (self.deltaX). We add it to phase so the
      // carousel follows the finger.
      //
      // Drag is allowed anywhere inside the hero — the band only
      // gates WHEEL, so the page can still scroll normally when the
      // user wheels in the middle of the hero. For drag, the user's
      // intent is unambiguous: if they're clicking on the hero, they
      // want to drag the photos.
      var dragStartPhase = 0;
      Observer.create({
        target: hero,
        type: 'touch,pointer',
        // Wheel is already handled above; tell Observer to ignore it
        // so it doesn't double-count.
        //
        // preventDefault:true (v3.10.9) is critical on mobile: with
        // it false, the browser was scrolling the page instead of
        // letting the carousel capture the horizontal drag, so
        // mobile users couldn't see the other tiles. (Buddie: "on
        // mobile i can't scroll to see the other images.")
        preventDefault: true,
        onPress: function () {
          // Capture phase at press time so onDrag has a stable base
          // even if the user starts a drag before any mousemove fires.
          // v3.10.33: also reset momentum state — any in-flight
          // velocity from a previous gesture is dropped, and the
          // sample buffer is cleared for the new gesture.
          // v3.10.37: mark the user as actively pressing so the
          // idle auto-scroll in tick() backs off — the drag is
          // the only force acting on phase now.
          dragStartPhase = phase;
          velocity = 0;
          velocitySamples = [];
          flingOccurred = false;
          lastDragPhase = phase;
          lastDragTime = performance.now();
          isUserPressing = true;
        },
        onDrag: function (self) {
          // self.deltaX is total horizontal drag distance since start.
          // Drag right (positive) → tiles move right → phase grows.
          var now = performance.now();
          var newPhase = dragStartPhase + self.deltaX * DRAG_SENSITIVITY / 1000;
          // v3.10.33: sample instant velocity (phase per ms) for
          // the release-momentum calc in onDragEnd. We track the
          // last VELOCITY_SAMPLE_COUNT samples and average them
          // on release — averaging smooths out jitter from
          // individual pointermove events.
          var dt = now - lastDragTime;
          if (dt > 0) {
            var instantVelocity = (newPhase - lastDragPhase) / dt;
            velocitySamples.push(instantVelocity);
            if (velocitySamples.length > VELOCITY_SAMPLE_COUNT) {
              velocitySamples.shift();
            }
          }
          phase = newPhase;
          // v3.10.39: also set currentPhase = newPhase. The old
          // behavior only set phase, then tick()'s lerp would
          // chase currentPhase toward phase. With LERP_FACTOR=0.18
          // at 60fps, the catch-up is ~3 frames for a fast drag
          // — the tiles visibly lag behind the finger by 1-3
          // frames, and on release the gap would persist as the
          // momentum moved the tiles from the lagging position
          // (the "not smooth" interactive feel). Now the tiles
          // follow the finger exactly, and at release there's
          // zero gap for the momentum to inherit — momentum
          // continues from the exact finger position, not from
          // a lagging copy of it.
          currentPhase = newPhase;
          lastDragPhase = newPhase;
          lastDragTime = now;
        },
        // v3.10.33: on release, convert the averaged sample
        // velocity into a phase/frame momentum value. gsap's
        // tick() will apply it with FRICTION decay until it
        // drops below VELOCITY_THRESHOLD, then the normal lerp
        // takes over. If a fling (onLeft/onRight) already fired,
        // skip — the fling already set the velocity.
        // v3.10.36: scale the final velocity down on PC so a
        // 10-50px mouse drag doesn't "go flying" — quarter the
        // push on PC, full push on mobile.
        // v3.10.37: also clear isUserPressing so the idle
        // auto-scroll can resume (after the momentum decays).
        onDragEnd: function () {
          isUserPressing = false;
          if (flingOccurred) {
            flingOccurred = false;
            return;
          }
          if (velocitySamples.length > 0) {
            var sum = 0;
            for (var i = 0; i < velocitySamples.length; i++) {
              sum += velocitySamples[i];
            }
            var avgVelocityPerMs = sum / velocitySamples.length;
            // Convert phase/ms → phase/frame (16.67ms at 60fps).
            // tick() scales by deltaRatio() for variable framerates.
            velocity = avgVelocityPerMs * 16.67;
            if (!isMobile) velocity *= PC_VELOCITY_SCALE;
          }
        },
        // onLeft/onRight: discrete gestures (fling past threshold).
        // v3.10.9: drop the inCarouselBand gate — the band is a
        // desktop concept (outer 20% of the hero, used for the
        // wheel-zone split). On mobile the user can swipe from
        // anywhere, and the band check was preventing swipes that
        // started in the middle 60% from advancing the carousel.
        // v3.10.33: instead of a discrete phase jump (was ±50),
        // set a fling velocity — the carousel will smoothly
        // decelerate from this velocity via FRICTION, giving the
        // same "scroll and settle" feel as a regular drag release.
        // v3.10.36: quarter the fling on PC (same scale as
        // onDragEnd) so desktop flings don't blast across the loop.
        // v3.10.37: clear isUserPressing here too — a fling is
        // an exit from the press, and the next onDragEnd will
        // early-return via the flingOccurred flag, so we MUST
        // clear isUserPressing in both places or the flag would
        // stay stuck true after a fling.
        // flingOccurred flag tells onDragEnd to skip its own
        // velocity calc so we don't overwrite the fling.
        onLeft:  function () {
          isUserPressing = false;
          velocity = isMobile ? -FLING_VELOCITY : -FLING_VELOCITY * PC_VELOCITY_SCALE;
          flingOccurred = true;
        },
        onRight: function () {
          isUserPressing = false;
          velocity = isMobile ?  FLING_VELOCITY :  FLING_VELOCITY * PC_VELOCITY_SCALE;
          flingOccurred = true;
        }
      });
    }

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