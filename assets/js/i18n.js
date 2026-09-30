/* Shared English/Spanish text loader for the portfolio and legal page. */
window.PortfolioI18n = (() => {
  const storageKey = "tarek.lang";
  let entries = new Map();
  let active = "en";
  let ready = false;

  async function load() {
    if (ready) return;
    const response = await fetch("/data/i18n.json");
    if (!response.ok) throw new Error(`Translations: HTTP ${response.status}`);
    const data = await response.json();
    entries = new Map((data.entries || []).map(entry => [entry.key, entry]));
    ready = true;
  }

  function detectLanguage() {
    const query = new URL(location.href).searchParams.get("lang");
    if (query === "en" || query === "es") return query;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored === "en" || stored === "es") return stored;
    } catch (_) {}
    return (navigator.language || "en").toLowerCase().startsWith("es") ? "es" : "en";
  }

  function t(key, lang = active, values = {}) {
    const entry = entries.get(key);
    const phrase = entry?.[lang] || entry?.en || null;
    if (phrase === null) return null;
    return phrase.replace(/\{([a-zA-Z]+)\}/g, (_, name) => values[name] ?? `{${name}}`);
  }

  function setMeta(name, content) {
    if (!content) return;
    document.querySelectorAll(`meta[name="${name}"],meta[property="${name}"]`)
      .forEach(el => el.setAttribute("content", content));
  }

  function apply(lang) {
    active = lang === "es" ? "es" : "en";
    document.documentElement.lang = active;
    const titleKey = document.body?.dataset.titleKey || "meta.title";
    const title = t(titleKey);
    if (title) document.title = title;
    const description = t(titleKey === "legal.title" ? "legal.description" : "meta.description");
    setMeta("description", description);
    setMeta("og:title", title);
    setMeta("og:description", description);
    setMeta("og:locale", active === "es" ? "es_ES" : "en_US");
    document.querySelectorAll("[data-i18n]").forEach(el => {
      const value = t(el.dataset.i18n);
      if (value !== null) el.textContent = value;
    });
    document.querySelectorAll("[data-i18n-html]").forEach(el => {
      const value = t(el.dataset.i18nHtml);
      if (value !== null) el.innerHTML = value;
    });
    document.querySelectorAll("[data-i18n-attr]").forEach(el => {
      el.dataset.i18nAttr.split(";").forEach(pair => {
        const [attr, key] = pair.split(":").map(x => x.trim());
        if (attr && key && t(key) !== null) el.setAttribute(attr, t(key));
      });
    });
    document.querySelectorAll("[data-lang]").forEach(button => {
      button.setAttribute("aria-pressed", button.dataset.lang === active ? "true" : "false");
    });
    window.dispatchEvent(new CustomEvent("tarek:i18n-change", { detail: { lang: active } }));
  }

  function setLanguage(lang) {
    if (lang !== "en" && lang !== "es") return;
    try { localStorage.setItem(storageKey, lang); } catch (_) {}
    apply(lang);
  }

  return { load, detectLanguage, t, apply, setLanguage, get lang() { return active; } };
})();
