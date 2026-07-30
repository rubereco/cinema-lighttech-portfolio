/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.4).
   ────────────────────────────────────────────────────────────────────────
   Inspired by creativeocean's "Carousel w/ GSAP Observer" pen
   (https://codepen.io/creativeocean/pen/wvYoyrb). v3.4 addresses the
   "tiles only go right / don't recycle" bug Buddie reported after v3.3.

   v3.4 BUG FIX
   ────────────
   Buddie reported after v3.3: "the scroll now is good. but the carousel
   scroll its still bad, it only works parcially when im holding the
   side and moving my moues super slow, if i move my mouse normal or
   scroll the images go to the right and worse case the images don't
   recycle its one way trip."

   Two symptoms:

   (1) DIRECTION. On slow movement the carousel works (both ways);
       on fast movement or normal scroll, the tiles only go right
       and don't come back. Root cause: GSAP Observer / browsers
       coalesce rapid wheel events. On a high-resolution trackpad,
       each user "gesture" produces a burst of 5–20 wheel events.
       Some of those events have deltaY = 0 (caught by v3.2's
       guard, so no scrub). The surviving events all have the
       SAME sign (the browser coalesces directional bursts), so
       the carousel drifts one direction. The user can't reverse
       because the negative-direction events either don't fire or
       are the ones being dropped.

       Fix: accumulate deltaY over a DIRECTION_WINDOW_MS window
       (default 80ms). The first non-zero deltaY in a burst starts
       a new window; subsequent deltas (including 0 — but those
       are still ignored) add to the cumulative. The sign of the
       CUMULATIVE determines the direction. This survives the burst
       coalescing and the dropped events.

   (2) RECYCLE. The wrap IS happening (modifier `wrap(0,1,p)` is
       correct), but the wrap point is at x = 4000 → x = -500,
       which is OFF-SCREEN on both sides. The user never sees the
       recycle — they only see tiles entering from the left.
       Combined with the direction bug, it feels like a one-way
       trip.

       Fix: tighten the x range from -500→4000 to 0→3200. Big
       tiles are now visible for 50% of the loop (was 36%) and
       the wrap happens at x=3200 (just past the right edge) to
       x=0 (left edge) — both visible, so the user sees the tile
       reappear at the left edge.

   Plus a one-time console.log so Buddie can confirm what values
   are coming through if it still doesn't work.

   Layout (unchanged from v3.1)
   ────────────────────────────
   Outer 20% on each side of the hero (min 100px) = CAROUSEL band.
   Middle 60% of the hero = PAGE band (text + CTAs live here).
   The cursor changes to ew-resize in the carousel bands.

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
   x:0 → x:3200 (v3.4 tightened from x:-500 → x:4000), phased by
   i/total so tiles start distributed across the loop.

   Per-tile step
   ─────────────
   Matches the CodePen's pattern: big tiles scrub LESS per event
   (BIG_STEP = 0.005), small tiles scrub MORE (SMALL_STEP = 0.010).

   Reduced motion
   ──────────────
   Tiles still position in their initial layout, but the wheel/touch
   listeners are skipped. The hero shows the composition statically
   and the page scrolls normally.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Per-tile scrub increments. Big tiles move less per wheel event than
  // smalls — matches the CodePen's ratio (0.01 big / 0.02 small), halved
  // for a more cinematic feel.
  var BIG_STEP = 0.005;
  var SMALL_STEP = 0.010;

  // v3.4: tile x range. Tightened from -500..4000 to 0..3200 so the
  // wrap is closer to the visible area (visible is 0..1600 in viewBox
  // units). Big tiles visible for 50% of the loop, small 56%.
  var X_MIN = 0;
  var X_MAX = 3200;
  var X_RANGE = X_MAX - X_MIN;

  // Carousel band: outer X% on each side of the hero.
  var BAND_FRACTION = 0.20;
  var BAND_MIN_PX = 100;

  // v3.4: direction-detection window. We accumulate deltaY over this
  // many ms to survive wheel-event coalescing. ~5–20 events per
  // user gesture on high-res trackpads.
  var DIRECTION_WINDOW_MS = 80;

  // v3.4: set to true if your mouse's wheel is inverted (deltaY
  // polarity is the opposite of what we expect). E.g., some
  // Linux distros with "natural scrolling" enabled.
  var WHEEL_INVERTED = false;

  // v3.4: debug log. Set to true to see what deltaY values are
  // coming through. Helps diagnose direction issues. One-time
  // log so the console doesn't fill up.
  var DEBUG_LOG = true;
  var debugLogged = 0;

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
      tl.fromTo(img, { x: X_MIN }, { x: X_MAX });
      tl.progress(i / total);
      tls.push(tl);
    });
    return tls;
  }

  function scrub(tls, dir) {
    var sign = dir > 0 ? '+' : '-=';
    tls.forEach(function (tl, i) {
      var step = i < 3 ? BIG_STEP : SMALL_STEP;
      gsap.to(tl, {
        progress: sign + step,
        modifiers: { progress: function (p) { return gsap.utils.wrap(0, 1, p); } },
        ease: 'back.out(5)',
        duration: 0.5
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

    var tiles = positionTiles(stage);
    if (!tiles.length) return;
    var tls = buildTimelines(tiles);

    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // ── Band-based zone detection ────────────────────────────────
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

    // ── Wheel handler (v3.4: cumulative-deltaY for direction) ───
    // The previous version used the sign of the current event's
    // deltaY to determine the direction. On a rapid wheel burst,
    // some events have deltaY=0 (caught by the guard) and the
    // surviving events often all have the same sign (browser
    // coalescing). Result: carousel only goes one direction.
    //
    // v3.4 fix: accumulate deltaY over DIRECTION_WINDOW_MS. The
    // sign of the cumulative determines the direction. This
    // survives event coalescing because we sum everything in the
    // burst before deciding.
    var recentDeltaY = 0;
    var lastWheelTime = 0;

    function onWheel(e) {
      if (!inCarouselBand) return;
      e.preventDefault();

      var deltaY = readWheelDelta(e);
      if (WHEEL_INVERTED) deltaY = -deltaY;

      // v3.4 debug: log the first few deltaY values so Buddie can
      // confirm what values are coming through if direction is wrong.
      if (DEBUG_LOG && debugLogged < 5 && deltaY) {
        console.log('[hero-carousel] wheel deltaY=' + deltaY +
                    ' inBand=' + inCarouselBand +
                    ' recentDeltaY=' + recentDeltaY);
        debugLogged++;
      }

      if (!deltaY) return;  // skip 0-delta phantom events

      var now = (typeof performance !== 'undefined' && performance.now)
                ? performance.now() : Date.now();
      if (now - lastWheelTime > DIRECTION_WINDOW_MS) {
        // First event in a new burst — reset the cumulative.
        recentDeltaY = 0;
      }
      lastWheelTime = now;
      recentDeltaY += deltaY;

      // Use the SIGN of the cumulative (over the window) to decide
      // the direction. This is robust to event coalescing and
      // dropped events.
      scrub(tls, recentDeltaY > 0 ? +1 : -1);
    }
    hero.addEventListener('wheel', onWheel, { passive: false });

    // ── GSAP Observer (drag / touch gestures only) ─────────────
    if (typeof Observer !== 'undefined') {
      Observer.create({
        target: hero,
        type: 'touch,drag,pointer',
        onLeft:  function () { if (inCarouselBand) scrub(tls, -1); },
        onRight: function () { if (inCarouselBand) scrub(tls, +1); }
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
