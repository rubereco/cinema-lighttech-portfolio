/* ════════════════════════════════════════════════════════════════════════
   partners.js — render the Partners & Credits page from content.json.

   Loads inline-first (file:// compatibility) with fetch() fallback.
   Groups partners by `type` (equipment-house, rental, dp, partner) and
   renders one section per type. Empty sections show the localized empty
   state. No lightbox / no intersection observer — this is a static
   link-out list, not a photo gallery.
   ════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  const TYPE_ORDER = ["equipment-house", "rental", "dp", "partner"];
  const TYPE_LABEL_KEY = {
    "equipment-house": "partners.section.equipment",
    "rental":          "partners.section.rental",
    "dp":              "partners.section.dp",
    "partner":         "partners.section.other",
  };

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

  function getActiveLang() {
    return document.documentElement.lang || "en";
  }

  // Resolve a translation key from the inline i18n block (we don't reuse
  // main.js's I18N to keep this file stand-alone — partners.html works
  // even if main.js fails to load).
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

  function notesFor(partner, lang) {
    if (!partner.notes) return "";
    const n = partner.notes[lang] || partner.notes.en;
    return n ? `<p class="partner-notes">${escapeText(n)}</p>` : "";
  }

  function locationFor(partner) {
    return partner.location
      ? `<span class="partner-location">${escapeText(partner.location)}</span>`
      : "";
  }

  function linkFor(partner) {
    if (!partner.url) {
      return `<span class="partner-name">${escapeText(partner.name)}</span>`;
    }
    const label = partner.label || "Website";
    return `<a class="partner-name link-arrow"
              href="${escapeAttr(partner.url)}"
              target="_blank" rel="noopener noreferrer">${escapeText(partner.name)} →</a>
            <span class="partner-link-label">${escapeText(label)}</span>`;
  }

  function partnerCardHtml(partner, lang) {
    return `
      <article class="partner-card">
        <header class="partner-card-head">
          ${linkFor(partner)}
          ${locationFor(partner)}
        </header>
        ${notesFor(partner, lang)}
      </article>
    `;
  }

  function sectionHtml(type, items, lang) {
    const labelKey = TYPE_LABEL_KEY[type];
    const label = (labelKey && t(labelKey, lang)) || type;
    const empty = t("partners.empty", lang) || "No partners listed yet.";
    const inner = items.length
      ? `<ul class="partner-list" role="list">${items.map(p => `<li>${partnerCardHtml(p, lang)}</li>`).join("")}</ul>`
      : `<p class="partner-empty">${escapeText(empty)}</p>`;
    return `
      <section class="partners-section" data-type="${escapeAttr(type)}">
        <h2 class="partners-section-title">${escapeText(label)}</h2>
        ${inner}
      </section>
    `;
  }

  function render(content) {
    const target = document.getElementById("partners-content");
    if (!target) return;
    const lang = getActiveLang();
    const partners = content.partners || [];
    const byType = TYPE_ORDER.reduce((acc, type) => {
      acc[type] = partners.filter(p => p.type === type);
      return acc;
    }, {});
    target.innerHTML = TYPE_ORDER
      .map(type => sectionHtml(type, byType[type], lang))
      .join("");
  }

  // Re-render when language changes (mirrors showcase.js pattern).
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
