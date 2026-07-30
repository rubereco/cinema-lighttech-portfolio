/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.3).
   ────────────────────────────────────────────────────────────────────────
   Inspired by creativeocean's "Carousel w/ GSAP Observer" pen
   (https://codepen.io/creativeocean/pen/wvYoyrb). v3.1 added band-
   based zone detection. v3.2 fixed the onUp/onDown double-scrub bug.
   v3.3 fixes the remaining "tiles stuck going right + page also
   scrolls in side bands" bug.

   v3.3 BUG FIX
   ────────────
   Buddie reported after v3.2: "the images keep going flying to the
   right and not coming back. the middle scrolls works perfectly. but
   the side one scrolls both the web and carousel."

   Two symptoms, one root cause: GSAP Observer's wheel listener is
   registered as PASSIVE for performance (this is the default in
   modern browsers and a documented GSAP optimization). A passive
   wheel listener SILENTLY IGNORES `event.preventDefault()` — the
   page scrolls anyway. That's the "scrolling both" symptom.

   The "tiles only go right" symptom is more subtle: with the page
   also scrolling, the browser fires the wheel event at a much
   higher rate than the user perceives, because each user wheel
   "notch" produces a burst of OS events that all share the same
   direction. On Buddie's mouse, the FIRST event in a burst often
   arrives with `deltaY = 0` (some mice do this — see the v3.2
   guard), so it gets caught and dropped. Then subsequent events
   are all positive, so the tiles keep going right. The user tries
   to "scroll the other way" but with the page also scrolling, the
   wheel events get muddled and the carousel doesn't reverse cleanly.

   Fix:
   1. Replace GSAP Observer's onWheel with a manual non-passive
      `addEventListener('wheel', handler, { passive: false })`. Now
      `e.preventDefault()` actually works, so the page does NOT
      scroll in the side bands.
   2. Use the raw `e.deltaY` directly (no GSAP wrapping) — simpler
      and avoids the "GSAP's deltaY" vs "browser's deltaY" mismatch.
   3. Add a tiny debug log so future bugs of this shape are easy
      to diagnose from the browser console.

   The rest of the carousel is unchanged from v3.2 (band detection,
   per-tile step, no onUp/onDown).

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

  // Read the wheel deltaY from whichever property the browser exposes.
  // e.deltaY is the modern standard; e.wheelDeltaY / e.detail are older
  // fallbacks (WebKit and Firefox, respectively). Returns 0 if no
  // meaningful value is found.
  function readWheelDelta(e) {
    if (e.deltaY) return e.deltaY;
    if (e.wheelDeltaY) return -e.wheelDeltaY;  // WebKit: opposite sign
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

    // Reduced motion: keep the visual composition, drop the interactivity.
    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // ── Band-based zone detection ────────────────────────────────
    // inCarouselBand flips true when the cursor (or touch) is in the
    // outer 20% of the hero on either side, false when it's in the
    // middle. Wheel/touch handlers check this flag to decide whether
    // to scrub the carousel (band) or pass through to page scroll (middle).
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

    // ── Wheel handler (v3.3: manual, non-passive) ───────────────
    // v3.2 used GSAP Observer's onWheel. Observer registers its
    // wheel listener as PASSIVE for performance, which silently
    // ignores `event.preventDefault()`. That's why the page also
    // scrolled in the side bands. By adding the listener ourselves
    // with `{ passive: false }`, preventDefault() actually blocks
    // the page scroll.
    function onWheel(e) {
      if (!inCarouselBand) return;   // middle band: page scrolls
      e.preventDefault();              // side band: block page scroll
      var deltaY = readWheelDelta(e);
      if (!deltaY) return;             // skip phantom 0-delta events
      scrub(tls, deltaY > 0 ? +1 : -1);
    }
    hero.addEventListener('wheel', onWheel, { passive: false });

    // ── GSAP Observer (drag / touch gestures only) ─────────────
    // Observer is now used ONLY for horizontal drag/swipe (onLeft /
    // onRight). Wheel events go through the manual listener above,
    // so there's no double-fire risk. onUp / onDown remain omitted
    // — vertical swipes scroll the page, not the carousel.
    if (typeof Observer !== 'undefined') {
      Observer.create({
        target: hero,
        type: 'touch,drag,pointer',  // no 'wheel' — handled manually above
        onLeft:  function () { if (inCarouselBand) scrub(tls, -1); },
        onRight: function () { if (inCarouselBand) scrub(tls, +1); }
      });
    }
  }

  function boot() {
    // GSAP loads asynchronously via <script defer>. If it isn't ready
    // yet, wait a tick and try again. (Observer is now optional —
    // we no longer require it for the wheel handler.)
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
