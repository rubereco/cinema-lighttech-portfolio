/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.2).
   ────────────────────────────────────────────────────────────────────────
   Inspired by creativeocean's "Carousel w/ GSAP Observer" pen
   (https://codepen.io/creativeocean/pen/wvYoyrb). v3.1 added the band-
   based zone detection. v3.2 fixes a mouse-wheel bug.

   v3.2 BUG FIX
   ────────────
   Buddie reported: "when scrolling the images go flying towards the
   left. i try to scroll the other way and its impossible they stay left."

   Root cause: GSAP Observer fires BOTH onWheel AND onUp/onDown for the
   SAME wheel event (the wheel's deltaY is interpreted as an up/down
   gesture direction by Observer). v3.1 had onUp:scrub(-1) and
   onDown:scrub(+1) on top of onWheel, so each wheel event was double-
   scrubbing. Depending on the mouse's deltaY sign convention, the
   directional handlers could DOMINATE over onWheel — and the directional
   default (onUp: LEFT) caused the tiles to drift left no matter which
   way the user scrolled.

   Fix:
   1. Removed onUp and onDown entirely. They're not needed for a
      horizontal carousel — vertical swipe gestures should scroll the
      page (natural behavior), not scrub the carousel.
   2. Use self.deltaY (GSAP-computed) with self.event.deltaY fallback.
   3. Guard against deltaY === 0 so phantom events (some mice send a
      0-delta event at the start of a wheel burst) don't push the
      tiles one direction.

   Layout (unchanged from v3.1)
   ────────────────────────────
   Outer 20% on each side of the hero (min 100px) = CAROUSEL band.
   Middle 60% of the hero = PAGE band (text + CTAs live here).
   The cursor changes to ew-resize in the carousel bands so the
   interactive zones are discoverable.

   Scroll behavior
   ───────────────
   • Cursor in LEFT or RIGHT band of the hero
       → wheel/touch/drag scrubs tile timelines horizontally.
       → page does NOT scroll (event.preventDefault()).
   • Cursor in MIDDLE band of the hero
       → page scrolls normally. Carousel does NOT move.
   • Cursor OUTSIDE the hero
       → page scrolls normally.

   Per-tile timeline
   ─────────────────
   Each tile has its own GSAP timeline, paused, repeat:-1, traveling
   x:-500 → x:4000 (4500px range), phased by i/total so tiles start
   distributed across the loop. Wheel events scrub every tile's
   progress by ±step with `back.out(5)` ease and `gsap.utils.wrap`
   so the loop continues forever.

   Per-tile step
   ─────────────
   Matches the CodePen's pattern: big tiles scrub LESS per event
   (BIG_STEP = 0.005), small tiles scrub MORE (SMALL_STEP = 0.010).
   The per-tile variation makes the motion feel less mechanical.
   These are HALF of the CodePen's values (0.01/0.02) for a more
   measured, cinematic pace.

   Reduced motion
   ──────────────
   Tiles still position in their initial layout, but the Observer
   and the band listeners are skipped. The hero shows the
   composition statically and the page scrolls normally.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Per-tile scrub increments. Big tiles move less per wheel event than
  // smalls — matches the CodePen's ratio (0.01 big / 0.02 small), halved
  // for a more cinematic feel. ~100 wheel events for a full big-tile loop.
  var BIG_STEP = 0.005;
  var SMALL_STEP = 0.010;

  // Carousel band: outer X% on each side of the hero. Middle (1-2X)% is
  // the page band. Min width keeps narrow viewports usable.
  var BAND_FRACTION = 0.20;
  var BAND_MIN_PX = 100;

  function positionTiles(stage) {
    var big = stage.querySelectorAll('.hc-r1 image');
    var small = stage.querySelectorAll('.hc-r2 image');

    gsap.set(stage.querySelectorAll('image'), {
      attr: { preserveAspectRatio: 'xMidYMid slice' }
    });
    gsap.set(big, {
      attr: { width: '500', height: '500', 'clip-path': 'url(#hc-cp1)' },
      y: 200
    });
    gsap.set(small, {
      attr: { width: '200', height: '200', 'clip-path': 'url(#hc-cp2)' },
      y: function () { return gsap.utils.random(200, 450); }
    });

    return Array.prototype.slice.call(big).concat(Array.prototype.slice.call(small));
  }

  function buildTimelines(tiles) {
    var tls = [];
    var total = tiles.length;
    tiles.forEach(function (img, i) {
      var tl = gsap.timeline({
        defaults: { duration: 1, ease: 'none' },
        paused: true,
        repeat: -1
      });
      tl.fromTo(img, { x: -500 }, { x: 4000 });
      tl.progress(i / total);
      tls.push(tl);
    });
    return tls;
  }

  function scrub(tls, dir) {
    // dir = +1 (next/forward) or -1 (prev/backward).
    // Per-tile step: first 3 tiles are big (slower), rest are small (faster).
    var sign = dir > 0 ? '+' : '-=';
    tls.forEach(function (tl, i) {
      var step = i < 3 ? BIG_STEP : SMALL_STEP;
      gsap.to(tl, {
        progress: sign + step,
        modifiers: { progress: function (p) { return gsap.utils.wrap(0, 1, p); } },
        ease: 'back.out(5)',
        duration: 0.5
        // overwrite defaults to false — matching the CodePen.
        // Rapid wheel events stack their `+0.005` increments on the
        // current progress; the wrap modifier keeps it in [0, 1].
      });
    });
  }

  function isInCarouselBand(hero, clientX, clientY) {
    var rect = hero.getBoundingClientRect();
    if (clientY < rect.top || clientY > rect.bottom) return false;
    var bandWidth = Math.max(BAND_MIN_PX, rect.width * BAND_FRACTION);
    var x = clientX - rect.left;
    return x < bandWidth || x > (rect.width - bandWidth);
  }

  function init() {
    var hero = document.getElementById('top');
    var stage = document.getElementById('hero-carousel-svg');
    if (!hero || !stage) return;
    if (typeof gsap === 'undefined') return;
    if (typeof Observer === 'undefined') return;

    var tiles = positionTiles(stage);
    if (!tiles.length) return;
    var tls = buildTimelines(tiles);

    // Reduced motion: keep the visual composition, drop the interactivity.
    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // ── Band-based zone detection ────────────────────────────────
    // inCarouselBand flips true when the cursor (or touch) is in the
    // outer 20% of the hero on either side, false when it's in the
    // middle. Observer handlers check this flag to decide whether to
    // scrub the carousel (band) or pass through to page scroll (middle).
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
    // Touch: track the first touch point.
    hero.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches[0]) {
        updateBand(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    hero.addEventListener('touchend', leaveBand);
    hero.addEventListener('touchcancel', leaveBand);

    // ── Observer ────────────────────────────────────────────────
    // No `preventDefault: true` on the config — events pass through to
    // the page by default. We conditionally preventDefault inside
    // `onWheel` ONLY when the cursor is in the carousel band.
    //
    // v3.2: REMOVED onUp and onDown. They were firing alongside onWheel
    // for the same wheel event (GSAP treats wheel deltaY as an up/down
    // gesture direction). The double-scrub caused the tiles to drift
    // left on Buddie's mouse regardless of wheel direction. For a
    // horizontal carousel, vertical swipes should scroll the page, not
    // the carousel — that's the natural behavior on touch devices too.
    Observer.create({
      target: hero,
      type: 'wheel,touch,drag,pointer',
      onWheel: function (self) {
        if (!inCarouselBand) return;
        // Use GSAP-computed self.deltaY with the raw event's deltaY as
        // a fallback. Guard against 0 so phantom events (some mice send
        // a 0-delta first event) don't push the tiles.
        var deltaY = (self.deltaY !== undefined) ? self.deltaY
                    : (self.event && self.event.deltaY);
        if (!deltaY) return;
        self.event.preventDefault();
        scrub(tls, deltaY > 0 ? +1 : -1);
      },
      onLeft:  function () { if (inCarouselBand) scrub(tls, -1); },
      onRight: function () { if (inCarouselBand) scrub(tls, +1); }
      // onUp / onDown intentionally omitted. See v3.2 BUG FIX note above.
    });
  }

  function boot() {
    // GSAP and Observer load asynchronously via <script defer>. If either
    // isn't ready yet, wait a tick and try again.
    if (typeof gsap === 'undefined' || typeof Observer === 'undefined') {
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
