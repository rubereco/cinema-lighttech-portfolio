/* Partners are grouped by their own categories; no Jobs lookup is needed. */
(function () {
  "use strict";

  /** Maximum length of a description. JS clips for safety; content authoring
   *  is expected to keep descriptions under this limit. */
  const MAX_DESCRIPTION_CHARS = 250;

  /** Default collapsed state for each category. Override per category via
   *  the CATEGORIES entry's `defaultOpen: true`. Categories without
   *  coverage (no partners) are auto-collapsed so the empty state is hidden. */
  const DEFAULT_OPEN = false;

  /** Partner categories and their display order. */
  const CATEGORIES = [
    { id: "direction",      source: "people", labelKey: "partners.section.direction" },
    { id: "cinematography", source: "people", labelKey: "partners.section.cinematography" },
    { id: "lighting",       source: "people", labelKey: "partners.section.lighting", defaultOpen: true },
    { id: "sound",          source: "people", labelKey: "partners.section.sound" },
    { id: "production",     source: "people", labelKey: "partners.section.production" },
    { id: "other",          source: "people", labelKey: "partners.section.other" },
  ];

  // ─── Loaders ──────────────────────────────────────────────────────────
  async function loadBlock(path) {
    try {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`[partners] failed to load ${path}:`, err);
      return null;
    }
  }

  async function loadContent() {
    const [peopleData, companiesData] = await Promise.all([
      loadBlock("/data/people.json"),
      loadBlock("/data/companies.json"),
    ]);
    const people = (peopleData?.people || [])
      .filter(person => person.partnership?.categories?.length)
      .map(person => ({
        id: person.id, name: person.name, origin: "person",
        categories: person.partnership.categories,
        image: person.portrait || null, imageAlt: person.name,
        url: person.url || null,
      }));
    const companies = companiesData?.companies || [];
    const companyPartners = companies.map(company => ({
      ...company, origin: "company", image: company.logo || null,
      imageAlt: company.name,
    }));
    return { partners: [...companyPartners, ...people], companies };
  }

  const t = (key, lang) => window.PortfolioI18n.t(key, lang);
  const getActiveLang = () => window.PortfolioI18n.lang;

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
    const prefix = partner.origin === "person" ? "people" : "companies";
    let text = t(prefix + "." + partner.id + ".description", lang) || "";
    if (text.length > MAX_DESCRIPTION_CHARS) text = text.slice(0, MAX_DESCRIPTION_CHARS - 1).trimEnd() + "…";
    return text;
  }

  function safeHttpUrl(raw) {
    try {
      const url = new URL(raw);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch (_) { return ""; }
  }

  /** Display name. Falls back to name if no surname field (enterprises). */
  function nameFor(partner) {
    return partner.name || "";
  }

  function linkFor(partner) {
    const name = nameFor(partner);
    if (!name) return "";
    const label = t("partners.website", getActiveLang());
    const safeUrl = safeHttpUrl(partner.url);
    if (!safeUrl) {
      return `<span class="partner-name">${escapeText(name)}</span>`;
    }
    return `<a class="partner-name link-arrow"
              href="${escapeAttr(safeUrl)}"
              target="_blank" rel="noopener noreferrer">${escapeText(name)} →</a>
            <span class="partner-link-label">${escapeText(label)}</span>`;
  }

  // ─── Card renderer ────────────────────────────────────────────────────

  /**
   * Renders a single partner card. v3.12.3: the card is now a uniform
   * IMDb-style list row — a 64px circular avatar on the left and the
   * name + description on the right. The previous per-category photo
   * aspect ratios (card-landscape, card-wide, etc.) are gone.
   *
   * v3.12.2: portrait fallback. The fallback element (black bg + grey
   * person emoji) is ALWAYS rendered inside .partner-photo. CSS hides
   * it via :has(> img) when a valid <img> is present. Two paths reveal
   * the fallback:
   *   1) portrait is null/empty in the data — we don't render <img> at all
   *   2) the image URL 404s — the onerror handler removes the <img>,
   *      which makes :has(> img) false, and CSS shows the fallback.
   *
   * v3.12.4: per-card "X collaborations" badge removed per client
   * feedback. The card now shows just name + description + link.
   * The `count` field in the data is still kept (harmless, in case
   * the client wants to bring the badge back later), it just isn't
   * rendered here.
   */
  function partnerCardHtml(partner, category) {
    const lang = getActiveLang();
    const name = nameFor(partner);
    const desc = descriptionFor(partner, lang);
    const image = partner.image || "";
    const alt = partner.imageAlt || partner.name || "";
    const hasImage = image.trim() !== "";

    const dataType = partner.origin === "person"
      ? (partner.categories?.[0] || partner.kind)  // first category, used as CSS hook
      : partner.kind;

    const imgHtml = hasImage
      ? `<img alt="${escapeAttr(alt)}"
              loading="lazy" decoding="async"
              src="${escapeAttr(image)}"
              onerror="this.remove()">`
      : "";

    return `
      <article class="partner-card" data-type="${escapeAttr(dataType)}">
        <div class="partner-photo">
          ${imgHtml}
          <div class="partner-photo-fallback" aria-hidden="true">👤</div>
        </div>
        <div class="partner-body">
          <header class="partner-card-head">
            ${linkFor(partner)}
          </header>
          ${desc ? `<p class="partner-desc">${escapeText(desc)}</p>` : ""}
        </div>
      </article>
    `;
  }

  function sectionHtml(category, items, lang) {
    const label = (category.labelKey && t(category.labelKey, lang)) || category.id;
    const empty = t("partners.empty", lang);
    const bodyId = `partners-section-body-${category.id}`;

    // Empty categories stay collapsed so the empty message is hidden by
    // default — less visual noise. Real categories are collapsed by default
    // unless the config explicitly sets defaultOpen: true.
    const isOpen = items.length > 0 && (category.defaultOpen === true || DEFAULT_OPEN);

    const inner = items.length
      ? `<ul class="partner-list" role="list">${items.map(p => `<li>${partnerCardHtml(p, category)}</li>`).join("")}</ul>`
      : `<p class="partner-empty">${escapeText(empty)}</p>`;

    const countWord = items.length === 1
      ? t("partners.count.partner_one", lang)
      : t("partners.count.partner_other", lang);
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

  /** Build the equipment-houses logo carousel.
   *  - Reads companies of kind: "equipment-house" from content.companies
   *  - Renders a label + a duplicated track of logos (for infinite marquee)
   *  - Each logo links out to the company's URL, with a grayscale → color hover
   *  - Returns "" if no equipment-house companies exist (silently no-op) */
  function renderLogosCarousel(content) {
    const target = document.getElementById("partners-logos");
    if (!target) return;
    const lang = getActiveLang();
    const companies = (content.companies || []).filter(c => c.kind === "equipment-house");
    if (companies.length === 0) {
      target.innerHTML = "";
      target.setAttribute("aria-busy", "false");
      return;
    }
    const label = t("partners.logosLabel", lang);
    const itemHtml = (c, isClone) => {
      const url = safeHttpUrl(c.url);
      const image = `<img src="${escapeAttr(c.logo || "")}" alt="" loading="lazy" />`;
      return url
        ? `<a class="partners-logos__item${isClone ? " is-clone" : ""}" href="${escapeAttr(url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(c.name)}" ${isClone ? 'aria-hidden="true" tabindex="-1"' : ''}>${image}</a>`
        : `<span class="partners-logos__item${isClone ? " is-clone" : ""}" ${isClone ? 'aria-hidden="true"' : ''}>${image}</span>`;
    };
    const originals = companies.map(c => itemHtml(c, false)).join("");
    const clones    = companies.map(c => itemHtml(c, true )).join("");
    target.innerHTML = `
      <p class="partners-logos__label">${escapeText(label)}</p>
      <div class="partners-logos__viewport">
        <div class="partners-logos__track">
          ${originals}
          ${clones}
        </div>
      </div>
    `;
    target.setAttribute("aria-busy", "false");
  }

  function render(content) {
    const target = document.getElementById("partners-content");
    if (!target) return;
    const lang = getActiveLang();
    const partners = content.partners || [];
    const html = CATEGORIES.map((category) => {
      // Filter by source first (companies / people), then by category.
      // v3.14.19: skip empty sections entirely — an empty "Sound"
      // section shouldn't render at all if no one partners in a
      // sound job. This way the partners page only shows sections
      // that have actual partners, in the CATEGORIES order.
      const items = partners.filter((p) => {
        if (category.source === "companies") return p.kind === category.id;
        if (category.source === "people")     return p.categories?.includes(category.id);
        return false;
      });
      if (items.length === 0) return "";   // hide empty sections
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
    renderLogosCarousel(currentContent);
    window.addEventListener("tarek:i18n-change", () => {
      render(currentContent);
      renderLogosCarousel(currentContent);
    });
  }

  function startWhenReady() {
    if (window.tarekI18nReady) boot();
    else window.addEventListener("tarek:i18n-ready", boot, { once: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startWhenReady);
  } else {
    startWhenReady();
  }
})();
