/* ════════════════════════════════════════════════════════════════════════
   partners.js — render the Partners & Credits page from content.json.

   Architecture (incremental, easy to maintain):
   - Categories are defined in CATEGORIES below. Each has:
       id        — matches partner.type in content.json
       labelKey  — i18n key for the section header
       layout    — CSS class that defines the card's photo aspect ratio
                   ("landscape", "wide", "square", "default")
   - To add a new category:
       1. Add an entry to CATEGORIES
       2. Add a line in data/i18n.json (en + es) under partners.section.*
       3. Add a CSS rule for the layout class (or reuse an existing one)
   - To remove a category: just delete its CATEGORIES entry. Partners with
     that type will silently fall through to the orphaned list.
   - The renderer is fully data-driven. No per-category JS code.

   Loads inline-first (file:// compatibility) with fetch() fallback.
   Re-renders on tarek:i18n-change.
   ════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  /** Maximum length of a description. JS clips for safety; content authoring
   *  is expected to keep descriptions under this limit. */
  const MAX_DESCRIPTION_CHARS = 250;

  /** Default collapsed state for each category. Override per category via
   *  the CATEGORIES entry's `defaultOpen: true`. Categories without
   *  coverage (no partners) are auto-collapsed so the empty state is hidden. */
  const DEFAULT_OPEN = false;

  /** Category config. Single source of truth for section order, labels, and
   *  card layout. The order here is the order rendered on the page. */
  const CATEGORIES = [
    { id: "equipment-house", labelKey: "partners.section.equipment", layout: "card-landscape", defaultOpen: true },
    { id: "dp",              labelKey: "partners.section.dp",         layout: "card-wide" },
    { id: "rental",          labelKey: "partners.section.rental",     layout: "card-square" },
    { id: "partner",         labelKey: "partners.section.other",      layout: "card-default" },
  ];

  // ─── Loaders ──────────────────────────────────────────────────────────

  function readInline(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); }
    catch (err) { console.warn(`[partners] inline #${id} parse failed:`, err); return null; }
  }

  async function loadContent() {
    const inline = readInline("tarek-content");
    if (inline) return inline;
    try {
      const res = await fetch("data/content.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error("[partners] failed to load content.json:", err);
      return { partners: [] };
    }
  }

  // Inline i18n block — partners.html works even if main.js fails.
  const i18nBlock = (() => {
    const el = document.getElementById("tarek-i18n");
    if (!el) return null;
    try { return JSON.parse(el.textContent); }
    catch { return null; }
  })();

  function t(key, lang) {
    if (!i18nBlock) return null;
    const dict = i18nBlock[lang] || i18nBlock.en || {};
    const value = key.split(".").reduce(
      (acc, k) => (acc && acc[k] !== undefined ? acc[k] : null), dict
    );
    return (typeof value === "string") ? value : null;
  }

  function getActiveLang() {
    return document.documentElement.lang || "en";
  }

  // ─── HTML escaping ────────────────────────────────────────────────────

  function escapeText(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;");
  }

  // ─── Field helpers ────────────────────────────────────────────────────

  /** Description: per-language. Falls back to the other language if active
   *  is missing. Clips to MAX_DESCRIPTION_CHARS. */
  function descriptionFor(partner, lang) {
    const desc = partner.description || {};
    let text = desc[lang] || desc.en || desc.es || "";
    if (text.length > MAX_DESCRIPTION_CHARS) {
      text = text.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd() + "…";
    }
    return text;
  }

  /** Count is rendered with a localized singular/plural word. The number
   *  is the only numeric field, so we just attach a small statistics label. */
  function countFor(partner, lang) {
    if (typeof partner.count !== "number" || partner.count <= 0) return null;
    const word = partner.count === 1
      ? (t("partners.count.one", lang) || "collaboration")
      : (t("partners.count.other", lang) || "collaborations");
    return `${partner.count} ${word}`;
  }

  /** Display name. Falls back to name if no surname field (enterprises). */
  function nameFor(partner) {
    return partner.name || "";
  }

  function linkFor(partner) {
    const name = nameFor(partner);
    if (!name) return "";
    const label = partner.label || "Website";
    if (!partner.url) {
      return `<span class="partner-name">${escapeText(name)}</span>`;
    }
    return `<a class="partner-name link-arrow"
              href="${escapeAttr(partner.url)}"
              target="_blank" rel="noopener noreferrer">${escapeText(name)} →</a>
            <span class="partner-link-label">${escapeText(label)}</span>`;
  }

  // ─── Card renderer ────────────────────────────────────────────────────

  /**
   * Renders a single partner card using the layout class from the category
   * config. The layout only affects the photo's aspect ratio and grid span;
   * the card content (photo, name, count, description, link) is identical.
   * That way, "format per category" is purely a CSS concern.
   */
  function partnerCardHtml(partner, category) {
    const lang = getActiveLang();
    const name = nameFor(partner);
    const desc = descriptionFor(partner, lang);
    const count = countFor(partner, lang);
    const photo = partner.photo || "";
    const alt = partner.photoAlt || `${name}`;

    return `
      <article class="partner-card ${category.layout}" data-type="${escapeAttr(partner.type)}">
        <div class="partner-photo">
          <img alt="${escapeAttr(alt)}"
               loading="lazy" decoding="async"
               src="${escapeAttr(photo)}">
        </div>
        <div class="partner-body">
          <header class="partner-card-head">
            ${linkFor(partner)}
            ${count ? `<span class="partner-count">${escapeText(count)}</span>` : ""}
          </header>
          ${desc ? `<p class="partner-desc">${escapeText(desc)}</p>` : ""}
        </div>
      </article>
    `;
  }

  function sectionHtml(category, items, lang) {
    const label = (category.labelKey && t(category.labelKey, lang)) || category.id;
    const empty = t("partners.empty", lang) || "No partners listed yet.";
    const bodyId = `partners-section-body-${category.id}`;

    // Empty categories stay collapsed so the empty message is hidden by
    // default — less visual noise. Real categories are collapsed by default
    // unless the config explicitly sets defaultOpen: true.
    const isOpen = items.length > 0 && (category.defaultOpen === true || DEFAULT_OPEN);

    const inner = items.length
      ? `<ul class="partner-list" role="list">${items.map(p => `<li>${partnerCardHtml(p, category)}</li>`).join("")}</ul>`
      : `<p class="partner-empty">${escapeText(empty)}</p>`;

    const countWord = items.length === 1
      ? (t("partners.count.partner_one", lang) || "partner")
      : (t("partners.count.partner_other", lang) || "partners");
    const meta = items.length > 0
      ? `<span class="partners-section-meta">${items.length} ${escapeText(countWord)}</span>`
      : "";

    return `
      <li class="partners-section" data-type="${escapeAttr(category.id)}">
        <button class="partners-section-toggle"
                type="button"
                aria-expanded="${isOpen ? "true" : "false"}"
                aria-controls="${escapeAttr(bodyId)}">
          <span class="partners-section-title">${escapeText(label)}</span>
          ${meta}
          <span class="partners-section-chevron" aria-hidden="true"></span>
        </button>
        <div class="partners-section-body" id="${escapeAttr(bodyId)}"${isOpen ? "" : " hidden"}>
          ${inner}
        </div>
      </li>
    `;
  }

  // ─── Render entry point ───────────────────────────────────────────────

  function render(content) {
    const target = document.getElementById("partners-content");
    if (!target) return;
    const lang = getActiveLang();
    const partners = content.partners || [];
    const html = CATEGORIES.map(category => {
      const items = partners.filter(p => p.type === category.id);
      return sectionHtml(category, items, lang);
    }).join("");
    target.innerHTML = `<ul class="partners-accordion" role="list">${html}</ul>`;
    target.setAttribute("aria-busy", "false");
    attachToggleHandlers(target);
  }

  /** Wire click + keyboard handlers to each section toggle.
   *  Native <button> already handles Enter/Space — we just need to keep
   *  aria-expanded and the [hidden] attribute in sync. */
  function attachToggleHandlers(scope) {
    scope.querySelectorAll(".partners-section-toggle").forEach(btn => {
      btn.addEventListener("click", () => {
        const expanded = btn.getAttribute("aria-expanded") === "true";
        btn.setAttribute("aria-expanded", expanded ? "false" : "true");
        const body = document.getElementById(btn.getAttribute("aria-controls"));
        if (body) body.hidden = expanded;
      });
    });
  }

  // ─── Boot ─────────────────────────────────────────────────────────────

  let currentContent = null;

  async function boot() {
    currentContent = await loadContent();
    render(currentContent);
    window.addEventListener("tarek:i18n-change", () => render(currentContent));
  }

  function startWhenReady() {
    if (window.TarekI18N && document.documentElement.lang) {
      boot();
    } else {
      window.addEventListener("tarek:i18n-ready", boot, { once: true });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenReady);
  } else {
    startWhenReady();
  }
})();
