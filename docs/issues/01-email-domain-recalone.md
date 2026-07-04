# Email & Domain Setup: Cloudflare routing + Gmail Send As for @recalone.com

**Context:** Tarek operates two separate digital identities:
- **`tarekrecolons.com`** — his personal portfolio website (gaffer/lighting technician)
- **`recalone.com`** — his enterprise / production company domain (a separate brand for the business entity)

This issue covers the **enterprise side only** (`recalone.com`). The personal portfolio (`tarekrecolons.com`) is already live at Cloudflare Pages and is unaffected.

**Goal:** Make `recalone.com` a fully-functional email domain — receiving forwarded to existing Gmail accounts, and sending outbound "from" the custom domain.

## Tasks

### Cloudflare Routing (incoming mail)

- [ ] **Verify domain ownership** for `recalone.com` in Cloudflare Registrar (or current registrar). If not yet in Cloudflare, transfer or add it.
- [ ] **Configure Email Routing** in Cloudflare dashboard:
  - Workers & Pages → Email → Email Routing → Enable
  - Cloudflare auto-creates the necessary MX records for the domain
  - Add destination addresses (the Gmail accounts below) and verify each one via the confirmation email
- [ ] **Set up routing rules:**
  - Catch-all `*@recalone.com` → both Gmail accounts (or just `permisosrecalone@gmail.com`?)
  - Or specific forwards:
    - `tarek@recalone.com` → `tarekrecalone@gmail.com`
    - `permisos@recalone.com` → `permisosrecalone@gmail.com`
    - `*@recalone.com` (catch-all) → both, so no message is lost
- [ ] **Test incoming** by sending from a personal Gmail to the custom address(es). Confirm it lands in the right inbox.
- [ ] **Set SPF / DKIM / DMARC records** so outgoing mail from the custom domain isn't flagged as spam.

### Gmail "Send As" (outgoing mail)

- [ ] **Enable 2FA** on both Gmail accounts if not already enabled (required for App Passwords).
- [ ] **Generate App Passwords** at https://myaccount.google.com/apppasswords:
  - One for `tarekrecalone@gmail.com` (e.g. "Custom email: tarek@recalone.com")
  - One for `permisosrecalone@gmail.com` (e.g. "Custom email: permisos@recalone.com")
  - Save these passwords in a password manager.
- [ ] **Configure "Send mail as"** in Gmail (Settings → See all settings → Accounts → "Send mail as"):
  - For `tarekrecalone@gmail.com`:
    - Name: "Tarek Recolons"
    - Email: `tarek@recalone.com` (or whatever the user confirms)
    - Treat as alias: yes
    - SMTP server: `smtp.gmail.com`
    - Port: 587
    - Username: `tarekrecalone@gmail.com`
    - Password: the App Password
    - Secured connection: TLS
    - Verify via the confirmation email
  - Same for `permisosrecalone@gmail.com`.
- [ ] **Set defaults:**
  - `tarekrecalone@gmail.com` default → send as `tarek@recalone.com`
  - `permisosrecalone@gmail.com` default → send as `permisos@recalone.com`
- [ ] **Test sending** from each Gmail account using the custom "from" address. Confirm the recipient sees the right address.

### Documentation

- [ ] **Save the setup details** (which App Password belongs to which account, recovery options, etc.) in a private note (1Password / Bitwarden / secure doc).
- [ ] **Backup plan:** document how to recover if the App Password is lost (regenerate at myaccount.google.com/apppasswords).

## Notes

- Cloudflare Email Routing is free for unlimited addresses.
- Gmail's "Send as" with custom domain via SMTP has a daily limit (~500 messages/day for free Gmail).
- App Passwords are 16 characters and account-specific. They can be revoked at any time.

## Status

Pending: 2FA enabled on both Gmail accounts, decision on display name and preferred "from" address.