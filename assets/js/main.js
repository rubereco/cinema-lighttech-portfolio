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
  // v3.14.42: setupLoop() must run AFTER render() completes,
  // because render() is async (loads data → writes to DOM). If we
  // called setupLoop() synchronously, it would see 0 tiles and
  // bail — no clones, no wrap, no revolver. Chaining to the
  // promise guarantees the tiles exist when setupLoop() runs.
  POSTER_WALL.render().then(() => POSTER_WALL.setupLoop());
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

  // v3.14.42: REVOLVER MAGAZINE layout. Tarek: "i just want the
  // first and the last to be the same as all the other ones,
  // to put an example i want it like the magazine of a revolver
  // when you stop it you don't know where it is it can be the
  // first the last or the middle slot. So for that what we
  // need to make it that way is when im on the first i have to
  // be able to see the little side of the last one from the
  // left and see the second one from the right side. don't
  // do wierd animations between the first or last i has to be
  // all the same".
  //
  // How it works: clone the first and last tiles, stick the
  // clone of the LAST at the BEGINNING and the clone of the
  // FIRST at the END. The wall now looks like:
  //
  //   [L_clone] [A] [B] [C] ... [K] [L] [A_clone]
  //
  // The user starts scrolled so A is fully visible with
  // L_clone peeking on the left and B peeking on the right.
  // This is the SAME view as any middle tile — every poster
  // has neighbors on both sides. The user can't tell they're
  // on the "first" because the layout looks identical to
  // being on any other poster.
  //
  // When the user scrolls past L (right edge, showing A_clone),
  // the wrap is INSTANT: scrollLeft jumps to the position
  // where A is fully visible with L_clone peeking. The user
  // sees the same view 1 frame later — visually identical.
  // They can keep scrolling right indefinitely.
  //
  // Same for the left edge: scroll past A (scrollLeft <= 0,
  // showing L_clone), instant jump to L's position where L
  // is fully visible with A_clone peeking on the right.
  //
  // v3.14.42 fix: previously this had the same race condition
  // as setupMarquee (v3.14.37) — called synchronously after
  // render(), but render() is async, so setupLoop() saw 0
  // tiles and bailed. The init block now chains setupLoop()
  // to render()'s promise so the tiles are guaranteed to
  // exist before the clones are added.
  //
  // v3.14.42 also removed scroll-snap from the wall — with
  // snap, the tiles would always align to the left edge and
  // the clones would always be hidden. Without snap, the
  // user can stop scrolling at any position and see the
  // neighbors peeking on both sides.
  function setupLoop() {
    var wall = document.getElementById("poster-wall");
    if (!wall) {
      console.warn("[poster-wall] #poster-wall not found");
      return;
    }
    var tiles = wall.querySelectorAll(":scope > li");
    if (tiles.length < 2) {
      console.warn("[poster-wall] need at least 2 tiles, got", tiles.length);
      return;
    }

    // Clone first and last, mark them so we can identify them.
    var firstClone = tiles[0].cloneNode(true);
    var lastClone  = tiles[tiles.length - 1].cloneNode(true);
    firstClone.classList.add("poster-wall__clone");
    lastClone.classList.add("poster-wall__clone");

    // Insert the last-clone at the beginning, append the
    // first-clone at the end. Order is now:
    //   [L_clone, A, B, ..., K, L, A_clone]
    wall.insertBefore(lastClone, tiles[0]);
    wall.appendChild(firstClone);

    // Start scrolled so A is fully visible with L_clone
    // peeking on the left. We scroll past L_clone by 85%
    // of its width, leaving 15% (~40px) peeking on the left.
    // Tarek: "i have to be able to see the little side of
    // the last one from the left and see the second one from
    // the right side".
    var peek = Math.round(tiles[0].offsetWidth * 0.15);
    wall.scrollLeft = tiles[0].offsetLeft - peek;
    console.info("[poster-wall] revolver:",
      tiles.length, "tiles + 2 clones,",
      "A at", tiles[0].offsetLeft, "px,",
      "L_clone peek", peek, "px,",
      "scrollLeft", wall.scrollLeft, "px");

    // Wrap behavior: instant jump when the user scrolls past
    // either edge. No animation, no transition. The _warping
    // flag prevents the scroll event fired by the jump itself
    // from triggering another jump.
    wall.addEventListener("scroll", function () {
      if (wall._warping) return;

      // Past the right edge (showing A_clone): jump to the
      // starting position (A with L_clone peeking).
      if (wall.scrollLeft + wall.clientWidth >= wall.scrollWidth - 2) {
        wall._warping = true;
        wall.scrollLeft = tiles[0].offsetLeft - peek;
        setTimeout(function () { wall._warping = false; }, 50);
        return;
      }

      // Past the left edge (showing L_clone): jump to the
      // ending position (L with A_clone peeking).
      if (wall.scrollLeft <= 0) {
        wall._warping = true;
        wall.scrollLeft = tiles[tiles.length - 1].offsetLeft - peek;
        setTimeout(function () { wall._warping = false; }, 50);
        return;
      }
    }, { passive: true });
  }

  return {
    loadData,
    render: () => loadData().then(renderFromState),
    setupClick,
    setupLoop: setupLoop
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

