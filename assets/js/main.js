/* ════════════════════════════════════════════════════════════════════════
   main.js — theme toggle, mobile nav, language toggle, kit filter.
   One file, no build, no dependencies.
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

// Expose for sibling scripts (e.g. showcase.js) so they can read translations
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
      // Notify sibling scripts (showcase.js, partners.js) that the active
      // language changed so they can re-render dynamic content.
      window.dispatchEvent(new CustomEvent("tarek:i18n-change", { detail: { lang } }));
    });
  });
}

/* ──────────────── Kit filter (one category at a time) ──────────────── */

function setupKitFilter() {
  const pills = document.querySelectorAll(".kit-pill");
  const items = document.querySelectorAll(".kit-item");
  if (!pills.length || !items.length) return;

  pills.forEach((pill) => {
    pill.addEventListener("click", () => {
      const cat = pill.dataset.cat;

      pills.forEach((p) => {
        const active = p === pill;
        p.classList.toggle("is-active", active);
        p.setAttribute("aria-selected", active ? "true" : "false");
      });

      items.forEach((item) => {
        const show = cat === "all" || item.dataset.cat === cat;
        item.style.display = show ? "" : "none";
      });
    });
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
  setupKitFilter();
  setupYearStamp();
  setupHeaderScroll();
  setupSectionChrome();

  // Render the poster wall (work.json × films.json) after data is ready.
  POSTER_WALL.render();
  POSTER_WALL.setupClick();

  // Signal sibling scripts that i18n is ready (showcase.js listens for this).
  window.dispatchEvent(new CustomEvent("tarek:i18n-ready", { detail: { lang } }));
})();

/* ──────────────── Section chrome: sticky-in-section links ──────────────── */
/* The bottom-left IMDb link + bottom-right "next section" arrow dock to the
   viewport bottom while the user is reading #work. Once the user scrolls past
   the section's natural bottom, the chrome "lets go" and snaps to the section's
   bottom edge — so it never floats over #about's heading.

   Pattern (Snapchat / iOS Safari toolbar style):
   1. Chrome is `position: fixed` at the viewport bottom (always reachable).
   2. A scroll listener tracks the section's bottom edge in viewport space.
   3. When the section's bottom is still below the viewport bottom + offset,
      chrome stays fixed.
   4. When the section's bottom reaches the chrome's resting position, we
      switch to `position: absolute` anchored to the section's bottom edge.

   The fade-in/out is still driven by IntersectionObserver (with a tighter
   rootMargin now: the chrome fades out the moment the section leaves the
   viewport entirely). */

function setupSectionChrome() {
  const section = document.getElementById("work");
  if (!section) return;

  // The chrome element lives inside the section (so absolute positioning
  // resolves to the section). If not present, this page doesn't have the
  // affordance (e.g. partners.html).
  const chrome = section.querySelector(".section-chrome");
  if (!chrome) return;

  // Visibility toggle: chrome is visible whenever ANY part of the section is
  // in the viewport. Default rootMargin (`0px` on all sides) is correct here.
  // Previous version used `rootMargin: "0px 0px -100% 0px"` which shrank the
  // observer root to a zero-height strip at the top of the viewport — the
  // intersection condition was virtually impossible to satisfy on tall
  // sections (tablet/desktop), so the chrome never appeared.
  //
  // We do NOT need to fade when the section leaves the viewport: the
  // dock-then-snap pattern below moves the chrome to `position: absolute;
  // bottom: 0` once the section's bottom reaches the resting line, and the
  // chrome scrolls out of view with the section naturally.
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.target === section) {
          section.classList.toggle("is-visible", entry.isIntersecting);
        }
      }
    },
    { threshold: 0 }
  );
  io.observe(section);

  // ── dock-to-bottom / snap-to-section-bottom ──
  //
  // The chrome "rides" the section: it stays fixed at the viewport bottom
  // (so it's reachable) while the user is scrolling through #work, then
  // snaps to the section's natural bottom edge (`position: absolute`) once
  // the section has scrolled mostly past.
  //
  // The trick: snap when the section's bottom has entered the BOTTOM 20%
  // of the viewport, NOT when it crosses `viewport - restingPx`.
  //
  // Why: on tall sections (tablet portrait, mobile), the section can be
  // 1.5–7x taller than the viewport. Using `viewport - restingPx` as the
  // snap line would only fire in the literal last few pixels of scroll —
  // users would never see the snap effect, the chrome would feel static.
  // Using a percentage-based line (bottom 20% of viewport) gives the user
  // a visible window where they can see the chrome anchored to the section
  // as it scrolls out.
  const restingPx = 56;
  const snapZoneFraction = 0.80;   // section.bottom must drop into the bottom 20% of viewport

  function update() {
    const rect = section.getBoundingClientRect();
    const viewportH = window.innerHeight;
    const snapLine = viewportH * snapZoneFraction;

    if (rect.bottom <= snapLine) {
      // Section is mostly scrolled past — chrome snaps to section's bottom edge
      // and rides out of view naturally with the section.
      chrome.style.position = "absolute";
      chrome.style.bottom = "0";
      chrome.style.left = "0";
      chrome.style.right = "0";
    } else {
      // Section still ahead of us or mid-scroll — chrome docks to viewport bottom.
      chrome.style.position = "fixed";
      chrome.style.bottom = restingPx + "px";
      chrome.style.left = "0";
      chrome.style.right = "0";
    }
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    // Double-rAF: ensure layout has reflowed before measuring. When DevTools
    // switches device emulation modes, `resize` can fire before the layout
    // has settled, so `getBoundingClientRect()` may return stale geometry
    // on the first frame. The second rAF defers to a frame after the
    // browser has had a chance to apply the new layout.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      update();
      ticking = false;
    }));
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll, { passive: true });
  // Chrome DevTools device emulation can change the viewport without firing
  // `resize` reliably (or fires it before the layout has reflowed), so hook
  // every other viewport-change signal we can. visualViewport fires for
  // pinch-zoom and on-screen keyboard; orientationchange fires on rotation;
  // the matchMedia listeners fire when the viewport crosses one of our CSS
  // breakpoints (where the section height changes discontinuously).
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", onScroll);
  }
  window.addEventListener("orientationchange", onScroll);
  for (const bp of [560, 720, 900, 1024]) {
    const mql = window.matchMedia(`(min-width: ${bp}px)`);
    if (mql.addEventListener) mql.addEventListener("change", onScroll);
    else mql.addListener(onScroll);   // Safari < 14
  }
  update();
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
          <img class="poster-img" src="assets/projects/${escapeAttr(slug)}/poster.jpg"
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
    // Click delegation (matches the showcase pattern)
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

  return {
    loadData,
    render: () => { loadData().then(renderFromState); },
    setupClick
  };
})();

/* ──────────────── Scroll indicator ──────────────── */
/* REMOVED 2026-07-27 per Buddie: "the scrollbar thing is annoying".
   The previous version was a left/right vertical light beam with a moving
   lens-flare hot spot. The native scrollbar will be visible instead. */

