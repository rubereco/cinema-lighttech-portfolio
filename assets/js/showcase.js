/* ════════════════════════════════════════════════════════════════════════
   showcase.js — folder grid, per-project gallery, lightbox, hash routing.

   Performance strategy for images:
     1. IntersectionObserver: only mount <img src=...> when tile is near viewport.
     2. For real photos (jpg/webp), srcset with 400/800/1200 widths + sizes attr,
        so phones don't download desktop-sized images.
     3. decoding="async" so paint isn't blocked by image decode.
     4. loading="lazy" as a fallback for browsers without IO support.
     5. opacity transition (fade-in on load) to avoid pop-in jank.
     6. (Future) LQIP background-image set inline for blur-up.

   For now everything is SVG (vector, no srcset needed); the infrastructure
   is in place for real photos — drop in jpg/webp files and the same code path
   serves them progressively.

   Hash routing:
     showcase.html              → folder grid
     showcase.html#saw-2026     → Saw project view
     Browser back/forward works.
   ════════════════════════════════════════════════════════════════════════ */

(function () {
  "use strict";

  // ─── State ────────────────────────────────────────────────────────────
  let CONTENT = null;
  let currentProjectSlug = null;
  let currentFilter = "all";
  let lightboxIndex = -1;

  // ─── DOM refs (resolved once on boot) ────────────────────────────────
  const dom = {};

  function resolveDom() {
    dom.gridView     = document.getElementById("view-grid");
    dom.projectView  = document.getElementById("view-project");
    dom.grid         = document.getElementById("showcase-grid");
    dom.projectHead  = document.getElementById("project-head");
    dom.projectGrid  = document.getElementById("project-grid");
    dom.projectTabs  = document.getElementById("project-tabs");
    dom.lightbox     = document.getElementById("lightbox");
    dom.lightboxImg  = document.getElementById("lightbox-img");
    dom.lightboxCap  = document.getElementById("lightbox-caption");
  }

  // ─── Content loading ─────────────────────────────────────────────────
  async function loadContent() {
    try {
      const res = await fetch("data/content.json", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      CONTENT = await res.json();
    } catch (err) {
      console.error("[showcase] failed to load content.json:", err);
      CONTENT = { showcase: [] };
    }
  }

  function getActiveLang() {
    return document.documentElement.lang || "en";
  }

  // ─── Folder grid render ──────────────────────────────────────────────
  function renderGrid() {
    if (!dom.grid) return;
    const projects = CONTENT?.showcase || [];
    dom.grid.setAttribute("aria-busy", "false");

    if (projects.length === 0) {
      dom.grid.innerHTML = `<p class="showcase-empty">No projects yet.</p>`;
      return;
    }

    const lang = getActiveLang();
    dom.grid.innerHTML = projects.map((p, i) => folderCardHtml(p, i, lang)).join("");
    setupLazyImages(dom.grid, /* eagerCount */ 2);
  }

  function folderCardHtml(p, index, lang) {
    const accent = p.accent || "#E8A33D";
    const statusClass = p.status === "released" ? "is-released" : "";
    const statusLabel = p.status === "released"
      ? (lang === "es" ? "Estrenada" : "Released")
      : (lang === "es" ? "En producción" : "In production");
    const role = p.role || "";
    const year = p.year || "";
    const cover = p.cover || "";
    const summary = (p.summary && (p.summary[lang] || p.summary.en)) || "";

    // Eager-load the first 2 covers (above the fold on most phones); rest lazy.
    const eager = index < 2 ? "eager" : "lazy";

    return `
      <a class="folder-card" role="listitem"
         href="#${escapeAttr(p.slug)}"
         style="--folder-accent: ${escapeAttr(accent)}"
         aria-label="${escapeAttr(p.title)} (${year})">
        <img class="folder-cover" alt=""
             loading="${eager}" decoding="async"
             data-src="${escapeAttr(cover)}"
             src="${escapeAttr(placeholderCover(p.slug))}">
        <span class="folder-status ${statusClass}">${escapeText(statusLabel)}</span>
        <span class="folder-overlay">
          <span class="folder-meta">
            <span class="folder-accent" aria-hidden="true"></span>
            <span>${escapeText(String(year))}</span>
          </span>
          <h2 class="folder-title">${escapeText(p.title)}</h2>
          <p class="folder-role">${escapeText(role)}</p>
        </span>
      </a>
    `;
  }

  /**
   * Tiny solid-color placeholder used until the real cover loads.
   * With SVG covers the swap is instant, but the pattern also works for
   * future jpg/webp covers: just point data-src at the real file.
   */
  function placeholderCover(seed) {
    // 1×1 transparent gif — keeps layout stable without wasting bytes
    return "data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 4 5'/%3E";
  }

  // ─── Project view render ─────────────────────────────────────────────
  function renderProject(slug) {
    const project = (CONTENT?.showcase || []).find((p) => p.slug === slug);
    if (!project) {
      // Unknown slug → fall back to grid (e.g. stale link)
      location.hash = "";
      return;
    }

    const lang = getActiveLang();
    const accent = project.accent || "#E8A33D";
    const summary = (project.summary && (project.summary[lang] || project.summary.en)) || "";
    const statusLabel = project.status === "released"
      ? (lang === "es" ? "Estrenada" : "Released")
      : (lang === "es" ? "En producción" : "In production");
    const statusClass = project.status === "released" ? "is-released" : "";
    const roleLabel = (lang === "es" && project.role) ? translateRole(project.role) : project.role;

    dom.projectHead.style.setProperty("--project-accent", accent);
    dom.projectHead.innerHTML = `
      <img class="project-cover" alt=""
           loading="eager" decoding="async"
           data-src="${escapeAttr(project.cover)}"
           src="${escapeAttr(placeholderCover(project.slug))}">
      <div class="project-body">
        <div class="project-meta">
          <span class="project-accent" aria-hidden="true"></span>
          <span>${escapeText(String(project.year))}</span>
          <span aria-hidden="true">·</span>
          <span>${escapeText(roleLabel || "")}</span>
          ${project.director ? `<span aria-hidden="true">·</span><span>${escapeText(project.director)}</span>` : ""}
          <span class="project-status ${statusClass}">${escapeText(statusLabel)}</span>
        </div>
        <h1 class="project-title">${escapeText(project.title)}</h1>
        ${summary ? `<p class="project-subtitle">${escapeText(summary)}</p>` : ""}
      </div>
    `;

    currentFilter = "all";
    renderProjectPhotos(project);

    // Update tab buttons state
    if (dom.projectTabs) {
      dom.projectTabs.querySelectorAll("button").forEach((b) => {
        b.setAttribute("aria-selected", b.dataset.kind === "all" ? "true" : "false");
      });
    }

    setupLazyImages(dom.projectHead, /* eagerCount */ 1);
    setupLazyImages(dom.projectGrid, /* eagerCount */ 4);
    setupProjectTabs(project);
    setupPhotoClicks(project);

    // Lazy-load the cover image immediately (it has loading=eager)
    const coverImg = dom.projectHead.querySelector(".project-cover");
    if (coverImg && coverImg.dataset.src) {
      swapInImage(coverImg);
    }

    currentProjectSlug = slug;
    document.title = `${project.title} (${project.year}) — Tarek Recolons`;
  }

  function renderProjectPhotos(project) {
    const photos = project.photos || [];
    dom.projectGrid.setAttribute("aria-busy", "false");
    if (photos.length === 0) {
      dom.projectGrid.innerHTML = `<p class="showcase-empty">No photos yet for this project.</p>`;
      return;
    }
    dom.projectGrid.innerHTML = photos.map((ph, i) => photoTileHtml(ph, i)).join("");
  }

  function photoTileHtml(photo, index) {
    const kind = photo.kind || "bts";
    const caption = photo.caption || "";
    // Tiles: lazy by default (cover image is the only eager one)
    return `
      <figure class="photo-tile" role="listitem" data-kind="${escapeAttr(kind)}" data-index="${index}">
        <span class="photo-kind">${escapeText(kind)}</span>
        <img alt="${escapeAttr(caption)}"
             loading="lazy" decoding="async"
             data-src="${escapeAttr(photo.src)}"
             src="${escapeAttr(placeholderCover('tile'))}">
      </figure>
    `;
  }

  // ─── Tabs ────────────────────────────────────────────────────────────
  function setupProjectTabs(project) {
    if (!dom.projectTabs) return;
    dom.projectTabs.querySelectorAll("button").forEach((btn) => {
      btn.onclick = () => {
        const kind = btn.dataset.kind;
        currentFilter = kind;
        dom.projectTabs.querySelectorAll("button").forEach((b) => {
          b.setAttribute("aria-selected", b === btn ? "true" : "false");
        });
        filterProjectPhotos();
      };
    });
  }

  function filterProjectPhotos() {
    if (!dom.projectGrid) return;
    dom.projectGrid.querySelectorAll(".photo-tile").forEach((tile) => {
      const match = currentFilter === "all" || tile.dataset.kind === currentFilter;
      tile.classList.toggle("is-hidden", !match);
    });
  }

  // ─── Lazy image loading (IntersectionObserver) ───────────────────────
  let io = null;

  function setupLazyImages(scope, eagerCount = 0) {
    if (!("IntersectionObserver" in window)) {
      // Fallback: load everything immediately
      scope.querySelectorAll("img[data-src]").forEach(swapInImage);
      return;
    }

    if (!io) {
      io = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              swapInImage(entry.target);
              io.unobserve(entry.target);
            }
          }
        },
        { rootMargin: "200px 0px", threshold: 0.01 }
      );
    }

    const imgs = Array.from(scope.querySelectorAll("img[data-src]"));
    imgs.forEach((img, i) => {
      if (i < eagerCount) {
        swapInImage(img);
      } else {
        io.observe(img);
      }
    });
  }

  function swapInImage(img) {
    if (!img.dataset.src) return;
    img.src = img.dataset.src;
    delete img.dataset.src;

    // For real photos: build a responsive srcset by assuming naming convention
    //   photo.jpg → photo-400.jpg, photo-800.jpg, photo-1200.jpg
    // Skip for SVG (vector) and data URIs.
    const src = img.src;
    if (/\.(jpe?g|webp|png)(\?.*)?$/i.test(src)) {
      const base = src.replace(/\.(jpe?g|webp|png)(\?.*)?$/i, "");
      const ext  = src.match(/\.(jpe?g|webp|png)/i)[1];
      img.srcset = [
        `${base}-400.${ext} 400w`,
        `${base}-800.${ext} 800w`,
        `${base}-1200.${ext} 1200w`,
      ].join(", ");
      img.sizes = "(max-width: 720px) 50vw, (max-width: 1100px) 33vw, 25vw";
    }

    img.addEventListener("load", () => img.classList.add("is-loaded"), { once: true });
    img.addEventListener("error", () => img.classList.add("is-loaded"), { once: true }); // still fade-in to avoid stuck placeholder
  }

  // ─── Lightbox ────────────────────────────────────────────────────────
  function setupPhotoClicks(project) {
    if (!dom.projectGrid) return;
    dom.projectGrid.querySelectorAll(".photo-tile").forEach((tile) => {
      tile.addEventListener("click", () => {
        // Index within the *currently filtered* set so prev/next respects the tab
        const visible = Array.from(dom.projectGrid.querySelectorAll(".photo-tile"))
          .filter((t) => !t.classList.contains("is-hidden"));
        const idx = visible.indexOf(tile);
        if (idx >= 0) openLightbox(project, idx, visible);
      });
    });
  }

  function openLightbox(project, idx, visibleTiles) {
    const tile = visibleTiles[idx];
    const img = tile.querySelector("img");
    const caption = img.alt || project.title;
    dom.lightboxImg.src = img.currentSrc || img.src;
    dom.lightboxImg.alt = caption;
    dom.lightboxCap.textContent = caption;
    dom.lightbox.hidden = false;
    document.body.style.overflow = "hidden";
    lightboxIndex = idx;
    lightboxState.project = project;
    lightboxState.visibleTiles = visibleTiles;
  }

  function closeLightbox() {
    dom.lightbox.hidden = true;
    dom.lightboxImg.src = "";
    dom.lightboxImg.alt = "";
    dom.lightboxCap.textContent = "";
    document.body.style.overflow = "";
    lightboxIndex = -1;
  }

  const lightboxState = { project: null, visibleTiles: [] };

  function lightboxStep(delta) {
    if (lightboxIndex < 0) return;
    const next = (lightboxIndex + delta + lightboxState.visibleTiles.length) % lightboxState.visibleTiles.length;
    const tile = lightboxState.visibleTiles[next];
    const img = tile.querySelector("img");
    dom.lightboxImg.src = img.currentSrc || img.src;
    dom.lightboxImg.alt = img.alt || lightboxState.project.title;
    dom.lightboxCap.textContent = img.alt || lightboxState.project.title;
    lightboxIndex = next;
  }

  function setupLightbox() {
    if (!dom.lightbox) return;
    dom.lightbox.querySelector("[data-lightbox-close]").addEventListener("click", closeLightbox);
    dom.lightbox.querySelector("[data-lightbox-prev]").addEventListener("click", () => lightboxStep(-1));
    dom.lightbox.querySelector("[data-lightbox-next]").addEventListener("click", () => lightboxStep(1));
    // Click on backdrop closes
    dom.lightbox.addEventListener("click", (e) => {
      if (e.target === dom.lightbox) closeLightbox();
    });
    // Keyboard nav
    document.addEventListener("keydown", (e) => {
      if (dom.lightbox.hidden) return;
      if (e.key === "Escape") closeLightbox();
      else if (e.key === "ArrowLeft") lightboxStep(-1);
      else if (e.key === "ArrowRight") lightboxStep(1);
    });
  }

  // ─── Hash routing ────────────────────────────────────────────────────
  function handleRoute() {
    const hash = location.hash.replace(/^#/, "");
    if (hash && CONTENT?.showcase?.some((p) => p.slug === hash)) {
      dom.gridView.hidden = true;
      dom.projectView.hidden = false;
      renderProject(hash);
      window.scrollTo({ top: 0 });
    } else {
      dom.gridView.hidden = false;
      dom.projectView.hidden = true;
      currentProjectSlug = null;
      if (CONTENT) document.title = "Showcase — Tarek Recolons";
    }
  }

  // ─── Boot ────────────────────────────────────────────────────────────
  async function boot() {
    resolveDom();
    await loadContent();
    renderGrid();
    setupLightbox();
    window.addEventListener("hashchange", handleRoute);
    handleRoute();

    // Re-render project view when language changes
    window.addEventListener("tarek:i18n-change", () => {
      if (currentProjectSlug) renderProject(currentProjectSlug);
    });
  }

  // Wait for main.js to finish i18n setup, then boot. main.js dispatches
  // "tarek:i18n-ready" after applying translations. If it's already past
  // (e.g. slow showcase.js load), boot immediately.
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

  // ─── Helpers ─────────────────────────────────────────────────────────
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
  // Common role translations (EN → ES) for project headers.
  function translateRole(role) {
    const map = {
      "Gaffer": "Gaffer",
      "Best Boy Electric": "Best Boy Eléctrico",
      "Electrician": "Electricista",
      "Electrician / 2nd Gaffer": "Electricista / 2º Gaffer",
      "Rigging Electric": "Rigging Electric",
      "Spark": "Spark",
      "Spark (dailies)": "Spark (dailies)",
      "Lamp Operator": "Operador de Lámpara",
      "Grip": "Grip",
    };
    return map[role] || role;
  }
})();