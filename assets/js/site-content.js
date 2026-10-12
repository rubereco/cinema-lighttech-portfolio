/* Contact links are edited in the admin's Site collection. */
fetch("/data/site.json")
  .then(response => { if (!response.ok) throw new Error(`Site: HTTP ${response.status}`); return response.json(); })
  .then(site => {
    const contact = site.contact || {};
    function applyEmail() {
      if (!contact.email) return;
      document.querySelectorAll('[data-contact="email"], [data-site-email]').forEach(email => {
        email.href = `mailto:${contact.email}`;
        email.textContent = contact.email;
      });
    }
    applyEmail();
    // The legal translation replaces its HTML when the language changes.
    window.addEventListener("tarek:i18n-change", applyEmail);
    const imdb = document.querySelector('[data-contact="imdb"]');
    if (imdb && /^https:\/\//.test(contact.imdbUrl || "")) imdb.href = contact.imdbUrl;
    const instagram = document.querySelector('[data-contact="instagram"]');
    if (instagram && /^https:\/\//.test(contact.instagramUrl || "")) {
      instagram.href = contact.instagramUrl;
      instagram.textContent = `@${contact.instagram || new URL(contact.instagramUrl).pathname.split("/").filter(Boolean).pop()}`;
    }
  })
  .catch(error => console.error(error));
