/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.8).
   ────────────────────────────────────────────────────────────────────────
   v3.8 fixes (Buddie QA pass):
   1. SMOOTH SCRUB. The old per-event `gsap.to(..., {duration: 0.2,
      overwrite: 'auto'})` was the cause of the "not smooth" feel —
      every wheel tick restarted the tween, so tiles kept chasing a
      moving target. v3.8 switches to a phase-based scrub:
      • a single global `phase` accumulates raw `deltaY * SENSITIVITY`
      • each frame, an rAF lerp interpolates `currentPhase → phase`
      • each tile's x is `baseX + currentPhase * stepFrac`, set
        directly with `gsap.set` (no tween, no overwrite)
      The result: motion is proportional to the wheel (trackpad feels
      like a trackpad, mouse wheel feels like a mouse wheel) AND
      smooth (the lerp absorbs the discrete event steps).

   2. NO "PAIR" OF SMALLS. The old layout packed the 2 trailing
      smalls only 210px apart (smalls 200 + gap 10), so they entered
      the viewport side-by-side looking like a pair. v3.8 distributes
      all 4 smalls evenly, each 1 bigSpacing (~900px) apart from
      the next. New loop = 4 × bigSpacing = 3600. Smalls at 600,
      1500, 2400, 3300 — no two smalls are ever adjacent.

   3. MOBILE-AWARE. Viewports < 768px skip the carousel entirely
      (the SVG is hidden by CSS, the .hero gets a static background
      image). No tiny tiles, no wasted images, no broken wheel.

   What stayed the same (still true from v3.6/v3.7):
   • Band-based zones: outer 20% of hero scrubs, middle 60% passes
     wheel to the page.
   • Data-driven layout: `<image data-size="big|small">` in HTML.
   • Seamless wrap: each original tile gets two clones (±X_RANGE).
     All three copies move in lockstep via the shared `phase`, so
     when one copy slides off-screen, its sibling slides in from
     the opposite edge — no visible teleport.
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
  var X_RANGE = BIG_SPACING * 4; // 3600

  // Y positions
  var BIG_Y = 200;
  var SMALL_Y = 350;
  var SMALL_Y_JITTER = 15; // ±15px variation for visual interest

  // Gap between smalls and bigs
  var SMALL_GAP = 10;

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
    hero.addEventListener('touchmove', function (e) {
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
      var dragStartPhase = 0;
      Observer.create({
        target: hero,
        type: 'touch,pointer',
        // Wheel is already handled above; tell Observer to ignore it
        // so it doesn't double-count.
        preventDefault: false,
        onDragStart: function () {
          if (!inCarouselBand) return;
          dragStartPhase = phase;
        },
        onDrag: function (self) {
          if (!inCarouselBand) return;
          // self.deltaX is total horizontal drag distance since start.
          // Drag right (positive) → tiles move right → phase grows.
          phase = dragStartPhase + self.deltaX * DRAG_SENSITIVITY / 1000;
        },
        // onLeft/onRight: discrete gestures (fling past threshold).
        // Add a small extra bump so flings keep momentum.
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