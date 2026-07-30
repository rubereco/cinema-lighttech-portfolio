/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero.
   ────────────────────────────────────────────────────────────────────────
   Inspired by creativeocean's "Carousel w/ GSAP Observer" pen
   (https://codepen.io/creativeocean/pen/wvYoyrb). Adapts the pattern
   for a hero inside a longer page, with these adjustments:

     • Observer targets the hero section (not window) so wheel/touch/drag
       OUTSIDE the hero still scroll the page normally. Inside the hero,
       Observer captures the events and scrubs the tile timelines.
     • `preventDefault: true` on the Observer so the page doesn't scroll
       while the cursor is over the hero — that wheel energy goes to the
       carousel instead.
     • Text + CTAs live in HTML on top of the SVG (the CodePen has no
       text); the .hero-overlay dark gradient keeps them legible.

   Tile layout
   ───────────
   viewBox 0 0 1600 900 (16:9, matches the hero's typical aspect).
   • Row 1 (.hc-r1)  — 3 big tiles 500×500, y=200, clip-path #hc-cp1.
   • Row 2 (.hc-r2)  — 4 small tiles 200×200, y=random(200,450), clip #hc-cp2.
   • Each tile has its own GSAP timeline: fromTo({x:-500}, {x:4000}),
     paused, repeat:-1, eased: none, phased by i/total so tiles start
     distributed across the loop instead of stacked at x=-500.
   • Wheel/touch/drag scrubs every tile's progress by ±STEP, with
     `gsap.utils.wrap(0, 1, p)` so the loop continues forever.

   Reduced motion
   ──────────────
   If the user prefers reduced motion, we still position tiles in their
   initial layout (so the visual is composed) but skip the Observer
   entirely. The hero shows the tiles statically.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Progress increment per wheel/drag event. 0.012 = ~83 wheel events for
  // a full 0→1 loop. Combined with the gsap.to `back.out(5)` ease this
  // feels lively without being jittery.
  var STEP = 0.012;

  function positionTiles(stage) {
    var big = stage.querySelectorAll('.hc-r1 image');
    var small = stage.querySelectorAll('.hc-r2 image');

    // Set sizing + clip-path + preserveAspectRatio for ALL tiles at once.
    gsap.set(stage.querySelectorAll('image'), {
      attr: { preserveAspectRatio: 'xMidYMid slice' }
    });
    gsap.set(big, {
      attr: {
        width: '500',
        height: '500',
        'clip-path': 'url(#hc-cp1)'
      },
      y: 200
    });
    gsap.set(small, {
      attr: {
        width: '200',
        height: '200',
        'clip-path': 'url(#hc-cp2)'
      },
      y: function () { return gsap.utils.random(200, 450); }
    });

    return Array.prototype.slice.call(big).concat(Array.prototype.slice.call(small));
  }

  function buildTimelines(tiles) {
    // Each tile gets its own timeline, paused, repeat:-1, with x:-500 → 4000.
    // Phase by i/total so tiles are spread across the loop at t=0.
    var tls = [];
    var total = tiles.length;
    tiles.forEach(function (img, i) {
      var tl = gsap.timeline({
        defaults: { duration: 1, ease: 'none' },
        paused: true,
        repeat: -1
      });
      tl.fromTo(img, { x: -500 }, { x: 4000 });
      // Phase: progress(i/total) — tile 0 at 0/total, tile N at N/total.
      tl.progress(i / total);
      tls.push(tl);
    });
    return tls;
  }

  function scrub(tls, dir) {
    // dir = +1 (next/forward) or -1 (prev/backward).
    var sign = dir > 0 ? '+' : '-=';
    tls.forEach(function (tl) {
      gsap.to(tl, {
        progress: sign + STEP,
        modifiers: { progress: function (p) { return gsap.utils.wrap(0, 1, p); } },
        ease: 'back.out(5)',
        duration: 0.4,
        overwrite: 'auto'
      });
    });
  }

  function init() {
    var hero = document.getElementById('top');
    var stage = document.getElementById('hero-carousel-svg');
    if (!hero || !stage) return;
    if (typeof gsap === 'undefined') return;        // CDN failed
    if (typeof Observer === 'undefined') return;   // plugin missing

    var tiles = positionTiles(stage);
    if (!tiles.length) return;

    var tls = buildTimelines(tiles);

    // Reduced motion: tiles are positioned statically, no Observer.
    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Observer: capture wheel/touch/drag INSIDE the hero only.
    // preventDefault: true so the page doesn't scroll over the hero —
    // those wheel events go to the carousel instead.
    // onLeft / onRight = horizontal; onUp / onDown = vertical.
    // All four directions scrub; the user can drag or wheel any way.
    Observer.create({
      target: hero,
      type: 'wheel,touch,drag,pointer',
      preventDefault: true,
      onLeft: function () { scrub(tls, -1); },   // drag/wheel left → prev
      onRight: function () { scrub(tls, +1); },  // drag/wheel right → next
      onUp: function () { scrub(tls, -1); },     // wheel up → prev
      onDown: function () { scrub(tls, +1); }     // wheel down → next
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
