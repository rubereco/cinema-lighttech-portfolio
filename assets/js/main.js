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
      // Notify sibling scripts (showcase.js, partners.js) that the active
      // language changed so they can re-render dynamic content.
      window.dispatchEvent(new CustomEvent("tarek:i18n-change", { detail: { lang } }));
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
  setupPageBeams();
  setupLensFlares();

  // Signal sibling scripts that i18n is ready (showcase.js listens for this).
  window.dispatchEvent(new CustomEvent("tarek:i18n-ready", { detail: { lang } }));
})();

/* ──────────────── Page beams (main page only) ──────────────── */

/**
 * Two soft white rays rotate to point at the section currently centered
 * in the viewport. The source of each beam is off-screen (left or right
 * edge); only the beam itself is visible. The beam rotates around the
 * source edge so the bright end stays anchored and the faded end tracks
 * the active section.
 *
 * Math:
 *   - Left beam:  default direction = 0° (pointing right).
 *     Rotation = atan2(targetY − sourceY, targetX − sourceX) in degrees.
 *   - Right beam: default direction = 180° (pointing left).
 *     Rotation = atan2(targetY − sourceY, targetX − sourceX) − 180°.
 *
 * The page-beams container only exists on index.html, so this is a no-op
 * on showcase.html / partners.html.
 */
