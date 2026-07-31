/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.9.1).
   ────────────────────────────────────────────────────────────────────────
   v3.9 → v3.9.1 (Buddie QA pass on v3.9):

   v3.9 misread "move them a little with a random" as per-frame
   jitter, but Buddie clarified: no constant motion — each small
   should just SPAWN at a different position from the others. So
   v3.9.1:
   • drops the per-frame Y wobble (smalls are fully static now)
   • widens each small's spawn y to a wide random range
     (SMALL_Y_MIN..SMALL_Y_MAX, default 50..650) so they look
     scattered, not aligned
   • distributes x evenly across the loop with a ±30px offset so
     they're not on a perfect grid line either

   Also, Buddie caught that the wrap still had a big gap between
   the last big and the first: with BIG_SPACING=900 and 3 bigs,
   big 2 ended at 2300 and big 0's right clone was at 3600 (a
   1300px gap with smalls scattered in it). That didn't look like
   a "continuous" carousel. v3.9.1 makes the bigs abut:
   • BIG_SPACING = BIG_WIDTH = 500, so bigs tile back-to-back
   • loop = bigCount × BIG_SPACING (= 1500 for 3 bigs), with no
     trailing slot
   • big 0's right clone starts exactly where big 2 ends, so the
     loop reads as a continuous ribbon

   v3.9 fixes that stayed:
   • Drag works anywhere in the hero (band only gates WHEEL).
   • inCarouselBand is updated on pointerdown / touchstart too, so
     drag is fresh at press time.
   • X_RANGE is computed from the layout, not hard-coded.

   What stayed the same (still true from v3.8):
   • Phase-based scrub (global phase, lerped to currentPhase, tile
     x = baseX + currentPhase * stepFrac via gsap.set).
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

  // Loop length. Bigs abut perfectly: BIG_SPACING = BIG_WIDTH, so
  // big i+1 starts exactly where big i ends. The loop is exactly
  // bigCount × BIG_SPACING — no trailing gap, no "phantom" slot
  // where a missing big would go. (Buddie's QA on v3.9: "the gap
  // between the last of the big images and the first is not solved".)
  // X_RANGE is computed inside buildLayout() = last big's right edge.
  var BIG_SPACING = 500;
  var X_RANGE = BIG_SPACING * 4; // upper bound; buildLayout() refines it

  // Y positions
  var BIG_Y = 200;
  // (Each small spawns at a random y in [SMALL_Y_MIN, SMALL_Y_MAX]
  // defined further down — the old single-anchor SMALL_Y is gone.)

  // Gap between smalls and bigs
  var SMALL_GAP = 10;

  // Y range for smalls. Each small spawns at a random y in this range
  // so they look like a scattered set, not a row. Wide spread on
  // purpose — Buddie's QA: "I want them to spawn different from each
  // other, no jitter." The range covers the full SVG height minus
  // margins so smalls can appear above, between, and below the bigs.
  var SMALL_Y_MIN = 50;
  var SMALL_Y_MAX = 650;

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

    // Compute X_RANGE so the loop ends exactly at the last big's
    // right edge. Bigs are now continuous (BIG_SPACING = BIG_WIDTH),
    // so the loop is exactly bigCount × BIG_SPACING. Smalls are
    // placed within the loop (x in [0, X_RANGE - SMALL_WIDTH]), so
    // they don't extend X_RANGE.
    //   For 3 bigs: X_RANGE = 2*500 + 500 = 1500
    //   Big 0's right clone starts at 1500, abutting big 2's end.
    var lastBigEnd = (bigCount - 1) * BIG_SPACING + BIG_WIDTH;
    X_RANGE = lastBigEnd;

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

    // Smalls: each at a unique (x, y) so the row reads as a
    // scattered set, not a grid. X is evenly distributed across the
    // loop with a small ±30px random offset (avoids landing on a
    // perfect grid line). Y is a wide random in [SMALL_Y_MIN,
    // SMALL_Y_MAX] so each small sits at a clearly different vertical
    // position. No per-frame jitter — positions are fixed at init.
    // data-y attribute still overrides the random y for fine-tuning.
    var xSlotWidth = (X_RANGE - SMALL_WIDTH) / smalls.length;
    smalls.forEach(function (tile, i) {
      var xSlot = (i + 0.5) * xSlotWidth;
      var xOffset = (Math.random() - 0.5) * 60; // ±30px
      var x = Math.max(0, Math.min(X_RANGE - SMALL_WIDTH, xSlot + xOffset));

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
        gsap.set(item.tile, { x: displayX });
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