/* ════════════════════════════════════════════════════════════════════════
   main.js — theme toggle, mobile nav, language toggle, kit filter,
   film detail modal. One file, no build, no dependencies.
   ════════════════════════════════════════════════════════════════════════ */

/* ──────────────── i18n: load + apply translations ──────────────── */

const I18N = (() => {
  const STORAGE_KEY = "tarek.lang";
  let strings = null;

  // ─── Inline-first loader ────────────────────────────────────────────
  // Read translations from an inline <script type="application/json"> block
  // when present (file:// compatibility), fall back to fetch() for live deploys.
  function readInline(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); }
    catch (err) { console.warn(`[i18n] inline #${id} parse failed:`, err); return null; }
  }

  async function load() {
    strings = readInline("tarek-i18n");
    if (strings) return;
    try {
      const res = await fetch("data/i18n.json", { cache: "no-store" });
      strings = await res.json();
    } catch (err) {
      console.warn("[i18n] failed to load translations:", err);
      strings = { en: {}, es: {} };
    }
  }

  /**
   * Pick the active language:
   *  1. URL param ?lang=es (manual override, useful for testing)
   *  2. localStorage (user's previous choice)
   *  3. <html lang="..."> attribute (page-set default)
   *  4. navigator.language (browser default; ES for Spanish-speaking browsers)
   */
  function detectLanguage() {
    const url = new URL(window.location.href);
    const fromUrl = url.searchParams.get("lang");
    if (fromUrl && ["en", "es"].includes(fromUrl)) return fromUrl;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && ["en", "es"].includes(stored)) return stored;
    } catch {}

    const fromHtml = document.documentElement.lang;
    if (fromHtml && ["en", "es"].includes(fromHtml)) return fromHtml;

    const browser = navigator.language || navigator.userLanguage || "en";
    return browser.toLowerCase().startsWith("es") ? "es" : "en";
  }

  /**
   * Resolve "a.b.c" against the active language dictionary.
   * Returns null (not the key) when missing, so callers can detect missing
   * translations and keep the original fallback text instead of leaking keys.
   */
  function t(key, lang) {
    const dict = strings[lang] || strings.en || {};
    const value = key.split(".").reduce((acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), dict);
    return (typeof value === "string") ? value : null;
  }

  /** Apply all translations to the DOM.
   *  If a translation is missing for the active language, the original
   *  English text in the HTML is kept (it serves as a built-in fallback).
   *  This means: even if data/i18n.json fails to load, the page renders
   *  in English instead of showing raw keys like "work.title".
   */
  function apply(lang) {
    document.documentElement.lang = lang;

    // text content — only replace if we found a translation
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      const value = t(key, lang);
      if (value !== null) el.textContent = value;
    });

    // html content (for the about body, which has <em> tags)
    document.querySelectorAll("[data-i18n-html]").forEach((el) => {
      const key = el.getAttribute("data-i18n-html");
      const value = t(key, lang);
      if (value !== null) el.innerHTML = value;
    });

    // attribute translations, e.g. data-i18n-attr="aria-label:theme.toggleLabel"
    document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
      el.getAttribute("data-i18n-attr").split(";").forEach((pair) => {
        const [attr, key] = pair.split(":").map((s) => s.trim());
        if (!attr || !key) return;
        const value = t(key, lang);
        if (value !== null) el.setAttribute(attr, value);
      });
    });

    // language toggle buttons: highlight active
    document.querySelectorAll("[data-lang]").forEach((btn) => {
      btn.setAttribute("aria-pressed", btn.getAttribute("data-lang") === lang ? "true" : "false");
    });
  }

  return { load, apply, detectLanguage, t };
})();

// Expose for sibling scripts (e.g. partners.js) so they can read translations
// and the active language without re-loading i18n.json. Single source of truth.
window.TarekI18N = I18N;

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
  document.querySelectorAll("[data-lang]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const lang = btn.getAttribute("data-lang");
      try { localStorage.setItem("tarek.lang", lang); } catch {}
      I18N.apply(lang);
      // Notify sibling scripts (partners.js) that the active
      // language changed so they can re-render dynamic content.
      window.dispatchEvent(new CustomEvent("tarek:i18n-change", { detail: { lang } }));
    });
  });
}

/* (v3.13.0: setupKitFilter() and the kit/rental section are gone —
   the section is now the partners accordion. partners.js handles its
   own setup.) */

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
  setupSectionChrome();

  // Render the poster wall (work.json × films.json) after data is ready.
  // v3.14.49: setupCarousel replaces all the setupLoop / setupWave
  // / view-timeline mess. It's a self-contained carousel:
  // clones both ends, wheel/drag/touch input, translateX on
  // the track, per-frame scale on each tile based on distance
  // from viewport center. See the function body for details.
  POSTER_WALL.render().then(() => {
    try {
      POSTER_WALL.setupCarousel();
    } catch (err) {
      console.error("[poster-wall] setupCarousel threw:", err);
    }
  });
  POSTER_WALL.setupClick();

  // Film detail modal — loads films.json + people.json, listens for
  // tarek:film-open events from the poster wall, handles deep links.
  FILM_MODAL.init();

  // Signal sibling scripts that i18n is ready (partners.js listens for this).
  window.dispatchEvent(new CustomEvent("tarek:i18n-ready", { detail: { lang } }));
})();

/* ──────────────── Section chrome: sticky-in-section links ──────────────── */
/* The bottom-left IMDb link + bottom-right "next section" arrow live inside
   #work as .section-chrome with `position: sticky; bottom: 56px` (see
   components.css). Pure CSS — no JS needed:
   - The pills scroll with the section naturally.
   - They stick to viewport-bottom-minus-56px as the user scrolls down
     through the section.
   - When the section's bottom edge exits the viewport, the sticky element
     scrolls away with the section automatically.
   - The pill is bounded by its parent (the section), so it can NEVER float
     over #about or any other section.

   This is the textbook "Sticky Bottom CTA" pattern. Previous iterations
   (v3.11.0–v3.11.6) used `position: fixed` with IntersectionObserver or
   transform-based fall-to-floor triggers and kept producing the same
   "pills disappear mid-scroll" bug because the timing of fade-out vs.
   dock-release was never right. CSS sticky is bounded by its parent —
   no timing bugs possible. */

