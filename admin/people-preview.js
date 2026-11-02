/* Decap's live preview for the short sentence in every selected section. */
(function () {
  "use strict";

  if (!window.CMS || !window.PersonDescription || !window.createClass || !window.h) return;

  const h = window.h;
  const Preview = window.createClass({
    getInitialState: function () {
      return { translations: null, error: false };
    },
    componentDidMount: function () {
      this.props.getCollection("i18n", "translations")
        .then(entry => {
          const raw = entry?.get("data");
          const data = raw?.toJS ? raw.toJS() : raw;
          this.setState({
            translations: new Map((data?.entries || []).map(item => [item.key, item])),
          });
        })
        .catch(() => this.setState({ error: true }));
    },
    render: function () {
      const raw = this.props.entry.get("data");
      const person = raw?.toJS ? raw.toJS() : raw || {};
      const categories = person.partnership?.categories || [];
      const translations = this.state.translations;
      const translate = (key, lang, values = {}) => {
        const entry = translations?.get(key);
        const phrase = entry?.[lang] || entry?.en || "";
        return phrase.replace(/\{([a-zA-Z]+)\}/g, (_, name) => values[name] ?? `{${name}}`);
      };

      let content;
      if (this.state.error) {
        content = h("p", {}, "No se pudieron cargar las frases. Recarga el editor para ver la vista previa.");
      } else if (!translations) {
        content = h("p", {}, "Cargando frases…");
      } else if (!categories.length) {
        content = h("p", {}, "Selecciona al menos una sección en Colaboración habitual para ver las frases.");
      } else {
        content = categories.map(category => h("section", { className: "person-preview__section", key: category },
          h("h2", {}, translate(`partners.section.${category}`, "es") || category),
          h("p", {}, h("strong", {}, "Español"), h("span", {},
            window.PersonDescription.describe(person, category, "es", translate))),
          h("p", {}, h("strong", {}, "English"), h("span", {},
            window.PersonDescription.describe(person, category, "en", translate))),
        ));
      }

      return h("main", { className: "person-preview" },
        h("p", { className: "person-preview__eyebrow" }, "Vista previa de las descripciones"),
        h("h1", {}, person.name || "Nueva persona"),
        content,
      );
    },
  });

  window.CMS.registerPreviewStyle("/admin/people-preview.css");
  window.CMS.registerPreviewTemplate("people", Preview);
})();
