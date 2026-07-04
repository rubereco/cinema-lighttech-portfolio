/* ════════════════════════════════════════════════════════════════════════
   main.js — theme toggle, mobile nav, language toggle, kit filter.
   One file, no build, no dependencies.
   ════════════════════════════════════════════════════════════════════════ */

/* ──────────────── i18n: load + apply translations ──────────────── */

const I18N = (() => {
  const STORAGE_KEY = "tarek.lang";
  let strings = null;

  async function load() {
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

/* ──────────────── Theme toggle ──────────────── */

function setupThemeToggle() {
  const STORAGE_KEY = "tarek.theme";
  const THEMES = {
    tungsten:  { css: "assets/css/tungsten.css",  label: { en: "Tungsten",  es: "Tungsteno"  } },
    anamorphic:{ css: "assets/css/anamorphic.css", label: { en: "Anamorphic", es: "Anamorfico" } },
  };

  const cssLink   = document.getElementById("theme-css");
  const toggleBtn = document.querySelector("[data-theme-toggle]");
  const labelEl   = document.querySelector("[data-theme-label]");
  if (!cssLink || !toggleBtn) return;

  const order = ["tungsten", "anamorphic"];

  function currentTheme() {
    return document.documentElement.dataset.theme || "tungsten";
  }

  function applyTheme(name) {
    const theme = THEMES[name];
    if (!theme) return;
    cssLink.setAttribute("href", theme.css);
    document.documentElement.dataset.theme = name;
    try { localStorage.setItem(STORAGE_KEY, name); } catch {}
    if (labelEl) {
      const lang = document.documentElement.lang || "en";
      labelEl.textContent = theme.label[lang] || theme.label.en;
    }
  }

  // Restore saved theme (or default)
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch {}
  if (saved && THEMES[saved]) applyTheme(saved);

  // Click cycles through themes
  toggleBtn.addEventListener("click", () => {
    const idx = order.indexOf(currentTheme());
    const next = order[(idx + 1) % order.length];
    applyTheme(next);
  });
}

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
      // re-apply theme so its label also updates to the new language
      setupThemeToggleRefresh();
    });
  });
}

/* Re-apply current theme (so labels update with language change). */
function setupThemeToggleRefresh() {
  const STORAGE_KEY = "tarek.theme";
  const saved = (() => { try { return localStorage.getItem(STORAGE_KEY); } catch { return null; } })();
  const name = saved || document.documentElement.dataset.theme || "tungsten";
  const labelEl = document.querySelector("[data-theme-label]");
  if (!labelEl) return;
  const labels = { tungsten: { en: "Tungsten", es: "Tungsteno" }, anamorphic: { en: "Anamorphic", es: "Anamorfico" } };
  const lang = document.documentElement.lang || "en";
  labelEl.textContent = labels[name]?.[lang] || labels[name]?.en || name;
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

  setupThemeToggle();
  setupMobileNav();
  setupLanguageToggle();
  setupKitFilter();
  setupYearStamp();

  // Signal sibling scripts that i18n is ready (showcase.js listens for this).
  window.dispatchEvent(new CustomEvent("tarek:i18n-ready", { detail: { lang } }));
})();