/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.6).
   ────────────────────────────────────────────────────────────────────────
   v3.6 fixes the "right movement is broken" bug and the
   "smalls not following the reference point" feedback. Three fixes:

   1. RIGHT DIRECTION (the main bug): the wrap was the culprit. When
      the user wheels/dragged right, the progress increased past 1.0
      and the wrap modifier teleported the tile from the right edge
      to the left. With back.out(5) overshooting and a tight X range,
      the wrap fired mid-burst and the user saw the tile "jump"
      while still in view — "wild" motion. Fix:
        - Smaller step (0.003 / 0.006, was 0.005 / 0.010). Less
          motion per event, gentler.
        - Wider X range (2790, was 3200 in v3.4 / 3500 in v3.5). Wrap
          is rarer.
        - No cumulative-deltaY. One event = one scrub. The sign of
          the current event determines the direction.
        - Wrap is now handled in JS (newX wrapped to [0, X_RANGE])
          instead of via a GSAP modifier. More predictable, no
          overshoot surprises.

   2. DATA-DRIVEN LAYOUT (maintainable). The photos are now a flat
      list of `<image href="..." data-size="big|small" />` in the
      HTML. The system reads the list and calculates the layout
      (positions, y, step) from the data-size attribute. Adding a
      new photo is just adding an `<image>` element. No JS edit
      needed. If a `data-y-jitter` attribute is set, that overrides
      the random jitter.

   3. ANCHORED PATTERN. Smalls are placed in the gaps between bigs
      with the "10px from the previous big AND 10px from the next
      big" reference point. For 3 bigs and 4 smalls, this gives
      2 smalls per gap (the gap is 430px, fits 2×(200+10)=420 with
      10px to spare). The math works out:
        - big spacing = 2790/3 = 930
        - gap = 930 - 500 = 430
        - 2 smalls per gap: small 0 at big+510, small 1 at big+720,
          10px before the next big.
      Smalls move at 2x the big speed (0.006 vs 0.003) and have
      a small y jitter (±15px) for visual variety.

   Layout (for 3 bigs and 4 smalls, X_RANGE=2790)
   ─────────────────────────────────────────────
   big 0     x=0
   small 0   x=510   (10px after big 0, gap 0-1)
   small 1   x=720   (10px after small 0, gap 0-1)
   big 1     x=930
   small 2   x=1440  (10px after big 1, gap 1-2)
   small 3   x=1650  (10px after small 2, gap 1-2)
   big 2     x=1860

   Scroll behavior (unchanged from v3.3)
   ────────────────────────────────────────
   • Cursor in LEFT or RIGHT band of the hero
       → wheel/touch/drag scrubs the tiles horizontally.
       → page does NOT scroll (event.preventDefault()).
   • Cursor in MIDDLE band of the hero
       → page scrolls normally. Carousel does NOT move.
   • Cursor OUTSIDE the hero
       → page scrolls normally.

   Per-tile motion
   ──────────────
   Each scrub event: tile.x changes by ±stepFrac * X_RANGE pixels
   (stepFrac = 0.003 for bigs, 0.006 for smalls = 2x). After the
   change, tile.x is wrapped to [0, X_RANGE] and the tile is
   animated to the new x with gsap.to (duration 0.2s, ease power2.out).

   Reduced motion
   ──────────────
   Tiles still position in their initial layout, but the wheel/touch
   listeners are skipped.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Per-tile scrub increments (as fraction of the loop).
  // Smalls move 2x as fast as bigs.
  var BIG_STEP_FRAC = 0.003;
  var SMALL_STEP_FRAC = BIG_STEP_FRAC * 2;  // 0.006
  var SCRUB_DURATION = 0.2;
  var SCRUB_EASE = 'power2.out';

  // Tile sizes
  var BIG_WIDTH = 500;
  var BIG_HEIGHT = 500;
  var SMALL_WIDTH = 200;
  var SMALL_HEIGHT = 200;

  // X range. Wider = less frequent wrap, less visual chaos.
  // For 3 bigs and 4 smalls (2 per gap) with 10px gaps, the minimum
  // X range is 2790 (bigs at 0, 930, 1860; gaps of 430 each, fitting
  // 2 smalls of 200px with 10px on each side).
  var X_RANGE = 2790;

  // Y positions
  var BIG_Y = 200;
  var SMALL_Y = 350;
  var SMALL_Y_JITTER = 15;  // ±15px variation for visual interest

  // Gap between smalls and bigs (10px)
  var SMALL_GAP = 10;

  // Carousel band: outer X% on each side of the hero.
  var BAND_FRACTION = 0.20;
  var BAND_MIN_PX = 100;

  // Set to true if your mouse's wheel is inverted (deltaY polarity
  // is the opposite of what we expect). E.g., some Linux distros
  // with "natural scrolling" enabled.
  var WHEEL_INVERTED = false;

  // === Build the layout from the SVG's <image> elements ===
  // Bigs are evenly distributed across the loop.
  // Smalls are placed in the gaps between bigs, with 10px gap from
  // each big. Multiple smalls per gap are placed 10px apart from
  // each other.
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

    // Bigs evenly distributed across the loop
    var bigPositions = bigs.map(function (_, i) {
      return (i / bigCount) * X_RANGE;
    });

    // Smalls distributed in the gaps between bigs
    // For N bigs, there are N-1 gaps. The smalls are placed in these
    // gaps with 10px gap from each big. Multiple smalls per gap are
    // placed 10px apart from each other.
    var smallsAssigned = [];
    var smallIndex = 0;
    for (var g = 0; g < bigCount - 1 && smallIndex < smalls.length; g++) {
      var prevBigX = bigPositions[g];
      var nextBigX = bigPositions[g + 1];
      var gapSize = nextBigX - prevBigX - BIG_WIDTH;
      // Number of smalls that fit in this gap with 10px gaps
      // (e.g., gap=430 → 2 smalls: 10+200+10+200+10 = 430)
      var maxInGap = Math.max(0, Math.floor((gapSize - SMALL_GAP) / (SMALL_WIDTH + SMALL_GAP)));
      for (var p = 0; p < maxInGap && smallIndex < smalls.length; p++) {
        var x = prevBigX + BIG_WIDTH + SMALL_GAP + p * (SMALL_WIDTH + SMALL_GAP);
        smallsAssigned.push({ tile: smalls[smallIndex], x: x });
        smallIndex++;
      }
    }
    // Any remaining smalls go after the last big (in the last gap or
    // at the end of the loop, depending on space).
    while (smallIndex < smalls.length) {
      var lastSmall = smallsAssigned.length > 0
        ? smallsAssigned[smallsAssigned.length - 1]
        : null;
      var lastX = lastSmall
        ? lastSmall.x + SMALL_WIDTH + SMALL_GAP
        : (bigPositions[bigCount - 1] || 0) + BIG_WIDTH + SMALL_GAP;
      smallsAssigned.push({ tile: smalls[smallIndex], x: lastX });
      smallIndex++;
    }

    // Build the layout array
    var layout = [];
    bigs.forEach(function (tile, i) {
      layout.push({
        tile: tile,
        size: 'big',
        x: bigPositions[i],
        y: BIG_Y,
        stepFrac: BIG_STEP_FRAC
      });
    });
    smallsAssigned.forEach(function (entry) {
      // Allow per-tile y override via data-y attribute (for fine-tuning)
      var yOverride = entry.tile.getAttribute('data-y');
      var y = yOverride !== null
        ? parseFloat(yOverride)
        : SMALL_Y + (Math.random() - 0.5) * SMALL_Y_JITTER;
      layout.push({
        tile: entry.tile,
        size: 'small',
        x: entry.x,
        y: y,
        stepFrac: SMALL_STEP_FRAC
      });
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

    // Build the layout from the photos in the SVG
    var layout = buildLayout(stage);
    if (!layout.length) return;

    // Set initial sizing + position for each tile
    gsap.set(stage.querySelectorAll('image'), {
      attr: { preserveAspectRatio: 'xMidYMid slice' }
    });
    layout.forEach(function (item) {
      if (item.size === 'big') {
        gsap.set(item.tile, {
          attr: { width: BIG_WIDTH, height: BIG_HEIGHT, 'clip-path': 'url(#hc-cp1)' },
          x: item.x,
          y: item.y
        });
      } else {
        gsap.set(item.tile, {
          attr: { width: SMALL_WIDTH, height: SMALL_HEIGHT, 'clip-path': 'url(#hc-cp2)', opacity: 0.9 },
          x: item.x,
          y: item.y
        });
      }
    });

    // Reduced motion: keep the visual composition, drop the interactivity.
    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

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

    // === Scrub function ===
    // Changes the x of each tile by ±stepFrac * X_RANGE pixels,
    // wraps the new x to [0, X_RANGE], and animates the tile to
    // the new x with gsap.to.
    function scrub(dir) {
      layout.forEach(function (item) {
        var stepPx = dir * item.stepFrac * X_RANGE;
        var newX = item.x + stepPx;
        // Wrap to [0, X_RANGE]
        while (newX > X_RANGE) newX -= X_RANGE;
        while (newX < 0) newX += X_RANGE;
        item.x = newX;
        gsap.to(item.tile, {
          x: newX,
          duration: SCRUB_DURATION,
          ease: SCRUB_EASE,
          overwrite: 'auto'
        });
      });
    }

    // === Wheel handler ===
    // v3.6: one call per event, no cumulative. The sign of the
    // current event's deltaY determines the direction. Smaller step
    // (0.003 / 0.006) and wider X range (2790) mean the motion is
    // gentler and the wrap is rarer than in v3.4/v3.5.
    function onWheel(e) {
      if (!inCarouselBand) return;
      e.preventDefault();
      var deltaY = readWheelDelta(e);
      if (WHEEL_INVERTED) deltaY = -deltaY;
      if (!deltaY) return;
      scrub(deltaY > 0 ? +1 : -1);
    }
    hero.addEventListener('wheel', onWheel, { passive: false });

    // === GSAP Observer (drag / touch gestures only) ===
    if (typeof Observer !== 'undefined') {
      Observer.create({
        target: hero,
        type: 'touch,drag,pointer',
        onLeft:  function () { if (inCarouselBand) scrub(-1); },
        onRight: function () { if (inCarouselBand) scrub(+1); }
      });
    }
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
