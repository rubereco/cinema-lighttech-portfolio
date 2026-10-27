/* A six-face film reel. The CMS photos cycle through its visible faces. */
(() => {
  const root = document.getElementById("about-carousel");
  if (!root) return;

  const stage = root.querySelector(".about-carousel__stage");
  const dots = root.querySelector(".about-carousel__dots");
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
  let finishTimer = null;
  let autoTimer = null;
  let gesture = null;
  let suppressClickUntil = 0;
  let visible = false;

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
    dots.querySelectorAll("button").forEach((dot, index) => {
      dot.setAttribute("aria-current", String(index === active));
      dot.setAttribute("aria-label", label("about.photoPosition", { current: index + 1, total: items.length }));
    });
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
    if (queuedSteps > 0) {
      queuedSteps -= 1;
      turn(queuedDirection);
    } else {
      restartAuto(true);
    }
  }

  function turn(direction) {
    if (turning || items.length < 2) return;
    stopAuto();
    turning = true;
    root.classList.add("is-turning");
    rotation += direction;
    active = mod(active + direction, items.length);
    ring.style.setProperty("--rotation", String(rotation));
    if (reducedMotionQuery.matches) finishTurn();
    else finishTimer = setTimeout(finishTurn, turnDuration + 100);
  }

  function go(index) {
    if (turning || items.length < 2) return;
    const target = mod(index, items.length);
    let steps = target - active;
    if (steps > items.length / 2) steps -= items.length;
    if (steps < -items.length / 2) steps += items.length;
    if (!steps) return;
    queuedDirection = Math.sign(steps);
    queuedSteps = Math.abs(steps) - 1;
    turn(queuedDirection);
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
    dots.replaceChildren();
    stage.replaceChildren(ring);
    if (!items.length) return;

    for (let face = 0; face < faceCount; face += 1) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "about-carousel__item";
      card.style.setProperty("--face", String(face));
      const picture = document.createElement("span");
      picture.className = "about-carousel__picture";
      const wash = document.createElement("img");
      wash.className = "about-carousel__wash";
      wash.alt = "";
      wash.setAttribute("aria-hidden", "true");
      const photo = document.createElement("img");
      photo.className = "about-carousel__photo";
      [wash, photo].forEach(image => { image.decoding = "async"; });
      picture.append(wash, photo);
      card.append(picture);
      card.addEventListener("click", () => {
        if (turning || Date.now() < suppressClickUntil) return;
        const offset = Number(card.dataset.offset);
        if (offset === 0) openLightbox();
        else if (!mobileQuery.matches && Math.abs(offset) === 1) go(active + offset);
      });
      ring.append(card);
    }
    items.forEach((_, index) => {
      const dot = document.createElement("button");
      dot.type = "button";
      dot.addEventListener("click", () => { if (!mobileQuery.matches) go(index); });
      dots.append(dot);
    });
    ring.style.setProperty("--rotation", String(rotation));
    syncFaces();
    restartAuto();
  }

  ring.addEventListener("transitionend", event => {
    if (event.target === ring && event.propertyName === "transform") finishTurn();
  });
  root.querySelector("[data-about-prev]")?.addEventListener("click", () => {
    if (!mobileQuery.matches) go(active - 1);
  });
  root.querySelector("[data-about-next]")?.addEventListener("click", () => {
    if (!mobileQuery.matches) go(active + 1);
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
