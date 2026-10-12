/* Keep the phone introduction compact while leaving the full text editable in i18n. */
(() => {
  const copy = document.querySelector(".about-copy");
  const body = document.getElementById("about-body");
  const button = document.querySelector("[data-about-read-more]");
  if (!copy || !body || !button) return;

  const phone = window.matchMedia("(max-width: 699px)");
  let expanded = false;
  let frame = 0;

  function updateButton() {
    button.setAttribute("aria-expanded", String(expanded));
    const key = expanded ? "about.readLess" : "about.readMore";
    button.textContent = window.PortfolioI18n?.t(key) || (expanded ? "Read less" : "Read more");
  }

  function measure() {
    frame = 0;
    if (!phone.matches) {
      expanded = false;
      copy.classList.remove("is-collapsible", "is-expanded");
      updateButton();
      return;
    }

    const paragraphs = [...body.querySelectorAll(":scope > p")];
    const lineHeight = parseFloat(getComputedStyle(body).lineHeight) || 26;
    const second = paragraphs[1];
    const collapsedHeight = Math.ceil(second
      ? second.offsetTop + second.offsetHeight / 2
      : lineHeight * 7.5);
    const fullHeight = body.scrollHeight;
    const canCollapse = fullHeight - collapsedHeight > lineHeight;

    body.style.setProperty("--about-collapsed-height", `${collapsedHeight}px`);
    body.style.setProperty("--about-expanded-height", `${fullHeight}px`);
    copy.classList.toggle("is-collapsible", canCollapse);
    if (!canCollapse) expanded = false;
    copy.classList.toggle("is-expanded", canCollapse && expanded);
    updateButton();
  }

  function scheduleMeasure() {
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(measure);
  }

  button.addEventListener("click", () => {
    expanded = !expanded;
    copy.classList.toggle("is-expanded", expanded);
    updateButton();
  });

  window.addEventListener("resize", scheduleMeasure);
  window.addEventListener("tarek:i18n-change", scheduleMeasure);
  document.fonts?.ready.then(scheduleMeasure);
  scheduleMeasure();
})();
