/* ════════════════════════════════════════════════════════════════════════
   partners.js — render the #partners section in index.html from
   data/people.json + data/companies.json + data/jobs.json.

   v3.13.0: was a standalone partners.html page. The content moved into
   the main page where the old Kit & Rental section used to be — the
   partner accordion now lives at <section id="partners"> and is
   rendered into the empty <div id="partners-content"> stub.

   v3.14.18: the data layer is now fully normalized — a person is
   just a collaborator (no role, no works, no relationship), and
   their role on a film is a jobId referencing the Jobs collection.
   The partners page shows a person only if they have a
   `partnership.jobIds` field. Their section on the page is
   determined by the CATEGORY of the jobs they partner in:
     - dop / camera-operator / 1st-ac / 2nd-ac → cinematography
     - gaffer / electric / sparks / best-boy-electric → lighting
   This is fully data-driven: add a new jobId to the Jobs
   collection, the partners page picks it up automatically. Add
   a new section by adding a CATEGORIES entry + an i18n label.

   Architecture (incremental, easy to maintain):
   - CATEGORIES is the single source of truth for which sections
     the partners accordion has. Each has:
       id        — matches a job.category (e.g. "cinematography")
       source    — "companies" (match by company.kind) or "people"
                   (match by person's partnership.jobIds categories)
       labelKey  — i18n key for the section header
   - To add a new section: add a CATEGORIES entry + a label in
     data/i18n.json + (if a new job is needed) a new entry in
     data/jobs/<id>.json.
   - The data layer is three entities: people, companies, jobs.
     composePartners() joins them into a single partners[] list
     bucketed per CATEGORIES entry.
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

  /** Category config. Single source of truth for section order and labels.
   *  Each id matches a job.category from data/jobs/. The renderer groups
   *  people by their partnership.jobIds → resolved through jobs → category.
   *  v3.14.18: the id is a JOB CATEGORY, not a static relationship. Adding
   *  a new section is just adding a CATEGORIES entry + an i18n label.
   *  The "lighting" section covers gaffer, electric, sparks, best-boy —
   *  any job in the lighting category. Same for cinematography. */
  const CATEGORIES = [
    { id: "cinematography", source: "people", labelKey: "partners.section.cinematography" },
    { id: "lighting",       source: "people", labelKey: "partners.section.lighting", defaultOpen: true },
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
    const [peopleData, companiesData, jobsData] = await Promise.all([
      loadBlock("tarek-people",    "data/people.json"),
      loadBlock("tarek-companies", "data/companies.json"),
      loadBlock("tarek-jobs",      "data/jobs.json"),
    ]);
    return composePartners(peopleData, companiesData, jobsData);
  }

  /** Merge people + companies + jobs into a single shape the renderer
   *  understands. v3.14.18: a person is just a collaborator; their
   *  partnership is a list of jobIds. We resolve each jobId through
   *  the jobs collection to get the category, and use that to bucket
   *  the person into the right section on the partners page.
   *  A person with no `partnership.jobIds` is filtered out (they're
   *  a one-off film credit, not a regular collaborator). */
  function composePartners(peopleData, companiesData, jobsData) {
    const jobsById = {};
    for (const j of (jobsData?.jobs ?? [])) jobsById[j.id] = j;

    // People who are partners = have a non-empty partnership.jobIds
    const partners = (peopleData?.people ?? []).filter(
      (p) => Array.isArray(p.partnership?.jobIds) && p.partnership.jobIds.length > 0
    );

    // For each partner, compute the set of categories they cover
    // (a person who partners as both gaffer and electric covers "lighting"
    // but only needs to appear in the lighting section once).
    const partnersWithCategories = partners.map((p) => {
      const categories = new Set();
      for (const jobId of p.partnership.jobIds) {
        const job = jobsById[jobId];
        if (job?.category) categories.add(job.category);
      }
      return {
        id: p.id,
        name: p.name,
        categories: [...categories],  // array for easy .includes() in render
        partnership: p.partnership,
        image: p.portrait ?? null,
        imageAlt: null,
        description: p.description ?? { en: "", es: "" },
        url: p.url ?? null,
        urlLabel: p.urlLabel ?? null,
        origin: "person",
      };
    });

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
        ...partnersWithCategories,
      ],
      // v3.13.12: also return the raw companies so the logo carousel
      // can filter by kind:"equipment-house" without going through
      // the merged list.
      // v3.14.18: also return jobsById for any future code that needs
      // to resolve jobId → category or name.
      companies,
      jobsById,
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
        if (category.source === "people")     return p.categories?.includes(category.id);
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
