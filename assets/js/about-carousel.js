/* Desktop photo slider and phone/tablet auto-rotating photo ring share images. */
(() => {
  const root = document.getElementById("about-carousel");
  if (!root) return;

  const stage = root.querySelector(".about-carousel__stage");
  const ring = document.createElement("div");
  ring.className = "about-carousel__ring";
  const dots = root.querySelector(".about-carousel__dots");
  const lightbox = document.getElementById("about-lightbox");
  const i18n = window.PortfolioI18n;
  const mobileQuery = matchMedia("(max-width: 899px)");
  const reducedMotionQuery = matchMedia("(prefers-reduced-motion: reduce)");
  const autoDelay = 2500;
  let items = [];
  let active = 0;
  let rotation = 0;
  let autoTimer = null;
  let gesture = null;
  let visible = false;

  function label(key, values) { return i18n.t(key, undefined, values) || ""; }
  function altFor(item) { return label(`about.photo.${item.id}.alt`); }

  function update() {
    ring.style.setProperty("--rotation", String(rotation));
    ring.querySelectorAll(".about-carousel__item").forEach((card, index) => {
      card.style.setProperty("--face", String(index));
      card.classList.toggle("is-active", index === active);
      card.setAttribute("aria-hidden", String(index !== active));
      card.tabIndex = index === active ? 0 : -1;
      card.querySelector("img").alt = altFor(items[index]);
    });
    dots.querySelectorAll("button").forEach((dot, index) => {
      dot.setAttribute("aria-current", String(index === active));
      dot.setAttribute("aria-label", label("about.photoPosition", { current: index + 1, total: items.length }));
    });
    if (lightbox?.open) lightbox.querySelector("img").alt = altFor(items[active]);
  }

  function stopAuto() {
    if (autoTimer !== null) clearTimeout(autoTimer);
    autoTimer = null;
  }

  function restartAuto() {
    stopAuto();
    if (!mobileQuery.matches || reducedMotionQuery.matches || document.hidden ||
        !visible || lightbox?.open || items.length < 2) return;
    autoTimer = setTimeout(() => go(active + 1), autoDelay);
  }

  function go(index) {
    if (!items.length) return;
    const target = (index + items.length) % items.length;
    let step = target - active;
    if (step > items.length / 2) step -= items.length;
    if (step < -items.length / 2) step += items.length;
    rotation += step;
    active = target;
    update();
    restartAuto();
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
    dots.replaceChildren();
    items.forEach((item, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "about-carousel__item";
      const image = document.createElement("img");
      image.src = item.file;
      image.alt = altFor(item);
      image.loading = index === 0 ? "eager" : "lazy";
      image.decoding = "async";
      button.append(image);
      button.addEventListener("click", () => {
        if (index === active) openLightbox();
        else if (!mobileQuery.matches) go(index);
      });
      ring.append(button);

      const dot = document.createElement("button");
      dot.type = "button";
      dot.addEventListener("click", () => { if (!mobileQuery.matches) go(index); });
      dots.append(dot);
    });
    update();
    restartAuto();
  }

  root.querySelector("[data-about-prev]")?.addEventListener("click", () => {
    if (!mobileQuery.matches) go(active - 1);
  });
  root.querySelector("[data-about-next]")?.addEventListener("click", () => {
    if (!mobileQuery.matches) go(active + 1);
  });

  // Keep desktop pointer navigation; phone and tablet users get the timed rotation only.
  stage.addEventListener("pointerdown", event => {
    if (mobileQuery.matches || event.isPrimary === false) return;
    gesture = { id: event.pointerId, x: event.clientX };
  });
  window.addEventListener("pointerup", event => {
    if (!gesture || event.pointerId !== gesture.id) return;
    const distance = event.clientX - gesture.x;
    gesture = null;
    if (!mobileQuery.matches && Math.abs(distance) > 35) go(active + (distance < 0 ? 1 : -1));
  });
  window.addEventListener("pointercancel", () => { gesture = null; });
  root.addEventListener("keydown", event => {
    if (mobileQuery.matches) return;
    if (event.key === "ArrowLeft") { event.preventDefault(); go(active - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); go(active + 1); }
  });

  lightbox?.querySelector("[data-about-lightbox-close]")?.addEventListener("click", () => lightbox.close());
  lightbox?.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
  lightbox?.addEventListener("close", restartAuto);
  mobileQuery.addEventListener("change", () => { update(); restartAuto(); });
  reducedMotionQuery.addEventListener("change", restartAuto);
  document.addEventListener("visibilitychange", restartAuto);
  window.addEventListener("tarek:i18n-change", update);
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