function setupSectionChrome() {
  // Intentional no-op. Kept as a hook so init() can call it without
  // conditionals, in case we ever need to add scroll-driven effects
  // (e.g. active-section highlighting) later.
  return;
}

/* ──────────────── Poster wall (work.json × films.json) ──────────────── */
/* Walks data/work.json.rows[].filmId → data/films.json[id] → DOM. Self-contained:
   inlines loadBlock helper and readInline (file:// compatibility).
   Click handler is a placeholder stub: fires `tarek:film-open` event + sets
   `window.location.hash` to `#film-<id>` so the modal-in-a-future-commit can
   hook in. */

const POSTER_WALL = (() => {
  // ─── Inline-first data loader (file:// compatibility) ────────────────
  const BLOCKS = [
    { src: "data/work.json", inline: "tarek-work" },
    { src: "data/films.json", inline: "tarek-films" }
  ];

  function readInline(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); } catch (e) { return null; }
  }

  async function loadBlock(block) {
    // 1. Try inline JSON block first (works on file://)
    const inline = readInline(block.inline);
    if (inline) return inline;
    // 2. Fall back to fetch (live deploys)
    try {
      const res = await fetch(block.src, { cache: "no-cache" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } catch (e) {
      console.warn("[poster-wall] could not load", block.src, e);
      return null;
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────
  function escapeText(s)        { return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]); }
  function escapeAttr(s)        { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]); }

  function renderTile(row, filmsById) {
    const film = filmsById[row.filmId];
    if (!film) return "";
    const title = film.title ? escapeText(film.title) : "Untitled";
    const year  = film.year ? String(film.year) : "";
    const role  = film.role ? escapeText(film.role) : "";
    const meta  = [year, role].filter(Boolean).join(" · ");
    const slug  = film.id || film.filmId || row.filmId;
    // Skip films with no poster (e.g. saw-2026 still in production)
    if (!film.poster) return "";
    return `
      <li>
        <a class="poster-link" href="#film-${escapeAttr(slug)}" data-film-id="${escapeAttr(slug)}">
          <img class="poster-img" src="${escapeAttr(film.poster)}"
               alt="${title}" loading="lazy" />
          <span class="poster-meta">
            <span class="poster-title">${title}</span>
            ${meta ? `<span class="poster-sub">${meta}</span>` : ""}
          </span>
        </a>
      </li>`;
  }

  function render(work, films) {
    const ul = document.getElementById("poster-wall");
    if (!ul || !work || !films) return;
    const rows = (work.rows || []).filter((r) => r && r.filmId);
    const filmsById = {};
    for (const f of (films.films || films || [])) filmsById[f.id] = f;
    ul.innerHTML = rows.map((row) => renderTile(row, filmsById)).join("");
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
      window.history.replaceState(null, "", `#film-${filmId}`);
      window.dispatchEvent(new CustomEvent("tarek:film-open", { detail: { filmId } }));
      // Placeholder: real modal/drawer hookup lands in a future commit
      console.info("[poster-wall] tarek:film-open", { filmId });
    });
    // v3.14.37: no more touchstart/wheel → resetCycle listeners.
    // The wall is now a perpetual carousel (CSS animation), so
    // there's no discrete cycle to reset. The animation pauses
    // itself on hover/focus via CSS (animation-play-state).
  }

  async function loadData() {
    const [work, films] = await Promise.all(BLOCKS.map(loadBlock));
    if (!work || !films) return null;
    return { work, films };
  }

  // Render requires the data already loaded — split for clarity
  function renderFromState(state) {
    if (!state) return;
    render(state.work, state.films);
  }

  // v3.14.49: PROPER CAROUSEL — the approach that actually works.
  // After chasing scrollLeft/overflow:auto and view-timeline
  // for 8 commits and getting nothing that the user could
  // actually scroll or see a wave on, I went and looked at
  // how real carousels are built. The pattern is:
  //
  //   1. A viewport with overflow: hidden (the visible window)
  //   2. A track inside it, wider than the viewport
  //   3. JS translates the track with transform: translateX()
  //      based on user input (wheel, drag, touch)
  //   4. The transform is GPU-accelerated — no scroll-event
  //      races, no view-timeline browser support worries
  //   5. For the wave: per-frame, compute each item's
  //      distance from the viewport center and apply
  //      transform: scale() based on that
  //   6. For the perpetual effect: clone the items at both
  //      ends, and when the user scrolls past the end, wrap
  //      the scroll position back by one set width
  //
  // This is the approach from the YouTube vanilla-JS carousel
  // tutorial and the codegateway swipeable carousel — battle
  // tested, works in every browser, no library, no scroll
  // event listener nonsense.
  function setupCarousel() {
    var wall = document.getElementById("poster-wall");
    if (!wall) {
      console.warn("[poster-wall] #poster-wall not found");
      return;
    }
    var originalItems = Array.prototype.slice.call(
      wall.querySelectorAll(":scope > li")
    );
    if (originalItems.length < 2) {
      console.warn("[poster-wall] need at least 2 tiles, got",
        originalItems.length);
      return;
    }

    // ─── Clone items at both ends for the perpetual loop ───
    // Track now looks like:
    //   [A B C ... L | A B C ... L | A B C ... L]
    //   ^clonesBefore  ^originals    ^clonesAfter
    // We start the user in the MIDDLE set (the originals).
    // When they scroll far enough left/right, we jump them
    // back to the equivalent position in another set — the
    // wrap is invisible because the content is the same.
    // v3.14.65: was 1 set of clones on each side; now 2
    // sets on each side (clonesBefore + clonesBefore2 before
    // the originals, clonesAfter + clonesAfter2 after).
    // The extra sets are buffer — they give the user a full
    // extra "set's worth" of scroll room before the wrap
    // boundary crosses the visible area, so the user never
    // feels like the wall is running out of content. With
    // the wider wrap range in wrapTarget() (one viewport
    // past the boundary), the user genuinely can scroll
    // ~3 sets of items before the wall recycles, and
    // the recycle happens entirely offscreen.
    var clonesBefore = originalItems.map(function (item) {
      var c = item.cloneNode(true);
      c.classList.add("poster-wall__clone");
      return c;
    });
    var clonesBefore2 = originalItems.map(function (item) {
      var c = item.cloneNode(true);
      c.classList.add("poster-wall__clone");
      return c;
    });
    var clonesAfter = originalItems.map(function (item) {
      var c = item.cloneNode(true);
      c.classList.add("poster-wall__clone");
      return c;
    });
    var clonesAfter2 = originalItems.map(function (item) {
      var c = item.cloneNode(true);
      c.classList.add("poster-wall__clone");
      return c;
    });
    // Outer-most first (so the wall is [..., buf2, buf1,
    // originals, buf1, buf2, ...] reading left to right).
    clonesBefore2.reverse().forEach(function (c) {
      wall.insertBefore(c, wall.firstChild);
    });
    clonesBefore.reverse().forEach(function (c) {
      wall.insertBefore(c, wall.firstChild);
    });
    clonesAfter.forEach(function (c) {
      wall.appendChild(c);
    });
    clonesAfter2.forEach(function (c) {
      wall.appendChild(c);
    });

    var itemCount    = originalItems.length;
    var itemWidth    = originalItems[0].offsetWidth;
    var oneSetWidth  = itemCount * itemWidth;
    // v3.14.65: 2 sets of clones on each side now, so
    // the "clone set width" is 2 * oneSetWidth.
    var totalClonesBefore = clonesBefore.length + clonesBefore2.length;
    var cloneSetWidth = totalClonesBefore * itemWidth;

    // ─── Scroll state ───
    // scrollX = current actual position (what's rendered).
    // targetScrollX = where the user wants to be (where the
    // wheel/drag is pushing us). We lerp from target to scroll
    // each frame for a smooth momentum feel.
    var scrollX = 0;
    var targetScrollX = 0;
    var isDragging = false;
    var dragStartX = 0;
    var dragStartScrollX = 0;

    // v3.14.57: apply the wave ONCE before computing the
    // initial scrollX. With width-based wave, the first
    // updateWave() changes each tile's width based on its
    // distance from the viewport center, which changes the
    // offsetLeft of every tile after it. The old
    // transform: scale() didn't change the layout box, so
    // firstOriginal.offsetLeft was always the same as the
    // CSS default. With width-based, the offsetLeft after
    // the wave is DIFFERENT from before it — so we have to
    // run the wave first, THEN center the first original.
    // Without this fix, the first original would be
    // off-screen by ~1800px on initial load (all 10 clones
    // before it shrinking from 400px to 180px).
    updateWave();
    // Start the user in the MIDDLE set (the originals),
    // with the first original item (A) centered in the viewport.
    //
    // v3.14.64: use the VIEWPORT center, not the wall's center.
    // The wall is narrower than the viewport (the section has
    // horizontal padding to center the content), so
    // wall.clientWidth/2 and window.innerWidth/2 are at
    // DIFFERENT x-positions. The wave uses the viewport
    // center (window.innerWidth/2 in updateWave), so the
    // tile that gets scaled up to 1.10 is the one at the
    // viewport's center — NOT the wall's center. Using
    // wall.clientWidth/2 here placed the first original at
    // the wall's center, which was 360px to the LEFT of
    // the viewport center on a 1920px screen with 360px
    // section padding. The wave then made whichever tile
    // happened to be at the viewport center the "picked"
    // one — which was the 3rd original (Lo Que Queda De
    // Ti), not the 1st (Els Mals Noms). Fix: use
    // wall.getBoundingClientRect().left + window.innerWidth/2
    // to place the first original at the actual visible
    // viewport center, where the wave is also centered.
    var firstOriginal = wall.querySelectorAll(":scope > li")[totalClonesBefore];
    var wallLeft = wall.getBoundingClientRect().left;
    scrollX = (window.innerWidth / 2) - wallLeft - firstOriginal.offsetLeft - (firstOriginal.offsetWidth / 2);
    targetScrollX = scrollX;
    // v3.14.66: NO wall.style.transform. The wall is
    // static; the per-tile frame loop applies the wrap
    // via per-tile transform: translateX(). The first
    // frame() call below will position every tile.

    // ─── Input handlers ───
    // v3.14.53: snapToNearest — when the user stops
    // scrolling (mouseup, touchend, or after a wheel
    // burst), find the tile closest to the viewport
    // center and animate targetScrollX so that tile
    // lands at center. The existing lerp in the frame
    // loop (0.15/frame) handles the smooth animation.
    // This makes "one portrait is the highlighted one"
    // an actual user-controlled state — whatever the
    // user scrolls to becomes the focus.
    function snapToNearest() {
      if (isDragging) return;
      var viewportCenterX = window.innerWidth / 2;
      var allItems = wall.querySelectorAll(":scope > li");
      var bestI = 0;
      var bestDist = Infinity;
      for (var i = 0; i < allItems.length; i++) {
        var rect = allItems[i].getBoundingClientRect();
        var center = (rect.left + rect.right) / 2;
        var dist = Math.abs(center - viewportCenterX);
        if (dist < bestDist) {
          bestDist = dist;
          bestI = i;
        }
      }
      // The nearest tile is at visual position `center`.
      // We want it at viewportCenterX, so shift the wall
      // by (viewportCenterX - center). That keeps the
      // perpetual wrap consistent — the item's offsetLeft
      // is unchanged, only the wall's transform shifts.
      //
      // v3.14.66: no more wrapTarget() here. scrollX is
      // allowed to grow unbounded; the per-tile wrap in
      // frame() handles the infinite loop visually.
      var rect = allItems[bestI].getBoundingClientRect();
      var tileCenter = (rect.left + rect.right) / 2;
      var shift = viewportCenterX - tileCenter;
      if (Math.abs(shift) < 1) return; // already centered
      targetScrollX += shift;
      ensureAnimating();
    }

    // Debounce the wheel-snap: only snap after 120ms of
    // no wheel events. Trackpads fire many small wheel
    // events in quick succession; we don't want to snap
    // between each one.
    var wheelSnapTimer = null;
    function scheduleWheelSnap() {
      if (wheelSnapTimer !== null) clearTimeout(wheelSnapTimer);
      wheelSnapTimer = setTimeout(function () {
        wheelSnapTimer = null;
        snapToNearest();
      }, 120);
    }

    function onWheel(e) {
      e.preventDefault();
      // deltaY is vertical scroll; we use it for horizontal
      // movement. Trackpads send small deltas; mice send
      // bigger ones. Either way it feels natural.
      targetScrollX -= e.deltaY;
      ensureAnimating();
      scheduleWheelSnap();
    }
    function onMouseDown(e) {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartScrollX = targetScrollX;
      wall.style.cursor = "grabbing";
    }
    function onMouseMove(e) {
      if (!isDragging) return;
      targetScrollX = dragStartScrollX + (e.clientX - dragStartX);
      ensureAnimating();
    }
    function onMouseUp() {
      if (!isDragging) return;
      isDragging = false;
      wall.style.cursor = "grab";
      snapToNearest();
    }
    function onTouchStart(e) {
      isDragging = true;
      dragStartX = e.touches[0].clientX;
      dragStartScrollX = targetScrollX;
    }
    function onTouchMove(e) {
      if (!isDragging) return;
      targetScrollX = dragStartScrollX + (e.touches[0].clientX - dragStartX);
      ensureAnimating();
    }
    function onTouchEnd() {
      if (!isDragging) return;
      isDragging = false;
      snapToNearest();
    }

    // v3.14.66: REMOVED wrapTarget entirely.
    //
    // The wrap pattern has changed fundamentally. The track
    // no longer translates — each tile is positioned
    // individually with its own per-frame translateX, and
    // each tile's position is wrapped into its own valid
    // range via a per-tile while-loop in frame(). This is
    // the same pattern hero-carousel.js uses, and it
    // produces a completely seamless infinite loop because:
    //
    //   - scrollX grows UNBOUNDED (no snap-back to a range)
    //   - per tile, visualPos = offsetLeft + scrollX
    //   - per tile, while visualPos > offsetLeft + totalWidth
    //       visualPos -= totalWidth
    //     while visualPos < offsetLeft
    //       visualPos += totalWidth
    //   - the tile's transform = translateX(visualPos - offsetLeft)
    //
    // The wrap is per-tile, per-frame — so no single moment
    // has the whole wall "jumping" past the user. Each tile
    // independently slides from one end of its valid range
    // to the other, and when it hits an edge, it just
    // re-enters from the other edge of the same range. From
    // the user's POV, tiles never jump — they smoothly
    // cycle forever. The boundary between clones and
    // originals never crosses the visible area because the
    // wrap range is one full totalWidth wide per tile.
    //
    // Why this works better than track-translate + wrap:
    //   - Track-translate moves ALL tiles by the same delta
    //     when wrapping, so the user sees a "flash" of all
    //     tiles shifting simultaneously.
    //   - Per-tile wrap moves only ONE tile at a time
    //     (when it crosses its own range boundary), and the
    //     other tiles don't move. The user only ever sees
    //     one tile re-entering from the other side, which
    //     reads as "this carousel has more items" instead
    //     of "the whole wall just teleported".

    wall.addEventListener("wheel", onWheel, { passive: false });
    wall.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    wall.addEventListener("touchstart", onTouchStart, { passive: true });
    wall.addEventListener("touchmove", onTouchMove, { passive: true });
    wall.addEventListener("touchend", onTouchEnd);
    // Cancel drag if the user releases outside the window
    window.addEventListener("mouseleave", onMouseUp);

    // ─── Animation loop ───
    // v3.14.66: completely refactored. The wall no longer
    // moves. scrollX is the user's scroll position and
    // grows UNBOUNDED (positive or negative). Each tile
    // is positioned individually with its own translateX,
    // and its visual position is wrapped into a valid
    // range via a per-tile while-loop. This is the hero
    // carousel's pattern (hero-carousel.js, around line
    // 1017-1023): phase grows unbounded, displayX is
    // wrapped per-tile, no single moment has the whole
    // wall "jumping" past the user.
    //
    // Per frame:
    //   1. Lerp scrollX toward targetScrollX (smooth
    //      momentum on wheel/drag release).
    //   2. updateWave() — set each tile's width based
    //      on distance from viewport center. This changes
    //      the tile's offsetLeft (flex layout reflow).
    //   3. For each tile, compute visualPos =
    //      offsetLeft + scrollX, wrap it into
    //      [-buffer, totalWidth + buffer] (where
    //      buffer = window.innerWidth), and set the
    //      tile's transform: translateX(visualPos -
    //      offsetLeft). The wall itself is NOT
    //      translated — the tiles are. The wrap range
    //      is WIDER than the wall by one viewport on
    //      each side, so the wrap only fires when the
    //      tile is offscreen (see the longer comment
    //      below for why this matters).
    //
    // The wrap is per-tile, per-frame, so no tile ever
    // "jumps". A tile smoothly slides through its valid
    // range and seamlessly re-enters from the other edge
    // when it crosses. From the user's POV, the carousel
    // just goes on forever.
    function frame() {
      // Lerp: 0.15 = snappy but smooth. Lower = more momentum.
      scrollX += (targetScrollX - scrollX) * 0.15;
      // Snap to target when close enough — prevents infinite
      // tiny updates once the user stops interacting.
      if (Math.abs(targetScrollX - scrollX) < 0.3) {
        scrollX = targetScrollX;
      }
      // Step 1: wave sets each tile's width (changes offsetLeft
      // via the flex layout).
      updateWave();
      // Step 2: per-tile wrap + position. The wall is now
      // STATIC; each tile carries its own translateX.
      //
      // THE KEY TRICK that makes this smooth (matching the
      // hero carousel's "feels fantastic" behavior):
      //
      //   The wrap range is WIDER than the wall by TWO full
      //   viewports on each side: [-buffer, totalWidth + buffer]
      //   where buffer = 2 * window.innerWidth. This means the
      //   wrap only fires when a tile is at least TWO full
      //   viewport WIDTHS past the visible edge.
      //
      //   Why this matters: the wave re-evaluates each tile's
      //   width every frame based on its visual distance from
      //   the viewport center. If the wrap fired at the
      //   visible edge, the wave would re-evaluate the tile
      //   as it crossed from "in viewport" to "offscreen" and
      //   the user would see the size flash. By pushing the
      //   wrap boundary TWO viewports past the visible
      //   edge, the wrap fires while the tile is COMPLETELY
      //   offscreen — the wave re-evaluates offscreen too,
      //   and by the time the tile re-enters the viewport
      //   (smoothly, as the user scrolls), the wave is
      //   already stable and the transition is invisible.
      //
      //   The hero carousel does the same thing — the wrap
      //   there is `while displayX > item.offset + X_RANGE`,
      //   where the visible area is also about X_RANGE wide.
      //   The wrap boundary is right at the edge of (or
      //   slightly past) the visible area, so the wrap
      //   happens just as the tile is leaving or entering.
      //
      //   totalWidth is computed from the FIRST and LAST
      //   tile's offsetLeft + width, i.e. the actual rendered
      //   width of the wall (which varies frame-to-frame
      //   because the wave changes each tile's width). This
      //   is critical: using a static totalWidth (e.g.
      //   allItems.length * itemWidth) would mismatch the
      //   live offsetLeft values whenever the wave is
      //   asymmetric, and the wrap would shift tiles by an
      //   inconsistent amount.
      var allItems = wall.querySelectorAll(":scope > li");
      var firstItem = allItems[0];
      var lastItem = allItems[allItems.length - 1];
      var totalWidth = (lastItem.offsetLeft + lastItem.offsetWidth) - firstItem.offsetLeft;
      var buffer = 2 * window.innerWidth;
      for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        var visualPos = item.offsetLeft + scrollX;
        // Per-tile wrap (hero-carousel.js pattern). The wrap
        // only fires when visualPos crosses the offscreen
        // boundary, so the wave re-evaluation happens entirely
        // outside the visible area. The tile re-enters the
        // viewport smoothly as the user continues scrolling.
        while (visualPos > totalWidth + buffer) {
          visualPos -= totalWidth;
        }
        while (visualPos < -buffer) {
          visualPos += totalWidth;
        }
        item.style.transform = "translateX(" + (visualPos - item.offsetLeft) + "px)";
      }

      // Keep animating as long as we're still moving toward
      // target OR the user is actively dragging.
      if (isDragging || Math.abs(targetScrollX - scrollX) > 0.3) {
        requestAnimationFrame(frame);
      } else {
        rafId = null;
      }
    }
    var rafId = null;
    function ensureAnimating() {
      if (rafId === null) {
        rafId = requestAnimationFrame(frame);
      }
    }
    // v3.14.66: Kick off the loop immediately so the
    // per-tile positions are applied on first paint.
    // (The old code kicked off via the wrapTarget override;
    // now we just start it directly.)
    ensureAnimating();

    // ─── Wave (coverflow scale) ───
    // For every item, compute its distance from the viewport
    // center and set its WIDTH based on that distance. The
    // center item is the "picked" one (width 440 = 1.1× the
    // 400px baseline), and items on either side shrink along
    // a power curve so the drop-off is steep near the center
    // and flat at the edges.
    //
    // v3.14.51 BUGFIX: the viewport center must be
    // window.innerWidth / 2, NOT wall.getBoundingClientRect()
    // center. The wall has transform: translateX(scrollX)
    // applied, so its bounding rect is at the ORIGINAL
    // position + scrollX. With scrollX=-2100 the wall's
    // rect.left is at -2100 (off-screen), and the "center"
    // comes out at -1500 — 2100px to the LEFT of the
    // actual visible center. Every item's distance to
    // "center" comes out > 2000px, so they all snap to the
    // 0.45 minimum scale. The carousel goes invisible.
    // Using window.innerWidth / 2 fixes it: that's the
    // actual center of the visible viewport, regardless
    // of the wall's transform.
    //
    //   distance 0   → t=0.0  → width 440 (picked, big)
    //   distance 200 → t=0.13 → width 408
    //   distance 400 → t=0.38 → width 340
    //   distance 700+→ t=1.0  → width 180 (clamped at 0.45)
    // v3.14.54: falloff range pushed 500→700 to match
    // the doubled tile width (400px). With 500px
    // falloff, only the immediate neighbor was clearly
    // visible (scale ~0.60) and the next one snapped to
    // the 0.45 floor. 700 keeps ~2 visible side tiles
    // before the floor.
    //
    // v3.14.57: dropped transform: scale, use width instead.
    // The previous version (v3.14.55 + v3.14.56) used
    // transform: scale(s) which shrinks the VISUAL size of a
    // tile but leaves its LAYOUT BOX at 400px. So a tile
    // scaled to 0.82 was visually 328px wide but still
    // occupied 400px in the flexbox — leaving a ~36px gap
    // on each side where the next tile didn't start until
    // the layout-box edge. That's the visible "margin"
    // Tarek kept seeing even with marginLeft/marginRight
    // set to 0.
    //
    // With width = itemWidth * scale, the layout box MATCHES
    // the visual size, so adjacent items are flush. The
    // .poster-link inside has aspect-ratio: 2/3, so the
    // image keeps its 2:3 frame at every width. No
    // transform means no need for z-index tricks or
    // overflow: visible on the tile.
    function updateWave() {
      var viewportCenterX = window.innerWidth / 2;
      var allItems = wall.querySelectorAll(":scope > li");
      for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];
        var itemRect = item.getBoundingClientRect();
        var itemCenterX = (itemRect.left + itemRect.right) / 2;
        var distance = Math.abs(itemCenterX - viewportCenterX);
        var t = Math.pow(distance / 700, 1.5);
        var scale = Math.max(0.45, 1.10 - t * 0.65);
        // Width-based sizing — layout box matches visual size,
        // so adjacent tiles are flush. The inner .poster-link
        // has aspect-ratio: 2/3, so the image stays 2:3 at
        // every width. No transform, no z-index, no margin
        // needed.
        item.style.width = (itemWidth * scale) + "px";
      }
    }

    // ─── Resize handler ───
    // The viewport width changes on resize; the first item
    // needs to be re-centered. v3.14.66: no more
    // wall.style.transform — the per-tile frame loop will
    // pick up the new scrollX on its next iteration.
    function onResize() {
      var newItemWidth = wall.querySelectorAll(":scope > li")[totalClonesBefore].offsetWidth;
      if (newItemWidth !== itemWidth) {
        itemWidth = newItemWidth;
        oneSetWidth = itemCount * itemWidth;
        cloneSetWidth = totalClonesBefore * itemWidth;
      }
      // Re-center the first original item at the viewport
      // center. The centering math is unchanged from the
      // track-translate world: it just gives us the scrollX
      // value that places the first original at
      // (window.innerWidth / 2). The frame loop will then
      // apply the per-tile wrap, which is a no-op for the
      // first original (its visualPos equals offsetLeft, so
      // its transform is 0).
      var firstOrig = wall.querySelectorAll(":scope > li")[totalClonesBefore];
      var wallLeft = wall.getBoundingClientRect().left;
      var centerOffset = (window.innerWidth / 2) - wallLeft - firstOrig.offsetLeft - (firstOrig.offsetWidth / 2);
      // Preserve the user's current relative offset, then
      // re-anchor to the new center.
      var relOffset = scrollX - centerOffset;
      scrollX = centerOffset + relOffset;
      targetScrollX = scrollX;
      ensureAnimating();
    }
    window.addEventListener("resize", onResize);

    console.info("[poster-wall] carousel:",
      itemCount, "originals +", (clonesAfter.length + clonesAfter2.length), "clones after +",
      totalClonesBefore, "clones before =",
      wall.querySelectorAll(":scope > li").length, "total tiles (2 buffer sets on each side, wrap offscreen)");

    // v3.14.52: After initial transform, log the actual
    // visual position of the first ORIGINAL tile so we can
    // see if it landed in the viewport (centered) or
    // somewhere off-screen.
    setTimeout(function () {
      var firstOrig = wall.querySelectorAll(":scope > li")[totalClonesBefore];
      var rect = firstOrig.getBoundingClientRect();
      var center = (rect.left + rect.right) / 2;
      var dist = Math.abs(center - window.innerWidth / 2);
      console.info("[poster-wall] first original tile:",
        "left", Math.round(rect.left), "right", Math.round(rect.right),
        "center", Math.round(center),
        "viewport center", Math.round(window.innerWidth / 2),
        "distance", Math.round(dist),
        "scale", firstOrig.style.transform || "(none)");
    }, 200);
  }

  // v3.14.43: WAVE / CURVE layout for desktop (≥768px).
  // Tarek: "on pc i think we'll do another style of carrousel,
  // could we do the style were the films act as a wave? so
  // there is only one pick thats the middle film and the
  // others do a curve smalling themselfs when going from the
  // center to the sides".
  //
  // How it works: on every scroll, calculate each tile's
  // distance from the viewport center. Apply a transform
  // based on that distance:
  //   - scale: 1.0 at center, 0.5 at the edges (linear falloff)
  //   - translateY: 0 at center, 60px at the edges
  // The center item is the "picked" one (largest, no Y offset).
  // Items to the sides get smaller and sink lower, creating a
  // v3.14.48: REMOVED setupWave entirely. The coverflow scale
  // animation is now done with CSS scroll-driven animations
  // (view-timeline) in sections.css — no JavaScript scroll
  // listener updating transforms on every frame. The browser
  // tracks each tile's position in the scroll container
  // natively and interpolates the scale smoothly. This is the
  // standard pattern, learned from addyosmani.com/blog/coverflow
  // and the scroll-driven-animations.style demos.

  return {
    loadData,
    render: () => loadData().then(renderFromState),
    setupClick,
    setupCarousel: setupCarousel
  };
})();

