/* ════════════════════════════════════════════════════════════════════════
   hero-carousel.js — CodePen-style carousel for the hero (v3.10.1).
   ────────────────────────────────────────────────────────────────────────
   v3.9.3 → v3.10 → v3.10.1 (Buddie: "add the carousel to the
   mobile version"):

   v3.9.3 ran the carousel on desktop only — on mobile (≤767px) the
   CSS hid the SVG and the hero got a static background image
   (hero-forest.jpg) instead. v3.10 tried a 2/3 split layout
   (carousel top, text content bottom), but Buddie pushed back:
   "the front text is like splitted of the carousel it looks so
   bad". v3.10.1 reverts to the same layout as desktop — carousel
   fills the full hero, text content is overlaid on top (centered,
   with the dark gradient for legibility). The split is gone.

   What v3.10 still keeps (the useful parts):
   • SCALE = 0.4 on mobile. Every layout constant (BIG_WIDTH,
     BIG_SPACING, SMALL_WIDTH, BIG_Y, SMALL_Y_MIN/MAX,
     INITIAL_OFFSET, WRAP_MARGIN, SMALL_X_OFFSET_RANGE) is
     multiplied by SCALE so bigs come out at 200×200, smalls at
     80×80, spacing 360, etc. Without scaling, the tiles would
     be off-screen on a 375-wide phone (the slice-cropped visible
     region in the 1600-wide viewBox is only ~625 SVG units).
   • INITIAL_OFFSET is recomputed dynamically on mobile to center
     the scaled tile span at x=800. Desktop keeps the v3.9.3 value.
   • setupClipPaths() recreates the <defs><clipPath> elements at
     runtime with the SCALED sizes (and proportional rx), so
     mobile tiles still have rounded corners. The HTML keeps the
     desktop-size clip-paths as a no-JS fallback.
   • The 'if (window.innerWidth < MOBILE_MAX_WIDTH) return;' skip
     in init() is removed — the carousel now runs on every viewport.

   What v3.10.1 removes (the parts that broke the UX):
   • The .hero flex column layout on mobile (carousel top 2/3,
     content bottom 1/3). The split felt disjointed.
   • The inCarouselArea touch gate. It was meant to keep the
     bottom-1/3 CTAs tappable, but since the split is gone the
     carousel is the full hero and the gate was just blocking
     drags everywhere on mobile. Buddie: "when i dragg it with
     the mouse it doesn't even move". Now drags work anywhere in
     the hero; CTAs still work because taps (no drag) don't fire
     onDrag, so the click reaches the link.

   What stayed the same (still true from v3.8):
   • Phase-based scrub (global phase, lerped to currentPhase).
   • Band-based wheel zones (outer 20% scrubs, middle 60% scrolls
     the page). On mobile the wheel rarely fires, so this is
     effectively a desktop-only behavior.
   • Data-driven layout: `<image data-size="big|small">` in HTML.
   • Seamless wrap: each tile gets two clones (±X_RANGE).
   ════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  // Mobile breakpoint: below this width the layout switches to a
  // mobile-optimized version (smaller tile scale, flex column hero,
  // touch events restricted to the top 2/3). v3.10+: the carousel
  // runs on mobile too, so this is the scale-toggle point, not a
  // "skip the carousel" gate.
  var MOBILE_MAX_WIDTH = 768;

  // Detect mobile once at module load. SCALE shrinks the whole tile
  // layout (BIG_WIDTH, BIG_SPACING, SMALL_WIDTH, etc.) so the tiles
  // fit the narrow visible region on a 375-wide phone viewport
  // (~625 SVG units after the 1600-wide viewBox is slice-cropped).
  // 0.4 = bigs come out at 200×200, smalls at 80×80, spacing 360 —
  // 1.5–2 bigs visible at load, the rest come in via touch-scroll.
  var isMobile = window.innerWidth < MOBILE_MAX_WIDTH;
  var SCALE = isMobile ? 0.4 : 1.0;

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

  // ── Layout constants (scaled by SCALE for mobile) ────────────
  var BIG_WIDTH = 500 * SCALE;
  var BIG_HEIGHT = 500 * SCALE;
  var SMALL_WIDTH = 200 * SCALE;
  var SMALL_HEIGHT = 200 * SCALE;

  // Big spacing. The original v3.5+ layout had gaps between bigs
  // (BIG_SPACING = 900) so smalls could fit in the gaps. v3.9 tried
  // BIG_SPACING = BIG_WIDTH = 500 (bigs abutting) to close a perceived
  // "phantom" slot, but Buddie's QA clarified that's not what they
  // wanted — they want the GAPS back. The real "phantom" was a 100px
  // empty band AFTER the last tile, before the loop wrapped. The fix
  // for that is in buildLayout(): X_RANGE is computed from the actual
  // rightmost tile's right edge, not hard-coded.
  var BIG_SPACING = 900 * SCALE;
  var X_RANGE = BIG_SPACING * 4; // upper bound; buildLayout() refines it

  // Left margin: how far right the first big is from x=0 on load.
  // Buddie's QA on v3.9.2: "add a margin to the first photo" /
  // "the first photo more centered when first loaded or at least
  // not at the start of the page". 200 = a comfortable "breath"
  // without making big 0 feel off-center. On mobile this default
  // is overridden in buildLayout() — see below.
  var INITIAL_OFFSET = 200 * SCALE;

  // Wrap margin: trailing space AFTER the last big, before the
  // loop wraps. So big 0's right clone doesn't start right where
  // big 2 ends (Buddie's QA: "the last and the first photos always
  // are together"). 200 = a small visible gap at the wrap point.
  var WRAP_MARGIN = 200 * SCALE;

  // Y positions
  var BIG_Y = 200 * SCALE;
  // (Each small spawns at a random y in [SMALL_Y_MIN, SMALL_Y_MAX]
  // defined further down — the old single-anchor SMALL_Y is gone.)

  // Gap between smalls and bigs
  var SMALL_GAP = 10 * SCALE;

  // Y range for smalls. Each small spawns at a random y in this range
  // so they look like a scattered set, not a row. Wide spread on
  // purpose — Buddie's QA: "I want them to spawn different from each
  // other, no jitter." SMALL_Y_MAX is floored to BIG_Y + BIG_HEIGHT
  // + 50 so smalls can appear below the bigs too (not just above or
  // overlapping). This matters most on mobile where the scaled bigs
  // sit higher in the SVG.
  var SMALL_Y_MIN = 50 * SCALE;
  var SMALL_Y_MAX = Math.max(650 * SCALE, BIG_Y + BIG_HEIGHT + 50);

  // Per-tile horizontal random offset for smalls (slot + offset
  // distribution). "A little random" per Buddie's QA. Scaled down
  // on mobile so the ±30px desktop random becomes ±12px on mobile
  // (proportional to the smaller tile size).
  var SMALL_X_OFFSET_RANGE = 60 * SCALE;

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

    // On mobile, the visible region inside the 1600-wide viewBox is
    // only ~625 units wide (the SVG fills a 375-wide phone viewport
    // with xMidYMid slice, cropping the sides to keep the 9:16-ish
    // aspect). The visible region is centered at x=800 and runs
    // roughly 487→1112. To make the tiles land in that window we
    // re-center INITIAL_OFFSET: tile span sits centered at x=800.
    //   For 3 bigs at SCALE=0.4: tileSpan = 2*360 + 200 = 920
    //   INITIAL_OFFSET = 800 - 460 = 340
    //   tiles at 340 / 700 / 1060 - all three sit inside the
    //   visible region (big 1 at 700-900 is fully visible; the
    //   slivers of big 0 and big 2 on the edges come in via
    //   touch-scroll).
    // On desktop, the top-level INITIAL_OFFSET (= 200 * SCALE = 200)
    // is the user-tuned "left margin" from v3.9.3 and stays as-is.
    if (isMobile) {
      var tileSpan = (bigCount - 1) * BIG_SPACING + BIG_WIDTH;
      INITIAL_OFFSET = Math.round(800 - tileSpan / 2);
      WRAP_MARGIN = Math.round(INITIAL_OFFSET * 0.3);
    }

    // Compute X_RANGE = (bigs' span) + WRAP_MARGIN.
    // Two things make the loop look right:
    //  • The bigs start at INITIAL_OFFSET, not at x=0 (left margin).
    //  • The loop has WRAP_MARGIN of trailing space, so big 0's
    //    right clone doesn't start right where big 2 ends.
    //   For 3 bigs at BIG_SPACING=900, INITIAL_OFFSET=200,
    //   WRAP_MARGIN=200:
    //     big 0 at 200–700, big 1 at 1100–1600, big 2 at 2000–2500
    //     X_RANGE = 2*900 + 500 + 200 = 2500  (initial offset does
    //       NOT enter here — it just shifts the layout right)
    //     big 0's right clone starts at 200+2500=2700, with a
    //     200px gap after big 2's right edge (2500). ✓
    // Smalls are placed in the content area [INITIAL_OFFSET,
    // X_RANGE - WRAP_MARGIN - SMALL_WIDTH] with random x/y.
    var bigsSpan = (bigCount - 1) * BIG_SPACING + BIG_WIDTH;
    X_RANGE = bigsSpan + WRAP_MARGIN;

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

    // Bigs: start at INITIAL_OFFSET (left margin), then spaced by
    // BIG_SPACING. With 3 bigs at BIG_SPACING=900 and
    // INITIAL_OFFSET=200: big 0 at 200, big 1 at 1100, big 2 at 2000.
    bigs.forEach(function (tile, i) {
      var x = INITIAL_OFFSET + i * BIG_SPACING;
      pushThree(tile, 'big', x, BIG_Y, BIG_PHASE_FRAC);
    });

    // Smalls: each at a unique (x, y) in the CONTENT area (not in
    // the left/right padding). X is evenly distributed across the
    // content area with a small ±30px random offset (avoids landing
    // on a perfect grid line). Y is a wide random in [SMALL_Y_MIN,
    // SMALL_Y_MAX] so each small sits at a clearly different vertical
    // position. No per-frame jitter — positions are fixed at init.
    // data-y attribute still overrides the random y for fine-tuning.
    var smallsLeft = INITIAL_OFFSET;
    var smallsRight = X_RANGE - WRAP_MARGIN - SMALL_WIDTH;
    var xSlotWidth = (smallsRight - smallsLeft) / smalls.length;
    smalls.forEach(function (tile, i) {
      var xSlot = smallsLeft + (i + 0.5) * xSlotWidth;
      var xOffset = (Math.random() - 0.5) * SMALL_X_OFFSET_RANGE; // ±30 desktop, ±12 mobile
      var x = Math.max(smallsLeft, Math.min(smallsRight, xSlot + xOffset));

      var yOverride = tile.getAttribute('data-y');
      var y = yOverride !== null
        ? parseFloat(yOverride)
        : SMALL_Y_MIN + Math.random() * (SMALL_Y_MAX - SMALL_Y_MIN);
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

  // Recreate the clip-paths in <defs> with the current (possibly
  // scaled) BIG/SMALL sizes. The HTML has fixed 500/200 clip-paths
  // (assumed to match desktop); on mobile SCALE=0.4 so the rects
  // and rounded corners shrink proportionally.
  function setupClipPaths(stage) {
    var defs = stage.querySelector('defs');
    if (!defs) {
      defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      stage.insertBefore(defs, stage.firstChild);
    }
    defs.innerHTML = '';
    var bigRx = Math.max(2, Math.round(BIG_WIDTH * 0.044));   // 22/500 = 0.044
    var smallRx = Math.max(2, Math.round(SMALL_WIDTH * 0.08)); // 16/200 = 0.08
    var SVG_NS = 'http://www.w3.org/2000/svg';
    var cp1 = document.createElementNS(SVG_NS, 'clipPath');
    cp1.id = 'hc-cp1';
    var r1 = document.createElementNS(SVG_NS, 'rect');
    r1.setAttribute('width', BIG_WIDTH);
    r1.setAttribute('height', BIG_HEIGHT);
    r1.setAttribute('rx', bigRx);
    cp1.appendChild(r1);
    defs.appendChild(cp1);
    var cp2 = document.createElementNS(SVG_NS, 'clipPath');
    cp2.id = 'hc-cp2';
    var r2 = document.createElementNS(SVG_NS, 'rect');
    r2.setAttribute('width', SMALL_WIDTH);
    r2.setAttribute('height', SMALL_HEIGHT);
    r2.setAttribute('rx', smallRx);
    cp2.appendChild(r2);
    defs.appendChild(cp2);
  }

  function init() {
    var hero = document.getElementById('top');
    var stage = document.getElementById('hero-carousel-svg');
    if (!hero || !stage) return;
    if (typeof gsap === 'undefined') return;

    // v3.10+: the carousel runs on mobile too. The previous
    // `if (window.innerWidth < MOBILE_MAX_WIDTH) return;` short-circuit
    // is gone — the CSS now shows the SVG in the top 2/3 of the hero
    // on mobile, and the tile layout is scaled by SCALE in buildLayout
    // so the visible region on a 375-wide phone shows 1.5–2 bigs.

    // Build the layout from the photos in the SVG
    var layout = buildLayout(stage);
    if (!layout.length) return;

    // Recreate clip-paths with the (scaled) tile sizes so the rounded
    // corners still match.
    setupClipPaths(stage);

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
    // Capture the band at pointer/touch PRESS time, not only on
    // mousemove. Otherwise a user who clicks before moving the mouse
    // would see inCarouselBand=false (stale initial value) and the
    // drag would silently no-op.
    hero.addEventListener('pointerdown', function (e) {
      updateBand(e.clientX, e.clientY);
    });
    hero.addEventListener('touchmove', function (e) {
      if (e.touches && e.touches[0]) {
        updateBand(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
    hero.addEventListener('touchstart', function (e) {
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
      //
      // Drag is allowed anywhere inside the hero — the band only
      // gates WHEEL, so the page can still scroll normally when the
      // user wheels in the middle of the hero. For drag, the user's
      // intent is unambiguous: if they're clicking on the hero, they
      // want to drag the photos.
      var dragStartPhase = 0;
      Observer.create({
        target: hero,
        type: 'touch,pointer',
        // Wheel is already handled above; tell Observer to ignore it
        // so it doesn't double-count.
        preventDefault: false,
        onPress: function () {
          // Capture phase at press time so onDrag has a stable base
          // even if the user starts a drag before any mousemove fires.
          dragStartPhase = phase;
        },
        onDrag: function (self) {
          // self.deltaX is total horizontal drag distance since start.
          // Drag right (positive) → tiles move right → phase grows.
          phase = dragStartPhase + self.deltaX * DRAG_SENSITIVITY / 1000;
        },
        // onLeft/onRight: discrete gestures (fling past threshold).
        // Only bump phase if the fling started inside the band —
        // outside the band, the user is just trying to scroll the
        // page and we shouldn't move the carousel.
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