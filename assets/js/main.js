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
  POSTER_WALL.render();
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
    { src: "data/jobs.json",   inline: "tarek-jobs"   }
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

  async function loadData() {
    const [films, people, jobs] = await Promise.all(BLOCKS.map(loadBlock));
    if (!films || !people) return false;
    filmsById = {};
    for (const f of (films.films || [])) filmsById[f.id] = f;
    peopleById = {};
    for (const p of (people.people || [])) peopleById[p.id] = p;
    jobsById = {};
    for (const j of (jobs?.jobs || [])) jobsById[j.id] = j;
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
  function open(filmId) {
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

    // Focus the close button so ESC and Tab work from the keyboard.
    const closeBtn = modal.querySelector(".film-modal__close");
    if (closeBtn) closeBtn.focus({ preventScroll: true });

    // Push the hash for deep linking. Use pushState so browser back
    // closes the modal instead of leaving the page.
    if (window.location.hash !== `#film-${filmId}`) {
      window.history.pushState({ filmModal: filmId }, "", `#film-${filmId}`);
    }
  }

  function close() {
    if (!modal || !modal.classList.contains("film-modal--open")) return;
    modal.classList.remove("film-modal--open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("film-modal-open");

    // Pop the hash. If the user landed on a deep link, replaceState
    // (don't push) so back goes to the previous page, not "open then
    // close the modal". Otherwise, push a null state so back closes
    // the modal gracefully.
    if (window.location.hash.startsWith("#film-")) {
      // Did the user land here with this hash already? If so, the
      // history entry is the page-load one — replace it. Otherwise
      // we pushed it on open, so go back one to undo.
      // Simpler heuristic: if history.state has filmModal, we
      // pushed it; otherwise it was the page-load entry.
      if (window.history.state && window.history.state.filmModal) {
        window.history.back();
      } else {
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
      }
    });

    // ESC closes
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "Escape" && modal.classList.contains("film-modal--open")) {
        ev.preventDefault();
        close();
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