function setupPageBeams() {
  const container = document.querySelector(".page-beams");
  if (!container) return;

  const leftBeam  = container.querySelector(".page-beam--left");
  const rightBeam = container.querySelector(".page-beam--right");
  if (!leftBeam || !rightBeam) return;

  const sections = Array.from(document.querySelectorAll("main section[id]"));
  if (!sections.length) return;

  lastActive = null;
  let activeSection = null;
  let rafId = null;

  function update() {
    rafId = null;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const centerY = viewportH / 2;

    // Pick the section whose center is closest to the viewport's vertical center.
    let best = sections[0];
    let bestDist = Infinity;
    for (const section of sections) {
      const r = section.getBoundingClientRect();
      const distance = Math.abs((r.top + r.height / 2) - centerY);
      if (distance < bestDist) {
        bestDist = distance;
        best = section;
      }
    }

    if (best !== activeSection) {
      activeSection = best;
      leftBeam.classList.add("is-active");
      rightBeam.classList.add("is-active");
    }

    const rect = best.getBoundingClientRect();
    const targetX = rect.left + rect.width / 2;
    const targetY = rect.top + rect.height / 2;

    // Source positions: at the off-screen left and right edges, at centerY.
    const sourceY = centerY;
    // Both beams rotate around their respective edges so the bright source
    // stays at the edge and the beam swings inward toward the target.
    //
    // atan2(y, x) has a discontinuity at y = 0 when x < 0 (jumps from +180
    // to -180 and back), which caused the right beam to do a full 360
    // loop when the target crossed the beam's horizontal axis. Fix: flip
    // the x-component so it's always positive for the right beam, putting
    // the angle in (-90, +90) with no discontinuity. Then NEGATE the angle
    // because the right beam's rotation origin is on the right edge — the
    // same numerical angle would rotate the strip in the opposite visual
    // direction (the right edge's frame is mirrored from the left's).
    const leftAngle  = Math.atan2(targetY - sourceY, targetX)              * 180 / Math.PI;
    const rightAngle = -Math.atan2(targetY - sourceY, viewportW - targetX) * 180 / Math.PI;

    leftBeam.style.setProperty("--angle",  `${leftAngle.toFixed(2)}deg`);
    rightBeam.style.setProperty("--angle", `${rightAngle.toFixed(2)}deg`);
  }

  function onScroll() {
    if (rafId === null) rafId = requestAnimationFrame(update);
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  update();
}

/* ──────────────── Lens flares (main page only) ──────────────── */

/**
 * Small warm-white flares that bloom in and fade out as the user scrolls.
 * Triggered by scroll events; pool of 6 reusable elements, max 3 active at
 * any time. Random position, rotation, and size so the pattern never
 * repeats. The .lens-flares container only exists on index.html, so this
 * is a no-op on showcase.html / partners.html.
 *
 * Lifecycle per flare (driven by CSS classes):
 *   1. JS sets --x, --y, --rot, data-size (random per spawn)
 *   2. Add .is-active → CSS blooms opacity 0→1 and scale 0.25→1 (~520ms)
 *   3. After BLOOM_MS + HOLD_MS, replace .is-active with .is-fading
 *      → CSS fades opacity 1→0 and grows scale 1→1.35 (~900ms)
 *   4. Total lifetime ≈ 1.7s; flare is then available in the pool again.
 *
 * Throttling:
 *   - MIN_INTERVAL_MS: floor between spawns (scroll can fire 60+ Hz)
 *   - MAX_ACTIVE: cap on simultaneous flares
 *   - SPAWN_CHANCE: per-scroll-event probability once the floor clears,
 *     so the rhythm feels organic rather than mechanical
 */
function setupLensFlares() {
  const container = document.querySelector(".lens-flares");
  if (!container) return;

  const flares = Array.from(container.querySelectorAll(".lens-flare"));
  if (!flares.length) return;

  const MAX_ACTIVE       = 3;
  const MIN_INTERVAL_MS  = 950;     // min ms between spawns (rate limit)
  const SPAWN_CHANCE     = 0.8;     // chance per scroll event past the floor
  const BLOOM_MS         = 700;     // matches CSS bloom transition
  const HOLD_MS          = 300;     // pause at peak before fading
  const FADE_MS          = 900;     // matches CSS fade transition

  let lastSpawnAt = 0;

  function isBusy(flare) {
    return flare.classList.contains("is-active") ||
           flare.classList.contains("is-fading");
  }

  function activeCount() {
    let n = 0;
    for (const f of flares) if (isBusy(f)) n++;
    return n;
  }

  function spawnFlare() {
    const now = performance.now();
    if (now - lastSpawnAt < MIN_INTERVAL_MS) return;
    if (activeCount() >= MAX_ACTIVE) return;
    if (Math.random() > SPAWN_CHANCE) return;

    const flare = flares.find((f) => !isBusy(f));
    if (!flare) return;

    // Random position in viewport, avoiding extreme edges where it would
    // look like a UI artifact. x: 12-88%, y: 18-82% (avoiding header/hero
    // text band on top and footer/CTA band on bottom).
    const x = 12 + Math.random() * 76;
    const y = 18 + Math.random() * 64;

    // Random rotation: real lens flares rotate with the light source
    // orientation. Tilt them anywhere in (-35°, +35°) so they don't all
    // look identical without being so tilted they look broken.
    const rot = (Math.random() - 0.5) * 70;

    // Size variant — most are small "curious pops"; bigger ones are rare
    // accents. User feedback: subtle background, not prominent foreground.
    const sizeRoll = Math.random();
    const size = sizeRoll < 0.70 ? "sm"
               : sizeRoll < 0.95 ? "md"
               : "lg";

    flare.style.setProperty("--x", `${x}%`);
    flare.style.setProperty("--y", `${y}%`);
    flare.style.setProperty("--rot", `${rot.toFixed(1)}deg`);
    flare.dataset.size = size;

    // Restart the bloom animation cleanly if this flare was just used.
    // Removing and re-adding the class in the same frame collapses the
    // transition; we toggle through a hidden state to force a reflow.
    flare.classList.remove("is-active");
    flare.classList.remove("is-fading");
    // force reflow so the next class addition restarts the transition
    void flare.offsetWidth;
    flare.classList.add("is-active");

    lastSpawnAt = now;

    // Schedule the fade-out
    setTimeout(() => {
      flare.classList.remove("is-active");
      flare.classList.add("is-fading");
    }, BLOOM_MS + HOLD_MS);

    // Schedule cleanup so this flare re-enters the pool
    setTimeout(() => {
      flare.classList.remove("is-fading");
    }, BLOOM_MS + HOLD_MS + FADE_MS);
  }

  // Scroll listener — passive for perf. We don't need to throttle via
  // rAF because spawnFlare()'s own gates (time + active count + chance)
  // already handle rate limiting cheaply.
  window.addEventListener("scroll", spawnFlare, { passive: true });
}
