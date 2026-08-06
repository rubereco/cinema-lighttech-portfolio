/* ════════════════════════════════════════════════════════════════════════
   partners.js — render the #partners section in index.html from
   data/people.json + data/companies.json.

   v3.13.0: was a standalone partners.html page. The content moved into
   the main page where the old Kit & Rental section used to be — the
   partner accordion now lives at <section id="partners"> and is
   rendered into the empty <div id="partners-content"> stub.

   Architecture (incremental, easy to maintain):
   - Categories are defined in CATEGORIES below. Each has:
       source        — "companies" (match by `kind`) or "people" (match by `relationship`)
       id            — discriminator against the source; for source:companies this
                       is matched against company.kind; for source:people this
                       is matched against person.relationship.
       labelKey      — i18n key for the section header
       layout        — CSS class that defines the card's image aspect ratio
                       ("landscape", "wide", "square", "default")
   - To add a new category:
       1. Add an entry to CATEGORIES (pick source: "companies" or "people")
       2. Add a line in data/i18n.json (en + es) under partners.section.*
       3. Add a CSS rule for the layout class (or reuse an existing one)
   - To remove a category: just delete its CATEGORIES entry. Partners with
     that kind/relationship will silently not render.
   - The data layer is two entities: people (data/people.json) and
     companies (data/companies.json). People have TWO orthogonal fields:
       kind          — film credit role (subject, director, dop, gaffer, electric)
       relationship  — partner page section (dp, electric); if set, the
                       person also shows up on the partners page.
     This lets a person be BOTH a film credit AND a partner without
     conflict. The composePartners() function merges them into a
     uniform partners[] list, filtered per category by source.
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
   *  card layout. The order here is the order rendered on the page.
   *
   *  v3.12.0: customer feedback reshaped the categories. Removed the
   *  rental-partner and commercial-partner/other buckets. Added the
   *  electricians / lighting technicians bucket ("eléctricos / técnicos
   *  de luz") for the people Tarek works with on set.
   *
   *  v3.12.3: removed the per-category `layout` property. The card is
   *  now a uniform IMDb-style list row (64px circular avatar + text),
   *  so per-category aspect ratios are no longer needed.
   *
   *  v3.13.2: reordered per client — the electricians / sparks bucket
   *  now sits at the bottom of the list (was first). Equipment Houses
   *  lead, then Cinematographers, then Electricians. The "sparks"
   *  category still has defaultOpen:true so it ships expanded on
   *  first visit.
   *
   *  Each category is a view over the *partners* page composition:
   *    source: "companies" → match companies by `kind` === id
   *    source: "people"   → match people by `relationship` === id (kind is the
   *                         separate film-credit role and is not consulted here)
   *  The two source kinds keep people and companies cleanly separated at
   *  the storage layer. v3.14.15: people no longer need kind="collaborator"
   *  to appear on the partners page — they just need a relationship set.
   */
  const CATEGORIES = [
    // v3.13.11: equipment-house removed from the accordion — equipment
    // houses now live in a separate logo carousel below the accordion
    // (see renderLogosCarousel()).
    { id: "dp",                 source: "people",   relationship: "dp",     labelKey: "partners.section.dp" },
    { id: "electric",           source: "people",   relationship: "electric", labelKey: "partners.section.electric", defaultOpen: true },
  ];

  // ─── Loaders ──────────────────────────────────────────────────────────
  // Reads both inline blocks (file://) or fetches (live deploy). The two
  // entities compose on the page; see `composePartners()` below.

  function readInline(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    try { return JSON.parse(el.textContent); }
    catch (err) { console.warn(`[partners] inline #${id} parse failed:`, err); return null; }
  }

  async function loadBlock(id, fallbackPath) {
    const inline = readInline(id);
    if (inline) return inline;
    try {
      const res = await fetch(fallbackPath, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`[partners] failed to load ${fallbackPath}:`, err);
      return null;
    }
  }

  async function loadContent() {
    const [peopleData, companiesData] = await Promise.all([
      loadBlock("tarek-people",    "data/people.json"),
      loadBlock("tarek-companies", "data/companies.json"),
    ]);
    return composePartners(peopleData, companiesData);
  }

  /** Merge people + companies into a single shape the renderer understands.
   *  v3.14.15: the "appears on partners page" decision is now driven by
   *  `relationship` (dp | electric) — NOT by `kind`. This way a person
   *  can be BOTH a film credit (kind: director, dop, gaffer, electric)
   *  AND a partner (relationship: dp or electric) without conflict.
   *  Example: an electric who's a regular collaborator has
   *  kind: "electric" + relationship: "electric" — they show up in
   *  the partners page (via the relationship) AND can be selected as
   *  the electric on a film (via the kind). */
  function composePartners(peopleData, companiesData) {
    const collaborators = (peopleData?.people ?? []).filter(
      (p) => p.relationship === "dp" || p.relationship === "electric"
    );
    const companies = companiesData?.companies ?? [];
    return {
      partners: [
        ...companies.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,                       // discriminator for category match
          image: c.logo ?? null,
          imageAlt: c.logoAlt ?? null,
          count: c.count ?? 0,
          description: c.description ?? { en: "", es: "" },
          url: c.url ?? null,
          urlLabel: c.urlLabel ?? null,
          origin: "company",
        })),
        ...collaborators.map((p) => ({
          id: p.id,
          name: p.name,
          kind: p.kind,                       // film-credit kind (director, dop, gaffer, electric…)
          relationship: p.relationship,       // "dp" | "electric" — drives which partners section
          image: p.portrait ?? null,
          imageAlt: null,
          count: p.count ?? 0,
          description: p.description ?? { en: "", es: "" },
          url: p.url ?? null,
          urlLabel: p.urlLabel ?? null,
          origin: "person",
        })),
      ],
      // v3.13.12: also return the raw companies so the logo carousel
      // can filter by kind:"equipment-house" without going through
      // the merged list (the merged list keeps the raw `kind` field
      // so the company type is preserved).
      // v3.14.15: people no longer carry kind="collaborator" — they
      // keep their real film-credit kind (director, dop, etc.) and
      // get categorized on the partners page via `relationship`.
      companies,
    };
  }

  // Inline i18n block — the #partners section in index.html works
  // even if main.js fails to load. (v3.13.0: was partners.html,
  // now embedded in the main page.)
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

  /** Display name. Falls back to name if no surname field (enterprises). */
  function nameFor(partner) {
    return partner.name || "";
  }

  function linkFor(partner) {
    const name = nameFor(partner);
    if (!name) return "";
    const label = partner.urlLabel || partner.label || "Website";
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
      ? partner.relationship || partner.kind
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
    const itemHtml = (c, isClone) => `
      <a class="partners-logos__item${isClone ? " is-clone" : ""}" 
         href="${escapeAttr(c.url || "#")}" 
         target="_blank" rel="noopener" 
         aria-label="${escapeAttr(c.name)}" 
         ${isClone ? 'aria-hidden="true"' : ''}>
        <img src="${escapeAttr(c.logo || "")}" alt="${escapeAttr(c.logoAlt || c.name || "")}" loading="lazy" />
      </a>
    `;
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
      // Filter by source first (companies / people), then by kind or relationship
      // depending on the source. Two-step keeps page-config declarative.
      // v3.14.15: people are matched on `relationship` only — `kind` is
      // the film-credit role and is no longer restricted to "collaborator".
      const items = partners.filter((p) => {
        if (category.source === "companies") return p.kind === category.id;
        if (category.source === "people")     return p.relationship === category.id;
        return false;
      });
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
