/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.9).
   ────────────────────────────────────────────────────────────────────────
   v3.9 fixes (Buddie QA pass on v3.8):
   1. NO TRAILING GAP. v3.8 hard-coded X_RANGE = 3600 (= 4 ×
      bigSpacing), but with 3 bigs the last big ends at 2300 and the
      4th small at 3500 — leaving a 100px ghost slot before the loop
      wrapped. v3.9 computes X_RANGE from the actual layout:
      X_RANGE = max(lastBigEnd, lastSmallEnd). For the current photo
      set that's 3500. The 4th small now abuts the next big's left
      clone with no gap.

   2. SMALLS WOBBLE. v3.8 randomized each small's reference Y once
      at init and then never moved them again — they looked frozen.
      v3.9 adds a per-frame random Y offset (±3px) in the tick loop
      so the smalls feel alive while still anchored to their
      reference point. Bigs are untouched (their motion is x-only).

   3. DRAG WORKS ANYWHERE. v3.8 gated drag on inCarouselBand, but
      inCarouselBand only updated on mousemove — so a user who
      clicked without first moving the mouse would trigger the
      Observer with a stale inCarouselBand=false and drag would
      silently no-op. v3.9:
      • updates inCarouselBand on pointerdown/touchstart too, so
        the band is fresh at press time
      • lets drag work anywhere inside the hero (the band only
        gates WHEEL, so the page can still scroll when the user
        wheels in the middle of the hero)

   What stayed the same (still true from v3.8):
   • Phase-based scrub: global phase accumulates raw deltaY, rAF
     lerp interpolates currentPhase → phase, each tile's x is
     baseX + currentPhase * stepFrac via gsap.set.
   • Smalls evenly distributed at 1 bigSpacing apart (no adjacent
     pair cluster).
   • Mobile-aware: viewports < 768px skip the carousel entirely.
   • Band-based zones for WHEEL: outer 20% scrubs, middle 60%
     passes wheel to the page.
   • Data-driven layout: `<image data-size="big|small">` in HTML.
   • Seamless wrap: each original tile gets two clones (±X_RANGE).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Mobile breakpoint: below this width we skip the carousel entirely
  // (CSS hides the SVG and the .hero gets a background image instead).
  var MOBILE_MAX_WIDTH = 768;

  // Per-tile phase multipliers. 1.0 = full speed, 2.0 = 2× parallax.
  // Smalls scroll 2× faster than bigs for the CodePen depth effect.
  var BIG_PHASE_FRAC = 1.0;
  var SMALL_PHASE_FRAC = 2.0;

  // Smoothing. The lerp factor for current → target each frame.
  // 0.18 = noticeable glide without feeling laggy. Higher = snappier.
  var LERP_FACTOR = 0.18;

  // Wheel sensitivity. deltaY values vary wildly (trackpad ~2-10,
  // mouse wheel ~100-300), so we multiply by a tuned constant.
  // With this value: trackpad tick (deltaY ~5) advances phase ~5px,
  // mouse wheel click (deltaY ~120) advances phase ~120px. Feels
  // right on both.
  var WHEEL_SENSITIVITY = 1.0;

  // Drag/touch sensitivity. GSAP Observer's velocityX is in px/ms.
  // We multiply by a constant to convert to a phase increment.
  var DRAG_SENSITIVITY = 60;

  // ── Layout constants ──────────────────────────────────────────────
  var BIG_WIDTH = 500;
  var BIG_HEIGHT = 500;
  var SMALL_WIDTH = 200;
  var SMALL_HEIGHT = 200;

  // Loop length. 4 × bigSpacing so the 4 smalls can each be 1
  // bigSpacing apart (avoids the "trailing pair" cluster).
  var BIG_SPACING = 900;
  // X_RANGE is computed dynamically inside buildLayout() from the
  // actual tile layout, so the last tile ends exactly at the loop
  // boundary — no trailing empty slot. The 3600 default is the upper
  // bound used by the comments above; buildLayout() may shrink it.
  var X_RANGE = BIG_SPACING * 4; // 3600 (upper bound; buildLayout() refines it)

  // Y positions
  var BIG_Y = 200;
  var SMALL_Y = 350;
  var SMALL_Y_JITTER = 15; // ±15px variation for visual interest

  // Gap between smalls and bigs
  var SMALL_GAP = 10;

  // Per-frame Y jitter range for smalls. The reference Y is set once
  // at init (so each small has its own anchor), and we add ±half of
  // this value per frame in tick() to give the smalls a subtle
  // "alive" wobble. Pure random — no smoothing — because at 60fps a
  // ±3px random walk reads as gentle motion, not noise.
  var SMALL_JITTER_RANGE = 6; // ±3px per frame

  // First small's x position. Chosen so the small sits in the gap
  // between big 0 (0..500) and big 1 (900..1400), centered with the
  // standard 10px padding on each side. gap = 400, padding =
  // (400 - 200 - 20) / 2 = 90, so x = 500 + 10 + 90 = 600.
  var FIRST_SMALL_X = 600;

  // Carousel band: outer X% on each side of the hero.
  var BAND_FRACTION = 0.20;
  var BAND_MIN_PX = 100;

  // Set true if your mouse's wheel is inverted (deltaY polarity
  // is the opposite of what we expect). E.g. some Linux distros
  // with "natural scrolling" enabled.
  var WHEEL_INVERTED = false;

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

    // Compute X_RANGE from the actual layout so the loop ends exactly
    // at the last tile's right edge — no trailing empty slot. For
    // 3 bigs + 4 smalls with FIRST_SMALL_X=600, BIG_SPACING=900:
    //   lastBigEnd   = 2*900 + 500            = 2300
    //   lastSmallEnd = 600 + 3*900 + 200      = 3500
    //   X_RANGE      = max(2300, 3500) = 3500
    // The 4th small now abuts the next big's left clone with no gap.
    var lastBigEnd = (bigCount - 1) * BIG_SPACING + BIG_WIDTH;
    var lastSmallEnd = smalls.length > 0
      ? FIRST_SMALL_X + (smalls.length - 1) * BIG_SPACING + SMALL_WIDTH
      : 0;
    X_RANGE = Math.max(lastBigEnd, lastSmallEnd);

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

    // Bigs: evenly distributed at 0, BIG_SPACING, 2*BIG_SPACING, ...
    // (Last position is (bigCount-1) * BIG_SPACING; remaining space
    // in the loop is the trailing gap for extra smalls.)
    bigs.forEach(function (tile, i) {
      var x = i * BIG_SPACING;
      pushThree(tile, 'big', x, BIG_Y, BIG_PHASE_FRAC);
    });

    // Smalls: each small sits 1 bigSpacing after the previous, starting
    // at FIRST_SMALL_X. This guarantees no two smalls are adjacent —
    // every pair of smalls is separated by bigSpacing (~900px), the
    // same as the big-to-big spacing. Fixes the "trailing pair" cluster.
    smalls.forEach(function (tile, i) {
      var x = FIRST_SMALL_X + i * BIG_SPACING;
      // Allow per-tile y override via data-y attribute (for fine-tuning)
      var yOverride = tile.getAttribute('data-y');
      var y = yOverride !== null
        ? parseFloat(yOverride)
        : SMALL_Y + (Math.random() - 0.5) * SMALL_Y_JITTER;
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

  function init() {
    var hero = document.getElementById('top');
    var stage = document.getElementById('hero-carousel-svg');
    if (!hero || !stage) return;
    if (typeof gsap === 'undefined') return;

    // Mobile skip: the SVG is hidden by CSS, .hero has a static
    // background image, and the carousel JS has nothing to scrub.
    if (window.innerWidth < MOBILE_MAX_WIDTH) return;

    // Build the layout from the photos in the SVG
    var layout = buildLayout(stage);
    if (!layout.length) return;

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
    // Lerp current toward target, then position every tile by its
    // baseX + (current * stepFrac). Wrapped into the tile's valid
    // range [offset, offset+X_RANGE] so the tile cycles through its
    // loop position. Wrapping displayX (not phase) means the lerp
    // never goes "the long way" at the boundaries.
    function tick() {
      currentPhase += (phase - currentPhase) * LERP_FACTOR;
      // Snap when very close, to avoid a permanent fractional tween
      if (Math.abs(phase - currentPhase) < 0.05) currentPhase = phase;

      layout.forEach(function (item) {
        var displayX = item.baseX + currentPhase * item.stepFrac;
        // Wrap into the tile's valid range.
        while (displayX > item.offset + X_RANGE) displayX -= X_RANGE;
        while (displayX < item.offset) displayX += X_RANGE;
        if (item.size === 'small') {
          // Subtle per-frame Y wobble so the smalls feel "alive"
          // instead of locked to their reference position. Bigs
          // stay still — the parallax comes from x only.
          var jitter = (Math.random() - 0.5) * SMALL_JITTER_RANGE;
          gsap.set(item.tile, { x: displayX, y: item.y + jitter });
        } else {
          gsap.set(item.tile, { x: displayX });
        }
      });
    }
    gsap.ticker.add(tick);

    // === Wheel handler ===
    // Raw deltaY → phase increment. Proportional to the wheel
    // intensity (trackpad small deltas produce small moves; big
    // mouse wheel turns produce big moves).
    function onWheel(e) {
      if (!inCarouselBand) return;
      e.preventDefault();
      var deltaY = readWheelDelta(e);
      if (WHEEL_INVERTED) deltaY = -deltaY;
      if (!deltaY) return;
      phase += deltaY * WHEEL_SENSITIVITY;
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
        preventDefault: false,
        onPress: function () {
          // Capture phase at press time so onDrag has a stable base
          // even if the user starts a drag before any mousemove fires.
          dragStartPhase = phase;
        },
        onDrag: function (self) {
          // self.deltaX is total horizontal drag distance since start.
          // Drag right (positive) → tiles move right → phase grows.
          phase = dragStartPhase + self.deltaX * DRAG_SENSITIVITY / 1000;
        },
        // onLeft/onRight: discrete gestures (fling past threshold).
        // Only bump phase if the fling started inside the band —
        // outside the band, the user is just trying to scroll the
        // page and we shouldn't move the carousel.
        onLeft:  function () { if (inCarouselBand) phase -= 50; },
        onRight: function () { if (inCarouselBand) phase += 50; }
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