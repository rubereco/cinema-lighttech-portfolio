/* Film details: one film record, one optional trailer, no crew relationships. */
window.FILM_MODAL = (() => {
  const i18n = window.PortfolioI18n;
  let modal;
  let filmsById = new Map();
  let orderedIds = [];
  let currentId = null;
  let previousFocus = null;

  function trailerSource(raw) {
    if (!raw) return null;
    let url;
    try { url = new URL(raw); } catch (_) { return null; }
    if (url.protocol !== "https:") return null;
    const host = url.hostname.toLowerCase();
    let id;
    if (["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"].includes(host)) {
      id = host.endsWith("youtu.be") ? url.pathname.slice(1) : url.searchParams.get("v");
      if (/^[a-zA-Z0-9_-]{11}$/.test(id || "")) {
        return { kind: "youtube", url: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&mute=1&playsinline=1` };
      }
    }
    if (["vimeo.com", "www.vimeo.com"].includes(host)) {
      const [, videoId, privacyHash] = url.pathname.split("/");
      if (/^\d+$/.test(videoId || "") && (!privacyHash || /^[a-f0-9]+$/i.test(privacyHash))) {
        const params = new URLSearchParams();
        if (privacyHash) params.set("h", privacyHash);
        params.set("autoplay", "1");
        params.set("muted", "1");
        return { kind: "vimeo", url: `https://player.vimeo.com/video/${videoId}?${params}` };
      }
    }
    return { kind: "external", url: url.href };
  }

  function renderText(film) {
    document.getElementById("film-modal-title").textContent = film.title || "";
    const year = document.getElementById("film-modal-year");
    year.textContent = film.year ? String(film.year) : "";
    year.hidden = !film.year;
    const type = document.getElementById("film-modal-type");
    type.textContent = film.type ? i18n.t(`filmType.${film.type}`) : "";
    type.hidden = !film.type;
    const roleRow = document.getElementById("film-modal-role-row");
    const role = document.getElementById("film-modal-role");
    role.textContent = film.role ? i18n.t(`roles.${film.role}`) : "";
    roleRow.hidden = !film.role;
    document.getElementById("film-modal-watch").textContent = i18n.t("film.watchTrailer");
    renderPosterNavigation();
  }

  function renderPosterNavigation() {
    const navigation = modal.querySelector(".film-modal__poster-nav");
    const index = orderedIds.indexOf(currentId);
    navigation.hidden = index < 0;
    if (index < 0) return;

    const current = filmsById.get(currentId);
    const previous = filmsById.get(orderedIds[(index - 1 + orderedIds.length) % orderedIds.length]);
    const next = filmsById.get(orderedIds[(index + 1) % orderedIds.length]);
    const previousButton = navigation.querySelector("[data-film-modal-prev]");
    const nextButton = navigation.querySelector("[data-film-modal-next]");
    previousButton.hidden = nextButton.hidden = orderedIds.length < 2;
    previousButton.setAttribute("aria-label", i18n.t("film.previousPosterAria", undefined, { title: previous.title }));
    nextButton.setAttribute("aria-label", i18n.t("film.nextPosterAria", undefined, { title: next.title }));
    document.getElementById("film-modal-prev-poster").src = previous.poster;
    document.getElementById("film-modal-current-poster").src = current.poster;
    document.getElementById("film-modal-current-poster").alt = i18n.t("film.posterAlt", undefined, { title: current.title });
    document.getElementById("film-modal-next-poster").src = next.poster;
    document.getElementById("film-modal-position").textContent = i18n.t("film.position", undefined, {
      current: index + 1,
      total: orderedIds.length
    });
  }

  function renderMedia(film) {
    const media = document.getElementById("film-modal-media");
    const link = document.getElementById("film-modal-watch");
    media.replaceChildren(); // Stops the previous trailer before changing films.
    const source = trailerSource(film.trailerUrl);
    link.hidden = !source || source.kind !== "external";
    if (source?.kind === "external") {
      link.href = source.url;
    } else {
      link.removeAttribute("href");
    }
    if (source && source.kind !== "external") {
      const frame = document.createElement("iframe");
      frame.src = source.url;
      frame.title = i18n.t("film.trailerTitle", undefined, { title: film.title });
      frame.allow = "autoplay; encrypted-media; fullscreen; picture-in-picture";
      frame.allowFullscreen = true;
      frame.referrerPolicy = "strict-origin-when-cross-origin";
      media.classList.add("has-video");
      media.append(frame);
      return;
    }
    media.classList.remove("has-video");
    if (film.poster) {
      const image = document.createElement("img");
      image.src = film.poster;
      image.alt = i18n.t("film.posterAlt", undefined, { title: film.title });
      media.append(image);
    }
  }

  function updateMediaLabels(film) {
    const media = document.getElementById("film-modal-media");
    const frame = media.querySelector("iframe");
    if (frame) frame.title = i18n.t("film.trailerTitle", undefined, { title: film.title });
    const image = media.querySelector("img");
    if (image) image.alt = i18n.t("film.posterAlt", undefined, { title: film.title });
  }

  function show(filmId, historyMode = "push", direction = 0) {
    const film = filmsById.get(filmId);
    if (!film || !modal) return;
    const wasOpen = modal.classList.contains("film-modal--open");
    const changedFilm = currentId !== filmId;
    if (!wasOpen) previousFocus = document.activeElement;
    currentId = filmId;
    renderText(film);
    renderMedia(film);
    modal.classList.add("film-modal--open");
    modal.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("film-modal-open");
    if (historyMode === "push") history.pushState({ filmModal: true }, "", `#film-${filmId}`);
    if (historyMode === "replace") history.replaceState({ filmModal: true }, "", `#film-${filmId}`);
    if (changedFilm) {
      window.dispatchEvent(new CustomEvent("tarek:film-modal-change", { detail: { filmId, direction } }));
    }
    if (!wasOpen) modal.querySelector(".film-modal__close")?.focus({ preventScroll: true });
  }

  function hide() {
    if (!modal) return;
    if (currentId) {
      window.dispatchEvent(new CustomEvent("tarek:film-modal-close", { detail: { filmId: currentId } }));
    }
    modal.classList.remove("film-modal--open");
    modal.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("film-modal-open");
    document.getElementById("film-modal-media").replaceChildren();
    currentId = null;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
    previousFocus = null;
  }

  function close() {
    if (!currentId) return;
    hide();
    if (history.state?.filmModal) history.back();
    else history.replaceState(null, "", "#work");
  }

  function move(delta) {
    const current = orderedIds.indexOf(currentId);
    if (current < 0 || orderedIds.length < 2) return;
    const next = (current + delta + orderedIds.length) % orderedIds.length;
    show(orderedIds[next], "replace", delta);
  }

  async function init(data) {
    modal = document.getElementById("film-modal");
    if (!modal) return;
    const films = data.films || [];
    filmsById = new Map(films.map(film => [film.id, film]));
    orderedIds = films.filter(film => film.poster && film.displayOrder != null).map(film => film.id);

    modal.addEventListener("click", event => {
      if (event.target.closest("[data-film-modal-close]")) {
        event.preventDefault();
        close();
      } else if (event.target.closest("[data-film-modal-prev]")) move(-1);
      else if (event.target.closest("[data-film-modal-next]")) move(1);
    });
    document.addEventListener("keydown", event => {
      if (!currentId) return;
      if (event.key === "Escape") close();
      if (event.key === "ArrowLeft") move(-1);
      if (event.key === "ArrowRight") move(1);
      if (event.key === "Tab") {
        const controls = [...modal.querySelectorAll('button:not([disabled]), a[href]:not([hidden]), iframe')]
          .filter(control => control.getClientRects().length && !control.closest('[hidden]'));
        const first = controls[0];
        const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    });
    window.addEventListener("tarek:film-open", event => {
      if (event.detail?.filmId) show(event.detail.filmId);
    });
    window.addEventListener("popstate", () => {
      const match = location.hash.match(/^#film-(.+)$/);
      if (match && filmsById.has(match[1])) show(match[1], "none");
      else hide();
    });
    window.addEventListener("tarek:i18n-change", () => {
      if (currentId) {
        const film = filmsById.get(currentId);
        renderText(film);
        updateMediaLabels(film);
      }
    });
    const match = location.hash.match(/^#film-(.+)$/);
    if (match && filmsById.has(match[1])) show(match[1], "none");
  }

  return { init, show, close, trailerSource };
})();
