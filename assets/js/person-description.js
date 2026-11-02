/* Short partner descriptions shared by the public site and Decap preview. */
(function (root) {
  "use strict";

  const categories = ["direction", "cinematography", "lighting", "sound", "production", "other"];
  const linkTypes = ["portfolio", "social", "website", "imdb", "other"];

  function linkDomain(raw) {
    if (typeof raw !== "string" || !raw.trim()) return "";
    const value = raw.trim();
    try {
      const url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : `https://${value}`);
      if (url.protocol !== "https:" && url.protocol !== "http:") return "";
      return url.hostname.replace(/^www\./i, "");
    } catch (_) {
      return "";
    }
  }

  function describe(person, category, lang, translate) {
    if (!categories.includes(category)) return "";
    const role = translate(`people.role.${category}`, lang);
    if (!role) return "";

    const domain = linkDomain(person.url);
    if (!domain) return `${role}.`;

    const type = linkTypes.includes(person.linkType) ? person.linkType : "website";
    const link = translate(`people.link.${type}`, lang, { domain });
    return link ? `${role}. ${link}` : `${role}.`;
  }

  const api = { categories, linkTypes, linkDomain, describe };
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PersonDescription = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
