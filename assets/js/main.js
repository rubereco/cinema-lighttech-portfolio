/* Main page navigation and selected work carousel. */

const I18N = window.PortfolioI18n;

/* ──────────────── Mobile nav toggle ──────────────── */

function setupMobileNav() {
  const toggleBtn = document.querySelector("[data-nav-toggle]");
  const nav       = document.querySelector("[data-nav]"); // mobile nav
  if (!toggleBtn || !nav) return;

  function setOpen(isOpen) {
    toggleBtn.setAttribute("aria-expanded", isOpen ? "true" : "false");
    nav.classList.toggle("is-open", isOpen);
    // Lock background scroll while the menu is open (otherwise the page scrolls
    // behind the menu, which looks broken on touch devices).
    document.body.style.overflow = isOpen ? "hidden" : "";
  }

  toggleBtn.addEventListener("click", () => {
    const isOpen = toggleBtn.getAttribute("aria-expanded") === "true";
    setOpen(!isOpen);
  });

  // Close nav when a link is clicked (so anchor scroll works on phone)
  nav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", () => setOpen(false));
  });

  // Close on Escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && toggleBtn.getAttribute("aria-expanded") === "true") {
      setOpen(false);
      toggleBtn.focus();
    }
  });
}

/* ──────────────── Language toggle ──────────────── */

function setupLanguageToggle() {
  document.querySelectorAll("[data-lang]").forEach(button => {
    button.addEventListener("click", () => I18N.setLanguage(button.dataset.lang));
  });
}

/* ──────────────── Header scroll state ──────────────── */
/* Toggle .is-scrolled on .site-header once the user has scrolled more
   than 4px. The CSS uses this class to swap from a fully transparent
   gradient backdrop to a stronger frosted-glass blur, so content
   scrolling under the header stays legible. rAF-throttled. */

function setupHeaderScroll() {
  const header = document.querySelector(".site-header");
  if (!header) return;

  let ticking = false;
  let scrolled = false;          // cache to avoid touching the DOM every frame

  function update() {
    const next = window.scrollY > 4;
    if (next !== scrolled) {
      scrolled = next;
      header.classList.toggle("is-scrolled", scrolled);
    }
    ticking = false;
  }

  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }, { passive: true });

  update();   // set initial state in case the page loads scrolled
}

/* ──────────────── Year stamp ──────────────── */

function setupYearStamp() {
  const el = document.getElementById("year");
  if (el) el.textContent = new Date().getFullYear();
}

/* ──────────────── Boot ──────────────── */

(async function boot() {
  await I18N.load();
  const lang = I18N.detectLanguage();
  I18N.apply(lang);

  setupMobileNav();
  setupLanguageToggle();
  setupYearStamp();
  setupHeaderScroll();
  // Film order comes directly from each film's displayOrder field.
  POSTER_WALL.render().then(films => {
    try {
      POSTER_WALL.setupCarousel();
    } catch (err) {
      console.error("[poster-wall] setupCarousel threw:", err);
    }
    return window.FILM_MODAL.init(films);
  }).catch(err => console.error("[portfolio] could not load film content:", err));
  POSTER_WALL.setupClick();

  // Signal sibling scripts that translations are ready.
  window.tarekI18nReady = true;
  window.dispatchEvent(new CustomEvent("tarek:i18n-ready", { detail: { lang } }));
})();

/* ──────────────── Selected work carousel ──────────────── */

