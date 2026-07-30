/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — mouse-move parallax on the hero SVG carousel.
   ────────────────────────────────────────────────────────────────────────
   Why this exists
   ────────────────
   The hero has an SVG carousel layer (7 BTS photos as 2 rows of clipped
   tiles). We want the tiles to drift slightly with the cursor — a subtle
   parallax effect that responds to the user without hijacking the page.

   Why mouse-move instead of wheel/touch/drag (the original code's idea)
   ────────────────────────────────────────────────────────────────────────
   Wheel/touch/drag capture would steal page scroll while the cursor is
   over the hero. On a portfolio where visitors scroll into the page,
   that's a footgun. Mouse-move keeps scroll working normally.

   How it works
   ────────────
   1. On init, place tiles at staggered base positions via GSAP `set()`,
      remembering each tile's baseX/baseY and a "depth" multiplier.
   2. On `mousemove` over `.hero`, RAF-throttle and shift each tile by
      `(cursor - center) * depth`. r1 tiles move less (depth 25), r2
      tiles move more (depth 55) — closer tiles move more, classic
      parallax.
   3. On `mouseleave`, ease every tile back to its base position.

   Reduced-motion
   ──────────────
   The whole effect is gated by `prefers-reduced-motion: reduce`. If the
   user opts out, we still position the tiles for a nice static layout
   but skip the mousemove listener entirely.
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  function init() {
    var hero = document.querySelector('.hero');
    var carousel = document.querySelector('.hero-carousel');
    var svg = document.getElementById('hero-carousel-svg');
    if (!hero || !carousel || !svg) return;
    if (typeof gsap === 'undefined') return; // GSAP CDN failed; bail silently

    var r1 = Array.prototype.slice.call(svg.querySelectorAll('.hc-row-1 image'));
    var r2 = Array.prototype.slice.call(svg.querySelectorAll('.hc-row-2 image'));
    var allTiles = r1.concat(r2);

    // SVG attribute defaults — width/height/clip-path/preserveAspectRatio
    // are set as attributes (not CSS) because GSAP's attr{} tween reads
    // SVG attributes natively.
    gsap.set('.hc-row-1 image', {
      attr: {
        width: 380,
        height: 380,
        'clip-path': 'url(#hc-cp1)',
        preserveAspectRatio: 'xMidYMid slice'
      }
    });
    gsap.set('.hc-row-2 image', {
      attr: {
        width: 220,
        height: 220,
        'clip-path': 'url(#hc-cp2)',
        preserveAspectRatio: 'xMidYMid slice'
      }
    });

    // Staggered base positions across the SVG viewBox (1600 × 900).
    // r1 has 4 tiles: spread across, slight vertical jitter for visual
    // interest. r2 has 3 tiles: lower band, wider horizontal jitter.
    r1.forEach(function (img, i) {
      var x = 40 + i * 410;                  // 4 tiles across
      var y = 30 + (i % 2 === 0 ? 0 : 50);   // zigzag vertical
      gsap.set(img, { x: x, y: y });
      img.dataset.baseX = String(x);
      img.dataset.baseY = String(y);
      img.dataset.depth = '25';
    });

    r2.forEach(function (img, i) {
      var x = 220 + i * 420;
      var y = 540 + (i * 35);
      gsap.set(img, { x: x, y: y });
      img.dataset.baseX = String(x);
      img.dataset.baseY = String(y);
      img.dataset.depth = '55';
    });

    // Reduced-motion users see the staggered layout but no parallax.
    var prefersReduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;

    // Mouse-move parallax. RAF-throttled so we never compute more than
    // once per frame, regardless of how many mousemove events fire.
    var rafId = null;

    hero.addEventListener('mousemove', function (e) {
      if (rafId) return;
      rafId = requestAnimationFrame(function () {
        var rect = hero.getBoundingClientRect();
        var nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;   // -1..+1
        var ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

        allTiles.forEach(function (tile) {
          var depth = parseFloat(tile.dataset.depth);
          var baseX = parseFloat(tile.dataset.baseX);
          var baseY = parseFloat(tile.dataset.baseY);
          gsap.to(tile, {
            x: baseX + nx * depth,
            y: baseY + ny * depth * 0.4,
            duration: 0.7,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        });
        rafId = null;
      });
    });

    hero.addEventListener('mouseleave', function () {
      allTiles.forEach(function (tile) {
        var baseX = parseFloat(tile.dataset.baseX);
        var baseY = parseFloat(tile.dataset.baseY);
        gsap.to(tile, {
          x: baseX,
          y: baseY,
          duration: 1.0,
          ease: 'power3.out',
          overwrite: 'auto'
        });
      });
    });
  }

  // Wait for both DOM and the GSAP CDN script to be ready. GSAP is loaded
  // with `defer`, so it runs in document order — but we still guard in
  // case the CDN is slow or blocked.
  function boot() {
    if (typeof gsap === 'undefined') {
      // Try one more time after a short delay; if still no GSAP, give up.
      setTimeout(function () {
        if (typeof gsap !== 'undefined') init();
      }, 300);
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