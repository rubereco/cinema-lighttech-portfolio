/* A six-face film reel. The CMS photos cycle through its visible faces. */
(() => {
  const root = document.getElementById("about-carousel");
  if (!root) return;

  const stage = root.querySelector(".about-carousel__stage");
  const position = root.querySelector(".about-carousel__position");
  const positionCurrent = position.querySelector(".about-carousel__position-current");
  const positionTotal = position.querySelector(".about-carousel__position-total");
  const rail = document.querySelector(".about-carousel__rail");
  const railThumb = rail.querySelector(".about-carousel__rail-thumb");
  const lightbox = document.getElementById("about-lightbox");
  const i18n = window.PortfolioI18n;
  const mobileQuery = matchMedia("(max-width: 899px)");
  const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const ring = document.createElement("div");
  ring.className = "about-carousel__ring";
  const faceCount = 6;
  const turnDuration = 650;
  const autoDelay = 2500;
  let items = [];
  let active = 0;
  let rotation = 0;
  let turning = false;
  let queuedSteps = 0;
  let queuedDirection = 1;
  let queuedFast = false;
  let finishTimer = null;
  let autoTimer = null;
  let gesture = null;
  let suppressClickUntil = 0;
  let visible = false;
  let railPointer = null;
  let railTarget = null;
  let railDesiredIndex = null;
  let railDragTimer = null;

  const mod = (value, length) => ((value % length) + length) % length;
  const label = (key, values) => i18n.t(key, undefined, values) || "";
  const altFor = item => label(`about.photo.${item.id}.alt`);
  const frontFace = () => mod(rotation, faceCount);

  // Only the front and its immediate neighbours are visible. Reassign hidden
  // rear faces after each turn, so even four photos fill the six-face reel.
  function syncFaces() {
    [...ring.children].forEach((card, face) => {
      let offset = mod(face - frontFace(), faceCount);
      if (offset > faceCount / 2) offset -= faceCount;
      const itemIndex = mod(active + offset, items.length);
      const item = items[itemIndex];
      if (card.dataset.itemIndex !== String(itemIndex)) {
        card.querySelectorAll("img").forEach(image => { image.src = item.file; });
        card.dataset.itemIndex = String(itemIndex);
      }
      card.dataset.offset = String(offset);
      card.classList.toggle("is-active", offset === 0);
      card.setAttribute("aria-hidden", String(offset !== 0));
      card.tabIndex = offset === 0 ? 0 : -1;
      card.querySelector(".about-carousel__photo").alt = altFor(item);
      card.setAttribute("aria-label", altFor(item));
    });
    positionCurrent.textContent = String(active + 1).padStart(2, "0");
    positionTotal.textContent = String(items.length).padStart(2, "0");
    const photoPosition = label("about.photoPosition", { current: active + 1, total: items.length });
    position.setAttribute("aria-label", photoPosition);
    rail.setAttribute("aria-valuemax", String(items.length));
    rail.setAttribute("aria-valuenow", String(active + 1));
    rail.setAttribute("aria-valuetext", photoPosition);
    railThumb.style.top = `${(railPointer !== null ? railDesiredIndex : active) / items.length * 100}%`;
    railThumb.style.height = `${100 / items.length}%`;
  }

  function stopAuto() {
    if (autoTimer !== null) clearTimeout(autoTimer);
    autoTimer = null;
  }

  function restartAuto(afterTurn = false) {
    stopAuto();
    if (!mobileQuery.matches || reducedMotionQuery.matches || document.hidden ||
        !visible || lightbox?.open || turning || items.length < 2) return;
    autoTimer = setTimeout(() => go(active + 1), afterTurn ? autoDelay - turnDuration : autoDelay);
  }

  function finishTurn() {
    if (!turning) return;
    if (finishTimer !== null) clearTimeout(finishTimer);
    finishTimer = null;
    turning = false;
    root.classList.remove("is-turning");
    syncFaces();
    if (railTarget !== null) {
      const target = railTarget;
      railTarget = null;
      queuedSteps = 0;
      if (target !== active) go(target, true);
      else restartAuto(true);
    } else if (queuedSteps > 0) {
      advanceQueue();
    } else {
      restartAuto(true);
    }
  }

  function turn(direction, steps = 1, duration = turnDuration) {
    if (turning || items.length < 2) return;
    stopAuto();
    turning = true;
    root.classList.add("is-turning");
    rotation += direction * steps;
    active = mod(active + direction * steps, items.length);
    ring.style.setProperty("--reel-turn-duration", `${duration}ms`);
    ring.style.setProperty("--rotation", String(rotation));
    if (reducedMotionQuery.matches) finishTurn();
    else finishTimer = setTimeout(finishTurn, duration + 100);
  }

  function advanceQueue() {
    const steps = queuedFast ? Math.min(2, queuedSteps) : 1;
    queuedSteps -= steps;
    turn(queuedDirection, steps, queuedFast ? (steps === 2 ? 280 : 200) : turnDuration);
  }

  function go(index, fast = false) {
    if (turning || items.length < 2) return;
    const target = mod(index, items.length);
    let steps = target - active;
    if (steps > items.length / 2) steps -= items.length;
    if (steps < -items.length / 2) steps += items.length;
    if (!steps) return;
    if (reducedMotionQuery.matches) {
      rotation += steps;
      active = target;
      ring.style.setProperty("--rotation", String(rotation));
      syncFaces();
      restartAuto(true);
      return;
    }
    queuedDirection = Math.sign(steps);
    queuedSteps = Math.abs(steps);
    queuedFast = fast && Math.abs(steps) > 1;
    advanceQueue();
  }

  function openLightbox() {
    const item = items[active];
    if (!item || !lightbox) return;
    stopAuto();
    const image = lightbox.querySelector("img");
    image.src = item.file;
    image.alt = altFor(item);
    lightbox.showModal();
  }

  function render() {
    ring.replaceChildren();
    stage.replaceChildren(ring);
    rail.hidden = items.length < 2;
    if (!items.length) return;

    function makeFilmEdge(side) {
      const edge = document.createElement("span");
      edge.className = `about-carousel__edge about-carousel__edge--${side}`;
      edge.setAttribute("aria-hidden", "true");
      for (let perf = 0; perf < 8; perf += 1) {
        const hole = document.createElement("span");
        hole.className = "about-carousel__perf";
        edge.append(hole);
      }
      return edge;
    }

    for (let face = 0; face < faceCount; face += 1) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "about-carousel__item";
      card.style.setProperty("--face", String(face));
      const picture = document.createElement("span");
      picture.className = "about-carousel__picture";
      const photo = document.createElement("img");
      photo.className = "about-carousel__photo";
      photo.decoding = "async";
      picture.append(photo);
      card.append(makeFilmEdge("left"), picture, makeFilmEdge("right"));
      card.addEventListener("click", () => {
        if (turning || Date.now() < suppressClickUntil) return;
        const offset = Number(card.dataset.offset);
        if (offset === 0) openLightbox();
        else if (!mobileQuery.matches && Math.abs(offset) === 1) go(active + offset);
      });
      ring.append(card);
    }
    ring.style.setProperty("--rotation", String(rotation));
    syncFaces();
    restartAuto();
  }

  ring.addEventListener("transitionend", event => {
    if (event.target === ring && event.propertyName === "transform") finishTurn();
  });
  function railIndex(clientY) {
    const bounds = rail.getBoundingClientRect();
    const fraction = (clientY - bounds.top) / bounds.height;
    return Math.max(0, Math.min(items.length - 1, Math.floor(fraction * items.length)));
  }

  function navigateRail(index) {
    if (mobileQuery.matches || items.length < 2) return;
    if (turning) railTarget = index;
    else go(index, true);
  }

  rail.addEventListener("pointerdown", event => {
    if (mobileQuery.matches || items.length < 2 || event.isPrimary === false || event.button !== 0) return;
    railPointer = event.pointerId;
    railDesiredIndex = railIndex(event.clientY);
    railThumb.style.top = `${railDesiredIndex / items.length * 100}%`;
    rail.setPointerCapture(event.pointerId);
    event.preventDefault();
  });
  rail.addEventListener("pointermove", event => {
    if (event.pointerId !== railPointer) return;
    const index = railIndex(event.clientY);
    if (index === railDesiredIndex) return;
    railDesiredIndex = index;
    railThumb.style.top = `${index / items.length * 100}%`;
    if (railDragTimer !== null) clearTimeout(railDragTimer);
    railDragTimer = setTimeout(() => {
      railDragTimer = null;
      navigateRail(railDesiredIndex);
    }, 100);
  });
  function releaseRail(event) {
    if (event.pointerId !== railPointer) return;
    if (railDragTimer !== null) clearTimeout(railDragTimer);
    railDragTimer = null;
    const target = railDesiredIndex;
    railPointer = null;
    railDesiredIndex = null;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    if (event.type === "pointerup") navigateRail(target);
    else railThumb.style.top = `${active / items.length * 100}%`;
  }
  rail.addEventListener("pointerup", releaseRail);
  rail.addEventListener("pointercancel", releaseRail);
  rail.addEventListener("keydown", event => {
    if (mobileQuery.matches || items.length < 2) return;
    const target = {
      ArrowUp: active - 1,
      ArrowDown: active + 1,
      Home: 0,
      End: items.length - 1,
    }[event.key];
    if (target === undefined) return;
    event.preventDefault();
    navigateRail(target);
  });

  // Phone/tablet advance only on the timer; desktop retains drag controls.
  stage.addEventListener("pointerdown", event => {
    if (mobileQuery.matches || event.isPrimary === false) return;
    gesture = { id: event.pointerId, x: event.clientX };
  });
  window.addEventListener("pointerup", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const distance = event.clientX - gesture.x;
    gesture = null;
    if (!mobileQuery.matches && Math.abs(distance) > 35) {
      suppressClickUntil = Date.now() + 400;
      go(active + (distance < 0 ? 1 : -1));
    }
  });
  window.addEventListener("pointercancel", () => { gesture = null; });
  root.addEventListener("keydown", event => {
    if (mobileQuery.matches) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); go(active - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); go(active + 1); }
  });

  lightbox?.querySelector("[data-about-lightbox-close]")?.addEventListener("click", () => lightbox.close());
  lightbox?.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
  lightbox?.addEventListener("close", () => restartAuto());
  mobileQuery.addEventListener("change", () => restartAuto());
  reducedMotionQuery.addEventListener("change", () => {
    if (reducedMotionQuery.matches && turning) finishTurn();
    else restartAuto();
  });
  document.addEventListener("visibilitychange", () => restartAuto());
  window.addEventListener("tarek:i18n-change", () => { if (items.length) syncFaces(); });
  if ("IntersectionObserver" in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      restartAuto();
    }, { threshold: 0.35 }).observe(root);
  } else {
    visible = true;
  }

  function start() {
    fetch("/data/hero.json")
      .then(response => { if (!response.ok) throw new Error(`Hero photos: HTTP ${response.status}`); return response.json(); })
      .then(data => { items = (data.items || []).filter(item => item.size === "small" && item.file); render(); })
      .catch(error => console.error(error));
  }
  if (window.tarekI18nReady) start();
  else window.addEventListener("tarek:i18n-ready", start, { once: true });
})();
