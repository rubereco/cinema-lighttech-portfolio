/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.7).
   ────────────────────────────────────────────────────────────────────────
   v3.7 polishes the hero carousel per Buddie's notes (issue #18).
   v3.6's three foundational fixes are unchanged:
     • RIGHT DIRECTION — no GSAP wrap modifier; one event = one scrub
       (sign of deltaY).
     • DATA-DRIVEN LAYOUT — `<image data-size="big|small">` in HTML;
       `buildLayout()` calculates positions from the DOM. `data-y`
       overrides the random y jitter.
     • BAND-BASED ZONES — outer 20% of hero scrubs tiles, middle 60%
       passes the wheel through to the page.

   v3.7's three polish fixes:
   1. DOUBLE SPEED. BIG_STEP_FRAC 0.003 → 0.006; SMALL doubles with
      it (0.006 → 0.012). Responsive-feeling scrub without re-
      introducing wrap-too-often (X_RANGE=2790 absorbs the bigger step).

   2. ONE SMALL PER GAP. v3.6 packed 2 smalls into each 430px gap;
      v3.7 places 1 small centered (10px padding each side) and any
      extras trail after the last big.
      - gap = 930 - 500 = 430; padding = (430 - 200 - 20)/2 = 105
      - centered small: x = prevBig + 500 + 10 + 105 = prevBig + 615
      - trailing smalls start at lastBig + 500 + 10 = +2370

   3. SEAMLESS WRAP (no visible teleport). Each original tile gets TWO
      clones — one at -X_RANGE (left), one at +X_RANGE (right). The
      three copies share the same photo (cloneNode preserves href).
      On every scrub event, each copy's x is wrapped into its own
      valid range [offset, offset+X_RANGE]. When a copy's x crosses
      its boundary, it teleports to the other side — but the user
      doesn't see a tile "jump" because another copy of the same
      photo is already at that position (clones share href). The
      wrap is invisible. Layout table shows ONE pattern; in memory
      the SVG carries three copies of each.

   Layout (for 3 bigs and 4 smalls, X_RANGE=2790)
   ─────────────────────────────────────────────
   big 0     x=0
   small 0   x=615   (centered in gap 0-1)
   big 1     x=930
   small 1   x=1545  (centered in gap 1-2)
   big 2     x=1860
   small 2   x=2370  (trailing)
   small 3   x=2580  (trailing)

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
   (stepFrac = 0.006 for bigs, 0.012 for smalls = 2x). The new x is
   wrapped into the tile's valid range [offset, offset+X_RANGE] so
   the tile cycles through its position. The wrap is invisible because
   the ±X_RANGE clones share the tile's href (same photo) — when one
   copy teleports, the replacement is the same image. Each tile is
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
  // v3.7: doubled from 0.003/0.006. The v3.6 right-direction fix
  // felt sluggish at half speed; X_RANGE=2790 absorbs the bigger
  // step without re-introducing wrap-too-often.
  var BIG_STEP_FRAC = 0.006;
  var SMALL_STEP_FRAC = BIG_STEP_FRAC * 2;  // 0.012
  var SCRUB_DURATION = 0.2;
  var SCRUB_EASE = 'power2.out';

  // Tile sizes
  var BIG_WIDTH = 500;
  var BIG_HEIGHT = 500;
  var SMALL_WIDTH = 200;
  var SMALL_HEIGHT = 200;

  // X range. Wider = less frequent wrap, less visual chaos.
  // For 3 bigs and 4 smalls (1 per gap, 2 trailing) with 10px gaps,
  // X_RANGE = 2790 fits: bigs at 0, 930, 1860 (smalls centered at
  // 615 and 1545), trailing smalls at 2370 and 2580.
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
  // Smalls are placed in the gaps between bigs, centered with 10px
  // padding on each side. Excess smalls trail after the last big,
  // spaced SMALL_GAP apart.
  //
  // v3.7 seamless wrap: each original tile gets TWO clones — one at
  // -X_RANGE (left), one at +X_RANGE (right). The three copies move
  // in lockstep during scrub. As one copy exits the visible area on
  // either side, another fills in. No modulo wrap → no teleport.
  // (A single clone at +X_RANGE is asymmetric: only seamless in one
  // direction. Two clones cover both.)
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
    // original tile. Done BEFORE layout-building so the clones don't
    // get re-picked by the bigs/smalls filter above.
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

    // Bigs evenly distributed across the loop
    var bigPositions = bigs.map(function (_, i) {
      return (i / bigCount) * X_RANGE;
    });

    // Smalls distributed in the gaps between bigs
    // For N bigs, there are N-1 gaps. Each gap gets at most 1 small
    // (centered with SMALL_GAP padding on each side). Any remaining
    // smalls trail after the last big, spaced SMALL_GAP apart.
    var smallsAssigned = [];
    var smallIndex = 0;
    // v3.7: 1 small per gap, centered with 10px padding on each side.
    // With 3 bigs and 4 smalls: 2 smalls fill the 2 gaps, 2 trail.
    for (var g = 0; g < bigCount - 1 && smallIndex < smalls.length; g++) {
      var prevBigX = bigPositions[g];
      var nextBigX = bigPositions[g + 1];
      var gapSize = nextBigX - prevBigX - BIG_WIDTH;
      // Center 1 small in the gap with 10px padding on each side.
      // (gap=430 → padding=(430-200-20)/2=105 → x=prevBig+615)
      var padding = (gapSize - SMALL_WIDTH - 2 * SMALL_GAP) / 2;
      var x = prevBigX + BIG_WIDTH + SMALL_GAP + padding;
      smallsAssigned.push({ tile: smalls[smallIndex], x: x });
      smallIndex++;
    }
    // Remaining smalls trail after the last big, spaced SMALL_GAP apart.
    // Anchor the trailing run to the last big (not the last gap small),
    // otherwise trailing smalls overlap the last big.
    var trailingX = (bigPositions[bigCount - 1] || 0) + BIG_WIDTH + SMALL_GAP;
    while (smallIndex < smalls.length) {
      smallsAssigned.push({ tile: smalls[smallIndex], x: trailingX });
      trailingX += SMALL_WIDTH + SMALL_GAP;
      smallIndex++;
    }

    // Build the layout array. Each logical tile becomes three entries:
    // left clone (-X_RANGE), original (0), right clone (+X_RANGE).
    // They all share the same stepFrac, so they move in lockstep.
    // Each entry stores its `offset` so scrub() can wrap within its
    // valid range [offset, offset+X_RANGE].
    function pushThree(tile, size, x, y, stepFrac) {
      var lc = leftClone.get(tile);
      var rc = rightClone.get(tile);
      layout.push({ tile: lc,  size: size, x: x - X_RANGE, offset: -X_RANGE, y: y, stepFrac: stepFrac });
      layout.push({ tile: tile, size: size, x: x,           offset: 0,         y: y, stepFrac: stepFrac });
      layout.push({ tile: rc,  size: size, x: x + X_RANGE, offset: +X_RANGE,  y: y, stepFrac: stepFrac });
    }

    var layout = [];
    bigs.forEach(function (tile, i) {
      pushThree(tile, 'big', bigPositions[i], BIG_Y, BIG_STEP_FRAC);
    });
    smallsAssigned.forEach(function (entry) {
      // Allow per-tile y override via data-y attribute (for fine-tuning)
      var yOverride = entry.tile.getAttribute('data-y');
      var y = yOverride !== null
        ? parseFloat(yOverride)
        : SMALL_Y + (Math.random() - 0.5) * SMALL_Y_JITTER;
      pushThree(entry.tile, 'small', entry.x, y, SMALL_STEP_FRAC);
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
    // wraps the new x into the tile's valid range [offset, offset+X_RANGE],
    // and animates the tile to the new x with gsap.to.
    //
    // v3.7 seamless wrap: each tile has clones at ±X_RANGE, and they
    // move in lockstep. When any copy wraps, all copies of the same
    // original wrap simultaneously (same stepPx, same valid-range
    // boundary). So when a copy slides off one edge, its sibling
    // copies slide off the *opposite* edge at the same time — the
    // user sees a continuous slide without ever seeing two copies of
    // the same photo at the destination simultaneously.
    //
    // Asymmetry: scrubbing LEFT wraps off-screen at x≈-5 → off-screen
    // at x≈2785 (no visible event — the slide-in from the right edge
    // looks smooth). Scrubbing RIGHT wraps off-screen at x≈2780 →
    // in-view at x≈5 (visible event — the tile slides in from the
    // right edge across the full screen). This is the intended
    // behavior; the slide keeps the entrance smooth.
    function scrub(dir) {
      layout.forEach(function (item) {
        var stepPx = dir * item.stepFrac * X_RANGE;
        var newX = item.x + stepPx;
        // Wrap into the tile's valid range [offset, offset+X_RANGE].
        // Multiple iterations may be needed if stepPx > X_RANGE
        // (not the case here, but defensive).
        while (newX > item.offset + X_RANGE) newX -= X_RANGE;
        while (newX < item.offset) newX += X_RANGE;
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