/* ──────────────── Film detail modal (v3.11.0) ──────────────── */
/* Opens when a poster tile fires `tarek:film-open { filmId }`
   (see POSTER_WALL above). Pulls the film row from films.json
   and resolves the people ids (director / dop / gaffer /
   electrics) against people.json. The production field is
   already company names, not ids, so it renders as-is. Crew
   rows with no data are hidden. The modal sets a `#film-<id>`
   hash on open and clears it on close so deep links work and
   the browser back button closes the modal. Closes on X click,
   ESC, backdrop click, or the "← All projects" back link. */

const FILM_MODAL = (() => {
  // ─── Inline-first data loader (file:// compatibility) ────────────────
  const BLOCKS = [
    { src: "data/films.json",  inline: "tarek-films"  },
    { src: "data/people.json", inline: "tarek-people" },
    { src: "data/jobs.json",   inline: "tarek-jobs"   },
    { src: "data/work.json",   inline: "tarek-work"   }  // v3.14.34: ordered list for prev/next
  ];

  function readInline(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); }
    catch (err) { console.warn(`[film-modal] inline #${id} parse failed:`, err); return null; }
  }

  async function loadBlock(block) {
    const inline = readInline(block.inline);
    if (inline) return inline;
    try {
      const res = await fetch(block.src, { cache: "no-store" });
      return await res.json();
    } catch (err) {
      console.warn(`[film-modal] failed to load ${block.src}:`, err);
      return null;
    }
  }

  let filmsById = null;
  let peopleById = null;
  let jobsById = null;
  let modal = null;
  // v3.14.34: ordered list of film ids that have a poster (mirrors
  // the work section's display order). Powers the prev/next buttons
  // and the "2 of 13" position indicator. Built once after data loads.
  let orderedFilmIds = [];
  let currentIndex = -1;

  async function loadData() {
    const [films, people, jobs, work] = await Promise.all(BLOCKS.map(loadBlock));
    if (!films || !people) return false;
    filmsById = {};
    for (const f of (films.films || [])) filmsById[f.id] = f;
    peopleById = {};
    for (const p of (people.people || [])) peopleById[p.id] = p;
    jobsById = {};
    for (const j of (jobs?.jobs || [])) jobsById[j.id] = j;

    // v3.14.34: build the ordered list from work.json rows, skipping
    // films without a poster (matches the poster wall's filter — the
    // user shouldn't be able to navigate to a film they can't see).
    orderedFilmIds = [];
    if (work && Array.isArray(work.rows)) {
      for (const row of work.rows) {
        if (!row || !row.filmId) continue;
        const film = filmsById[row.filmId];
        if (film && film.poster) orderedFilmIds.push(film.id);
      }
    }
    return true;
  }

  // ─── Rendering helpers ────────────────────────────────────────────────
  function escapeText(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // v3.14.18: credits.people[].jobId points at the Jobs
  // collection. Map each jobId to one of the modal's 4 rows.
  // The job's category is preserved in the data; the UI bucketing
  // is by jobId so "gaffer" stays separate from "electric" /
  // "sparks" / "best-boy-electric". The role name appears in
  // parens next to the person when there are multiple credits
  // in the same row (e.g. "Juli Carné Martorell (Camera Operator)").
  const JOBID_TO_ROW = {
    director:               "director",
    "assistant-director":   "director",
    dop:                    "dop",
    "camera-operator":      "dop",
    "1st-ac":               "dop",
    "2nd-ac":               "dop",
    gaffer:                 "gaffer",
    "best-boy-electric":    "electrics",
    electric:               "electrics",
    sparks:                 "electrics",
    // sound / production / other: no UI row yet — would need a row
  };
  function groupCrewByRow(people) {
    const out = { director: [], dop: [], gaffer: [], electrics: [] };
    for (const credit of people || []) {
      const row = JOBID_TO_ROW[credit.jobId];
      if (!row) continue;
      const job = jobsById?.[credit.jobId];
      const personName = peopleById[credit.personId]?.name || credit.personId;
      const jobName = job?.name?.en || credit.jobId;
      // If the row already has this person, append the job name.
      const existing = out[row].find((c) => c.personId === credit.personId);
      if (existing) {
        existing.jobs.push(jobName);
      } else {
        out[row].push({ personId: credit.personId, name: personName, jobs: [jobName] });
      }
    }
    return out;
  }
  function renderCrewRow(arr) {
    if (!arr || !arr.length) return renderList(null);
    // "Name" when one job, "Name (job1, job2)" when multiple.
    const lines = arr.map((c) => {
      const jobs = c.jobs.length > 1 ? ` (${c.jobs.join(", ")})` : "";
      return `${c.name}${jobs}`;
    });
    return renderList(lines);
  }

  function renderList(arr) {
    if (!arr || !arr.length) {
      // Empty: render a single muted dash. The row's hidden-state
      // is set in renderCrewRows() so the whole dt/dd pair disappears
      // when there's nothing to show.
      return `<span class="film-modal__no-credits">—</span>`;
    }
    return arr.map((name) => `<span class="film-modal__chip">${escapeText(name)}</span>`).join("");
  }

  // ─── Open / close ────────────────────────────────────────────────────
  function open(filmId, opts) {
    opts = opts || {};
    const film = filmsById && filmsById[filmId];
    if (!film) {
      console.warn(`[film-modal] no film with id "${filmId}"`);
      return;
    }
    if (!modal) return;

    // Title + meta
    const titleEl = document.getElementById("film-modal-title");
    titleEl.textContent = film.title || "Untitled";

    const yearEl = document.getElementById("film-modal-year");
    yearEl.textContent = film.year ? String(film.year) : "";
    yearEl.hidden = !film.year;

    const typeEl = document.getElementById("film-modal-type");
    typeEl.textContent = film.type || "";
    typeEl.hidden = !film.type;

    // "Role on set" — Tarek's own credit on this film
    const roleRow = document.getElementById("film-modal-role-row");
    if (film.role) {
      document.getElementById("film-modal-role").textContent = film.role;
      roleRow.hidden = false;
    } else {
      roleRow.hidden = true;
    }

    // Poster
    const poster = document.getElementById("film-modal-poster");
    if (film.poster) {
      poster.src = film.poster;
      poster.alt = film.title ? `${film.title} poster` : "Film poster";
      poster.hidden = false;
    } else {
      poster.removeAttribute("src");
      poster.alt = "";
      poster.hidden = true;
    }

    // Crew rows
    // v3.14.18: credits.people[].jobId → Jobs collection, then
    // bucketed by the job's category into one of 4 UI rows.
    const credits = film.credits || {};
    const grouped = groupCrewByRow(credits.people);
    document.getElementById("film-modal-production").innerHTML = renderList(credits.production);
    document.getElementById("film-modal-director").innerHTML  = renderCrewRow(grouped.director);
    document.getElementById("film-modal-dop").innerHTML       = renderCrewRow(grouped.dop);
    document.getElementById("film-modal-gaffer").innerHTML    = renderCrewRow(grouped.gaffer);
    document.getElementById("film-modal-electrics").innerHTML = renderCrewRow(grouped.electrics);

    // Hide whole dt/dd pairs that have no data, so we don't show
    // empty "Director: —" lines for films where that field is empty.
    modal.querySelectorAll("[data-film-field]").forEach((row) => {
      const dd = row.querySelector("dd");
      const isEmpty = !dd.textContent.trim() || dd.querySelector(".film-modal__no-credits");
      row.hidden = !!isEmpty;
    });

    // Show
    modal.classList.add("film-modal--open");
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("film-modal-open");

    // v3.14.34: track which film is open, update the position
    // indicator + prev/next button states.
    currentIndex = orderedFilmIds.indexOf(filmId);
    updatePosition();
    updateNavButtons();

    // v3.14.41: no more slide-in animation. The user said
    // "don't do wierd animations between the first or last
    // i has to be all the same" — every film swap is instant,
    // no slide, no fade. Just swap the content.

    // v3.14.39: no more auto-cycle. The user navigates manually
    // with prev/next (which wrap last→first and first→last).
    // Tarek: "i don't want the films to be animated, the user
    // is the one that scrolls them".

    // Focus the close button so ESC and Tab work from the keyboard.
    const closeBtn = modal.querySelector(".film-modal__close");
    if (closeBtn) closeBtn.focus({ preventScroll: true });

    // v3.14.35: history handling — pushState on the INITIAL open
    // (so browser back closes the modal), replaceState on every
    // subsequent in-modal navigation (so the history chain stays
    // 1 deep and close()'s history.back() = exit, not "previous
    // film"). The deep-link case (loaded with #film-…) also uses
    // replaceState so we don't end up with a push on top of the
    // page-load entry.
    if (window.location.hash !== `#film-${filmId}`) {
      if (opts.replaceHistory) {
        window.history.replaceState({ filmModal: filmId }, "", `#film-${filmId}`);
      } else {
        window.history.pushState({ filmModal: filmId }, "", `#film-${filmId}`);
      }
    }
  }

  // v3.14.34: "Selected Work 2 of 13" — the Paramount+ style
  // position indicator at the top of the modal.
  function updatePosition() {
    const el = document.getElementById("film-modal-position");
    if (!el) return;
    if (currentIndex < 0 || orderedFilmIds.length === 0) {
      el.textContent = "";
    } else {
      el.textContent = "Selected Work " + (currentIndex + 1) + " of " + orderedFilmIds.length;
    }
  }

  // v3.14.40: prev/next are ALWAYS clickable. The carousel wraps
  // (navigate() uses modulo), so the user can press ←/→ infinitely
  // in either direction. Disabling the buttons at the ends was the
  // bug that made the modal "stop" after the user reached the last
  // film — the button grayed out and clicks no longer fired.
  function updateNavButtons() {
    const prev = modal?.querySelector("[data-film-modal-prev]");
    const next = modal?.querySelector("[data-film-modal-next]");
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
  }

  // v3.14.35: navigate uses replaceState (not pushState) so the
  // history chain doesn't grow as the user walks through films.
  // Before this, open() always pushed, so each prev/next added an
  // entry, and close()'s history.back() only undid ONE step —
  // meaning the user had to click close N times to fully exit.
  // Now: the initial open pushes (so back closes the modal),
  // but each in-modal nav replaces (so the chain stays 1 deep
  // and close() = one back = exit).
  function navigate(delta) {
    if (currentIndex < 0) return;
    // v3.14.39: wrap at the ends. Going past the last film
    // lands on the first; going past the first (←) lands on
    // the last. This is the "perpetual carousel" the user
    // wants — you can keep going in either direction.
    const n = orderedFilmIds.length;
    if (n < 2) return;
    const target = ((currentIndex + delta) % n + n) % n;
    open(orderedFilmIds[target], { replaceHistory: true });
  }

  // v3.14.39: removed the auto-cycle machinery. The user
  // navigates manually with prev/next. No more setInterval,
  // no more resetCycle, no more touchstart/mousedown listeners.

  function close() {
    if (!modal || !modal.classList.contains("film-modal--open")) return;
    modal.classList.remove("film-modal--open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("film-modal-open");

    // v3.14.41: just clear the hash directly with replaceState.
    // Previously used history.back() to "undo" the pushState from
    // open(), but that fired popstate, which checked the URL hash
    // and re-opened the modal if the previous state still had a
    // #film-… (e.g. user opened a film, then prev/next'd to a
    // different one, then clicked close — back() landed on the
    // first-opened film's URL and the popstate handler re-opened
    // it). replaceState doesn't fire popstate, so the modal
    // closes cleanly in one click.
    if (window.location.hash.startsWith("#film-")) {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    // v3.14.35: thanks to replaceState on every in-modal nav, the
    // history chain is always exactly 1 deep while the modal is
    // open (the initial push). So history.back() always takes us
    // back to the pre-modal state, regardless of how many prev/next
    // clicks happened. The deep-link case (page loaded with #film-…)
    // is handled by the init() block which uses replaceState too,
    // so the state.filmModal marker is never set for deep links.
    if (window.location.hash.startsWith("#film-")) {
      if (window.history.state && window.history.state.filmModal) {
        window.history.back();
      } else {
        // Deep-link or already-closed state: just clear the hash
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
      }
    }
  }

  // ─── Listeners ───────────────────────────────────────────────────────
  function setupListeners() {
    modal = document.getElementById("film-modal");
    if (!modal) {
      console.warn("[film-modal] #film-modal not found in DOM");
      return;
    }

    // Close on backdrop / close button / "← All projects" link
    modal.addEventListener("click", (ev) => {
      const closer = ev.target.closest("[data-film-modal-close]");
      if (closer) {
        ev.preventDefault();
        close();
        return;
      }
      // v3.14.34: prev/next nav
      if (ev.target.closest("[data-film-modal-prev]")) {
        ev.preventDefault();
        navigate(-1);
        return;
      }
      if (ev.target.closest("[data-film-modal-next]")) {
        ev.preventDefault();
        navigate(+1);
        return;
      }
    });

    // Keyboard: ESC closes, ←/→ navigate between films
    document.addEventListener("keydown", (ev) => {
      if (!modal.classList.contains("film-modal--open")) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        close();
      } else if (ev.key === "ArrowLeft") {
        ev.preventDefault();
        navigate(-1);
      } else if (ev.key === "ArrowRight") {
        ev.preventDefault();
        navigate(+1);
      }
    });

    // tarek:film-open from POSTER_WALL (or anywhere else)
    window.addEventListener("tarek:film-open", (ev) => {
      if (ev.detail && ev.detail.filmId) open(ev.detail.filmId);
    });

    // Browser back/forward: open/close based on the hash
    window.addEventListener("popstate", () => {
      const hash = window.location.hash;
      if (hash.startsWith("#film-") && filmsById) {
        const filmId = hash.slice("#film-".length);
        if (filmsById[filmId]) open(filmId);
        else close();
      } else {
        close();
      }
    });
  }

  // ─── Boot ────────────────────────────────────────────────────────────
  async function init() {
    setupListeners();
    const ok = await loadData();
    if (!ok) return;

    // If the page was loaded with a deep link, open the modal.
    const hash = window.location.hash;
    if (hash.startsWith("#film-")) {
      const filmId = hash.slice("#film-".length);
      if (filmsById[filmId]) {
        // pushState a marker so close() knows this was the page-load
        // entry, not one we pushed.
        window.history.replaceState({ filmModal: filmId, deepLink: true }, "", hash);
        open(filmId);
      }
    }
  }

  return { init, open, close };
})();

/* ──────────────── Scroll indicator ──────────────── */
/* REMOVED 2026-07-27 per Buddie: "the scrollbar thing is annoying".
   The previous version was a left/right vertical light beam with a moving
   lens-flare hot spot. The native scrollbar will be visible instead. */