const POSTER_WALL = (() => {
  let filmsById = new Map();
  let centerBeforeOpen = null;

  function openFilm(filmId) {
    window.dispatchEvent(new CustomEvent("tarek:film-open", { detail: { filmId } }));
  }
  async function loadData() {
    const response = await fetch("/data/films.json");
    if (!response.ok) throw new Error(`Films: HTTP ${response.status}`);
    return response.json();
  }

  // ─── Render helpers ───────────────────────────────────────────────────
  function escapeText(s)        { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }
  function escapeAttr(s)        { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

  function renderTile(film) {
    const title = escapeText(film.title);
    const imageAlt = escapeAttr(film.title);
    const year  = film.year ? String(film.year) : "";
    const role  = film.role ? escapeText(I18N.t(`roles.${film.role}`)) : "";
    const meta  = [year, role].filter(Boolean).join(" · ");
    const slug  = film.id;
    if (!film.poster) return "";
    return `
      <li>
        <a class="poster-link" href="#film-${escapeAttr(slug)}" data-film-id="${escapeAttr(slug)}">
          <img class="poster-img" src="${escapeAttr(film.poster)}"
               alt="${imageAlt}" loading="lazy" decoding="async" />
          <span class="poster-meta">
            <span class="poster-title">${title}</span>
            ${meta ? `<span class="poster-sub">${meta}</span>` : ""}
          </span>
        </a>
      </li>`;
  }

  function render(films) {
    const ul = document.getElementById("poster-wall");
    if (!ul || !films) return;
    const rows = (films.films || []).filter(film => film.poster && film.displayOrder != null);
    filmsById = new Map(rows.map(film => [film.id, film]));
    ul.innerHTML = rows.map(renderTile).join("");
    ul.setAttribute("aria-busy", "false");
  }

  function setupClick() {
    const ul = document.getElementById("poster-wall");
    if (!ul) return;
    // Click delegation on the poster wall.
    ul.addEventListener("click", (ev) => {
      const link = ev.target.closest("a.poster-link");
      if (!link) return;
      ev.preventDefault();
      const filmId = link.getAttribute("data-film-id");
      if (!filmId) return;
      if (centerBeforeOpen && centerBeforeOpen(link, filmId)) return;
      openFilm(filmId);
    });
    window.addEventListener("tarek:i18n-change", () => {
      ul.querySelectorAll("a.poster-link").forEach(link => {
        const film = filmsById.get(link.dataset.filmId);
        const subtitle = link.querySelector(".poster-sub");
        if (!film || !subtitle) return;
        const role = film.role ? I18N.t(`roles.${film.role}`) : "";
        subtitle.textContent = [film.year, role].filter(Boolean).join(" · ");
      });
    });
  }

  function renderFromState(state) { render(state); }

  // ─── v3.15.0: SLOT-MODEL CAROUSEL — infinite, mobile-aware, snap-exact ───
  // Replaces the width-based wave (v3.14.57–66x), which rewrote each
  // tile's style.width every frame. That reflowed the flex layout, so
  // offsetLeft moved every frame while the wrap distance stayed fixed —
  // the wrap boundary disagreed with real geometry ("wall ends"), the
  // wave read unwrapped positions ("two tiles stay big"), and snap
  // targets came from live getBoundingClientRect() mid-settle ("stuck"
  // on slow scroll).
  //
  // The model now is the same one hero-carousel.js uses: geometry comes
  // from a STABLE slot space, never from live DOM layout.
  //
  //   - N films × S repeated sets = T tiles. Each tile's li is
  //     absolutely parked at the wall center (CSS) and never changes
  //     size — the width comes from the --tile-w custom property.
  //   - The only state is scrollX, lerped toward targetScrollX.
  //     focus = -scrollX / W is the fractional slot sitting under the
  //     viewport center (W = slot pitch = tile width).
  //   - Per frame, per tile: wrap its slot offset into (-T/2, T/2]
  //     (the infinite loop — scrollX is unbounded and the wrap fires
  //     many viewports offscreen, so no pop is ever visible), compute
  //     the scale from the SAME wave curve as before but in slot space
  //     (deterministic and single-peaked → exactly one big tile), then
  //     place tiles flush via prefix sums of the scaled widths — pure
  //     arithmetic, so tiles touch like the width-based version but
  //     nothing ever reflows.
  //   - Snap is exact: rest state is an integer focus, so snapping is
  //     just targetScrollX = -round(focus) * W. The target never
  //     depends on DOM reads, so it cannot oscillate.
  //   - The frame loop only runs while scrollX ≠ targetScrollX (and
  //     pauses in hidden tabs): at rest the geometry is static.
  //
  // Expandable by construction: N is counted from the rendered tiles
  // and S is derived from the viewport width, so films added through
  // the admin just widen the loop — nothing is hardcoded.
  function setupCarousel() {
    var wall = document.getElementById("poster-wall");
    if (!wall) {
      console.warn("[poster-wall] #poster-wall not found");
      return;
    }
    var originals = Array.prototype.slice.call(wall.querySelectorAll(":scope > li"));
    var N = originals.length;
    if (N < 2) {
      console.warn("[poster-wall] need at least 2 tiles, got", N);
      return;
    }

    // Wave shape — the same curve the width-based version used.
    var PEAK = 1.10;   // scale of the centered (picked) tile
    var MIN_S = 0.45;  // scale floor far from the center
    var EXP = 1.5;     // falloff exponent: steep near center, flat at edges
    var RANGE = PEAK - MIN_S;

    // prefers-reduced-motion: settle instantly, no momentum animation.
    var reducedMotion = window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var LERP = reducedMotion ? 1 : 0.15;

    var W = 0;         // tile width == slot pitch (CSS --tile-w, measured)
    var FALLOFF = 700; // px over which the wave decays to MIN_S
    var tiles = [];    // [{ el, slot }] — originals first, then clones
    var clones = [];
    var T = 0;         // total slots = N * sets
    var jMin = 0;      // smallest wrapped relative slot offset (-floor(T/2))

    var scrollX = 0;
    var targetScrollX = 0;
    var restSlot = 0;  // integer slot the carousel is settled/snapping to
    var isDragging = false;
    var dragStartX = 0;
    var dragStartScrollX = 0;
    var dragMoved = 0;
    var rafId = null;
    var pendingFilmId = null;

    // (Re)build the clone sets. Sets repeat the N originals so the wrap
    // window (T/2 slots in each direction) always covers the viewport,
    // even at maximum wave compression (min-scale packing). Films added
    // via the admin simply increase N on the next page load.
    function buildTiles(sets) {
      for (var c = 0; c < clones.length; c++) {
        if (clones[c].parentNode) clones[c].parentNode.removeChild(clones[c]);
      }
      clones = [];
      tiles = [];
      for (var s = 0; s < sets; s++) {
        for (var k = 0; k < N; k++) {
          var el;
          if (s === 0) {
            el = originals[k];
          } else {
            el = originals[k].cloneNode(true);
            el.classList.add("poster-wall__clone");
            el.setAttribute("aria-hidden", "true");
            var link = el.querySelector("a");
            if (link) link.tabIndex = -1;
            wall.appendChild(el);
            clones.push(el);
          }
          tiles.push({ el: el, slot: s * N + k });
        }
      }
      T = tiles.length;
      jMin = -Math.floor(T / 2);
    }

    function measure() {
      var w = originals[0].offsetWidth;
      if (!w) {
        console.warn("[poster-wall] tile width is 0 — CSS not applied?");
        return false;
      }
      W = w;
      // Wave falloff scales with the viewport so the curve feels the
      // same on phone and desktop (700px matches the old desktop look).
      FALLOFF = Math.min(700, Math.max(420, window.innerWidth * 0.9));
      var perSide = Math.ceil((window.innerWidth / 2 + (W * PEAK) / 2) / (W * MIN_S)) + 1;
      var sets = Math.max(2, Math.ceil((2 * perSide) / N));
      if (N * sets !== T) buildTiles(sets);
      return true;
    }

    // Per-frame layout: pure math from focus, style writes only.
    // No offsetLeft / getBoundingClientRect in here — that is the whole
    // point. The wave and the wrap read the SAME slot-space positions,
    // so they can never disagree.
    var scaleByJ = [];
    var widthByJ = [];
    var centerByJ = [];
    function layout() {
      if (!T || !W) return;
      var focus = -scrollX / W;
      var anchor = Math.round(focus);
      var f = focus - anchor;  // lean of focus vs. anchor slot, [-0.5, 0.5]
      var jMax = jMin + T - 1;
      var j, idx;
      // Pass 1: wave scale per relative slot offset.
      for (j = jMin; j <= jMax; j++) {
        idx = j - jMin;
        var t = Math.pow(Math.abs(j - f) * W / FALLOFF, EXP);
        var sc = Math.max(MIN_S, PEAK - t * RANGE);
        scaleByJ[idx] = sc;
        widthByJ[idx] = sc * W;
      }
      // Pass 2: flush centers — adjacent tiles touch, so center spacing
      // is the average of the two scaled widths. The anchor tile is
      // offset from the viewport center by the lean f × local spacing,
      // which keeps positions continuous as focus crosses half-integers.
      var z0 = -jMin; // array index of j = 0
      if (f === 0) {
        centerByJ[z0] = 0;
      } else {
        var neighbor = f > 0 ? 1 : -1;
        centerByJ[z0] = -f * (widthByJ[z0] + widthByJ[neighbor - jMin]) / 2;
      }
      for (j = 1; j <= jMax; j++) {
        idx = j - jMin;
        centerByJ[idx] = centerByJ[idx - 1] + (widthByJ[idx - 1] + widthByJ[idx]) / 2;
      }
      for (j = -1; j >= jMin; j--) {
        idx = j - jMin;
        centerByJ[idx] = centerByJ[idx + 1] - (widthByJ[idx + 1] + widthByJ[idx]) / 2;
      }
      // Pass 3: wrap each tile's slot offset into [jMin, jMax] and apply.
      // The tile's home position (no transform) is the wall's center,
      // so translateX is just the computed center offset.
      for (var i = 0; i < T; i++) {
        var rel = tiles[i].slot - anchor;
        rel = jMin + ((((rel - jMin) % T) + T) % T);
        idx = rel - jMin;
        var el = tiles[i].el;
        el.style.transform = "translateX(" + centerByJ[idx].toFixed(2) + "px) scale(" + scaleByJ[idx].toFixed(4) + ")";
        el.style.zIndex = String(1000 - Math.round(Math.abs(rel - f) * 10));
      }
    }

    // ─── Animation loop ───
    // Runs only while scrollX is still chasing targetScrollX. At rest
    // the geometry is a pure function of scrollX, so a stopped loop is
    // a correct loop — nothing needs re-evaluating.
    function frame() {
      scrollX += (targetScrollX - scrollX) * LERP;
      if (Math.abs(targetScrollX - scrollX) < 0.3) scrollX = targetScrollX;
      layout();
      if (scrollX !== targetScrollX && !document.hidden) {
        rafId = requestAnimationFrame(frame);
      } else {
        rafId = null;
        if (scrollX === targetScrollX && pendingFilmId) {
          var filmId = pendingFilmId;
          pendingFilmId = null;
          openFilm(filmId);
        }
      }
    }
    function ensureAnimating() {
      if (rafId === null && !document.hidden) {
        rafId = requestAnimationFrame(frame);
      }
    }
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) ensureAnimating();
    });

    // ─── Snapping ───
    // Rest state is an integer focus, so a snap never depends on live
    // DOM geometry — it cannot oscillate or get stuck mid-settle.
    function snapToNearest() {
      if (!W) return;
      restSlot = Math.round(-targetScrollX / W);
      targetScrollX = -restSlot * W;
      ensureAnimating();
    }

    // Use the same slot-space motion as dragging to bring a clicked side
    // poster to the center before showing its details at every viewport size.
    centerBeforeOpen = function (link, filmId) {
      if (!W || !T) return false;
      var tile = tiles.find(function (item) { return item.el === link.closest("li"); });
      if (!tile) return false;

      var anchor = Math.round(-scrollX / W);
      var relativeSlot = jMin + ((((tile.slot - anchor - jMin) % T) + T) % T);
      var centeredSlot = anchor + relativeSlot;
      var centeredX = -centeredSlot * W;
      pendingFilmId = null;
      restSlot = centeredSlot;
      targetScrollX = centeredX;

      if (reducedMotion || Math.abs(scrollX - centeredX) < 0.3) {
        scrollX = centeredX;
        layout();
        return false;
      }

      pendingFilmId = filmId;
      ensureAnimating();
      return true;
    };

    // Vertical wheel scrolling belongs to the page. Drag and touch still move the posters.
    function onMouseDown(e) {
      e.preventDefault(); // kill native image drag / text selection
      if (pendingFilmId) {
        pendingFilmId = null;
        targetScrollX = scrollX;
      }
      isDragging = true;
      dragMoved = 0;
      dragStartX = e.clientX;
      dragStartScrollX = targetScrollX;
      wall.style.cursor = "grabbing";
    }
    function onMouseMove(e) {
      if (!isDragging) return;
      dragMoved = e.clientX - dragStartX;
      targetScrollX = dragStartScrollX + dragMoved;
      ensureAnimating();
    }
    function endDrag() {
      if (!isDragging) return;
      isDragging = false;
      wall.style.cursor = "grab";
      if (Math.abs(dragMoved) > 6) suppressClickBriefly();
      snapToNearest();
    }
    function onTouchStart(e) {
      if (pendingFilmId) {
        pendingFilmId = null;
        targetScrollX = scrollX;
      }
      isDragging = true;
      dragMoved = 0;
      dragStartX = e.touches[0].clientX;
      dragStartScrollX = targetScrollX;
    }
    function onTouchMove(e) {
      if (!isDragging) return;
      dragMoved = e.touches[0].clientX - dragStartX;
      targetScrollX = dragStartScrollX + dragMoved;
      ensureAnimating();
    }

    // Dragging more than a few px and releasing also fires a click on
    // the tile — swallow it so a drag never opens the film modal.
    var suppressClick = false;
    var suppressTimer = null;
    function suppressClickBriefly() {
      suppressClick = true;
      if (suppressTimer !== null) clearTimeout(suppressTimer);
      suppressTimer = setTimeout(function () {
        suppressClick = false;
        suppressTimer = null;
      }, 350);
    }
    wall.addEventListener("click", function (e) {
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
      e.stopPropagation();
    }, true);

    wall.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", endDrag);
    wall.addEventListener("touchstart", onTouchStart, { passive: true });
    wall.addEventListener("touchmove", onTouchMove, { passive: true });
    wall.addEventListener("touchend", endDrag);
    // Cancel drag if the user releases outside the window
    window.addEventListener("mouseleave", endDrag);

    // ─── Resize ───
    // Re-measure the tile width, rebuild clone sets if the wrap window
    // no longer covers the viewport, and re-anchor to the settled slot.
    var resizeTimer = null;
    window.addEventListener("resize", function () {
      if (resizeTimer !== null) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        resizeTimer = null;
        pendingFilmId = null;
        if (!measure()) return;
        scrollX = targetScrollX = -restSlot * W;
        layout();
        ensureAnimating();
      }, 150);
    });

    // ─── Setup ───
    if (!measure()) return;
    // Going live switches the tiles from the no-JS flex fallback to
    // absolute positioning parked at the wall's center (see sections.css).
    wall.classList.add("poster-wall--live");
    scrollX = targetScrollX = -restSlot * W;
    layout();

    console.info("[poster-wall] slot carousel:", N, "films ×", T / N,
      "sets =", T, "tiles · tile", W + "px · falloff", Math.round(FALLOFF) + "px");
  }

  return {
    loadData,
    render: () => loadData().then(data => { renderFromState(data); return data; }),
    setupClick,
    setupCarousel: setupCarousel
  };
})();
