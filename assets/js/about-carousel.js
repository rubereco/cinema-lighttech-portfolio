/* The same four photographs appear in a simple desktop slider and a mobile 3D ring. */
(() => {
  const root = document.getElementById("about-carousel");
  if (!root) return;
  const stage = root.querySelector(".about-carousel__stage");
  const dots = root.querySelector(".about-carousel__dots");
  const lightbox = document.getElementById("about-lightbox");
  const i18n = window.PortfolioI18n;
  let items = [];
  let active = 0;
  let rotation = 0;
  let startX = null;
  let swiped = false;

  function label(key, values) { return i18n.t(key, undefined, values) || ""; }
  function altFor(item) { return label(`about.photo.${item.id}.alt`); }

  function update() {
    const mobile = matchMedia("(max-width: 899px)").matches;
    stage.querySelectorAll(".about-carousel__item").forEach((card, index) => {
      const offset = index - rotation;
      card.style.setProperty("--ring-offset", offset);
      card.classList.toggle("is-active", index === active);
      card.setAttribute("aria-hidden", String(!mobile && index !== active));
      card.tabIndex = index === active ? 0 : -1;
    });
    dots.querySelectorAll("button").forEach((dot, index) => {
      dot.setAttribute("aria-current", String(index === active));
      dot.setAttribute("aria-label", label("about.photoPosition", { current: index + 1, total: items.length }));
    });
    stage.querySelectorAll(".about-carousel__item img").forEach((image, index) => { image.alt = altFor(items[index]); });
    if (lightbox?.open) lightbox.querySelector("img").alt = altFor(items[active]);
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
  }

  function openLightbox() {
    const item = items[active];
    if (!item || !lightbox) return;
    const img = lightbox.querySelector("img");
    img.src = item.file;
    img.alt = altFor(item);
    lightbox.showModal();
  }

  function render() {
    stage.replaceChildren();
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
      button.addEventListener("click", () => index === active ? openLightbox() : go(index));
      stage.append(button);
      const dot = document.createElement("button");
      dot.type = "button";
      dot.addEventListener("click", () => go(index));
      dots.append(dot);
    });
    update();
  }

  root.querySelector("[data-about-prev]")?.addEventListener("click", () => go(active - 1));
  root.querySelector("[data-about-next]")?.addEventListener("click", () => go(active + 1));
  root.addEventListener("pointerdown", event => { startX = event.clientX; });
  root.addEventListener("pointerup", event => {
    if (startX === null) return;
    const distance = event.clientX - startX;
    startX = null;
    if (Math.abs(distance) > 35) {
      swiped = true;
      setTimeout(() => { swiped = false; }, 150);
      go(active + (distance < 0 ? 1 : -1));
    }
  });
  root.addEventListener("click", event => {
    if (!swiped) return;
    swiped = false;
    event.preventDefault();
    event.stopPropagation();
  }, true);
  root.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft") { event.preventDefault(); go(active - 1); }
    if (event.key === "ArrowRight") { event.preventDefault(); go(active + 1); }
  });
  lightbox?.querySelector("[data-about-lightbox-close]")?.addEventListener("click", () => lightbox.close());
  lightbox?.addEventListener("click", event => { if (event.target === lightbox) lightbox.close(); });
  window.addEventListener("resize", update);
  window.addEventListener("tarek:i18n-change", update);
  function start() {
    fetch("/data/hero.json")
      .then(response => { if (!response.ok) throw new Error(`Hero photos: HTTP ${response.status}`); return response.json(); })
      .then(data => { items = (data.items || []).filter(item => item.size === "small" && item.file); render(); })
      .catch(error => console.error(error));
  }
  if (window.tarekI18nReady) start();
  else window.addEventListener("tarek:i18n-ready", start, { once: true });
})();
