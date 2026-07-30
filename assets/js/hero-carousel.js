/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.1).
   ────────────────────────────────────────────────────────────────────────
   Inspired by creativeocean's "Carousel w/ GSAP Observer" pen
   (https://codepen.io/creativeocean/pen/wvYoyrb). v3.1 adds the band-
   based zone detection that v3 was missing: wheeling over the SIDES
   of the hero scrubs the carousel, wheeling over the MIDDLE scrolls
   the page.

   Layout
   ──────
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

    // ── Band-based zone detection ────────────────────────────────────
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

    // ── Observer ────────────────────────────────────────────────────
    // Note: NO `preventDefault: true` on the config. Events pass through
    // to the page by default. We conditionally preventDefault inside
    // `onWheel` ONLY when the cursor is in the carousel band.
    // The directional handlers (onLeft/Right/Up/Down) cover touch/drag/
    // keyboard arrow gestures and also check the band flag.
    Observer.create({
      target: hero,
      type: 'wheel,touch,drag,pointer',
      onWheel: function (self) {
        if (!inCarouselBand) return;
        self.event.preventDefault();
        scrub(tls, self.event.deltaY > 0 ? +1 : -1);
      },
      onLeft:  function () { if (inCarouselBand) scrub(tls, -1); },
      onRight: function () { if (inCarouselBand) scrub(tls, +1); },
      onUp:    function () { if (inCarouselBand) scrub(tls, -1); },
      onDown:  function () { if (inCarouselBand) scrub(tls, +1); }
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
