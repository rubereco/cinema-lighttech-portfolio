/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — scroll-linked sideways parallax for the hero side panels.
   ────────────────────────────────────────────────────────────────────────
   How it works
   ────────────
   The hero is split into three vertical regions:
     • LEFT side panel  — SVG with BTS tiles, scrolls LEFT as page scrolls
     • MIDDLE           — text + EVF portrait, scrolls normally with page
     • RIGHT side panel — SVG with BTS tiles, scrolls RIGHT as page scrolls

   The LEFT strip and RIGHT strip both start at their initial x-position
   (the staggered layout baked into the SVG). On each scroll event we
   translate them horizontally based on `window.scrollY`. The page's
   vertical scroll is untouched — this is pure scroll-linked animation, not
   event capture. Wheel over the middle still scrolls the page exactly as
   it always has.

   Why scroll-linked, not wheel-capture or mouse-move
   ──────────────────────────────────────────────────
   Wheel/touch/drag capture would steal page scroll over the entire hero,
   so visitors couldn't scroll into the page without moving their cursor
   off the hero. Mouse-move parallax is subtle but doesn't match the
   "one big image at a time scrolling sideways" effect the user wanted.
   Scroll-linked gives both: the tiles respond visibly to scroll, AND the
   page scrolls normally everywhere.

   Tile layout
   ───────────
   Tiles are positioned in the SVG viewBox (1800 × 1800) using GSAP `set`
   during init. Each `<image>` carries clip-path + width/height attributes
   via `attr{}`. The strip is the parent `<g class="hl-strip">` /
   `<g class="hr-strip">` — we translate the strip as a whole.

   Reduced motion
   ──────────────
   If `prefers-reduced-motion: reduce` matches, we still position tiles
   in their initial layout but skip the scroll listener entirely. The
   hero shows the staggered tile pattern statically.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Speed at which tiles translate per pixel of page scroll.
  // 0.5 means a 1000-pixel page scroll shifts tiles by 500px sideways.
  // Tuned to feel responsive without being disorienting.
  var SCROLL_SPEED = 0.55;

  function init() {
    var leftStrip = document.querySelector('.hero-side-left .hl-strip');
    var rightStrip = document.querySelector('.hero-side-right .hr-strip');
    if (!leftStrip || !rightStrip) return;
    if (typeof gsap === 'undefined') return; // GSAP CDN failed; bail silently

    // ─── Left panel tile positions ───────────────────────────────────
    // Row 1: 3 big tiles spread across the strip (top quarter).
    // Row 2: 1 small tile in the gap between big tiles (lower third).
    var leftRow1 = leftStrip.querySelectorAll('.hl-row-1 image');
    var leftRow2 = leftStrip.querySelectorAll('.hl-row-2 image');

    gsap.set(leftRow1, {
      attr: {
        width: 240,
        height: 240,
        'clip-path': 'url(#hl-cp1)',
        preserveAspectRatio: 'xMidYMid slice'
      }
    });
    gsap.set(leftRow2, {
      attr: {
        width: 160,
        height: 160,
        'clip-path': 'url(#hl-cp2)',
        preserveAspectRatio: 'xMidYMid slice'
      }
    });

    // Stagger: tile-1, tile-2, tile-3 on the top row with small y jitter.
    leftRow1.forEach(function (img, i) {
      gsap.set(img, { x: 300 + i * 600, y: 120 + (i % 2 === 0 ? 0 : 80) });
    });
    // Tile-4 (small) in the gap between tile-1 and tile-2.
    leftRow2.forEach(function (img, i) {
      gsap.set(img, { x: 620 + i * 480, y: 1180 + (i * 40) });
    });

    // ─── Right panel tile positions ──────────────────────────────────
    var rightRow1 = rightStrip.querySelectorAll('.hr-row-1 image');
    var rightRow2 = rightStrip.querySelectorAll('.hr-row-2 image');

    gsap.set(rightRow1, {
      attr: {
        width: 240,
        height: 240,
        'clip-path': 'url(#hr-cp1)',
        preserveAspectRatio: 'xMidYMid slice'
      }
    });
    gsap.set(rightRow2, {
      attr: {
        width: 160,
        height: 160,
        'clip-path': 'url(#hr-cp2)',
        preserveAspectRatio: 'xMidYMid slice'
      }
    });

    // 2 big tiles on the right row.
    rightRow1.forEach(function (img, i) {
      gsap.set(img, { x: 300 + i * 600, y: 100 + (i % 2 === 0 ? 0 : 60) });
    });
    // 1 small tile in the gap between big tiles.
    rightRow2.forEach(function (img, i) {
      gsap.set(img, { x: 540 + i * 480, y: 1180 });
    });

    // ─── Reduced-motion guard ────────────────────────────────────────
    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // ─── Scroll-linked animation ─────────────────────────────────────
    // On scroll, translate LEFT strip leftward and RIGHT strip rightward.
    // RAF-throttled so we never compute more than once per frame.
    var rafId = null;
    var lastScrollY = -1;

    function update() {
      var scrollY = window.scrollY || window.pageYOffset || 0;
      if (scrollY === lastScrollY) { rafId = null; return; }
      lastScrollY = scrollY;

      var offset = scrollY * SCROLL_SPEED;
      gsap.set(leftStrip,  { x: -offset });
      gsap.set(rightStrip, { x:  offset });
      rafId = null;
    }

    function onScroll() {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    // Apply the current scroll position immediately on init so the hero
    // doesn't "snap" if the user reloads partway down the page.
    update();
  }

  function boot() {
    if (typeof gsap === 'undefined') {
      setTimeout(function () { if (typeof gsap !== 'undefined') init(); }, 300);
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
