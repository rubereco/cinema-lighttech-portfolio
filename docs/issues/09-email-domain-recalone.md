# Email routing: finish Cloudflare setup for @recalone.com → Gmail

**⚠️ Note on domain name:** This issue uses `recalone.com` per the request. The website itself is on `tarekrecolons.com` (configured as `contact@tarekrecolons.com`). Confirm whether `@recalone.com` is intentional (separate brand/domain) or a typo for `recolons.com` before proceeding.

## Tasks

- [ ] **Verify domain ownership** for `recalone.com` in Cloudflare Registrar (or current registrar)
- [ ] **Configure Email Routing** in Cloudflare dashboard:
  - Workers & Pages → Email → Email Routing → Enable
  - Cloudflare auto-creates the necessary MX records
  - Add destination addresses (the Gmail accounts below) and verify them via confirmation email
- [ ] **Set up catch-all or specific routing rules:**
  - `*@recalone.com` → `tarekrecalone@gmail.com` (or just `permisosrecalone@gmail.com`?)
  - Or specific: `contact@` → tarek, `permisos@` → permisos
- [ ] **Test incoming** by sending from a personal Gmail to the custom address
- [ ] **Configure Gmail "Send mail as":** Settings → Accounts → "Send mail as"
  - Add `tarekrecalone@gmail.com` with custom "Send as" address `tarek@recalone.com`
    - SMTP server: `smtp.gmail.com`, port 587, TLS
    - Password: Gmail App Password (not the regular password) — generate at https://myaccount.google.com/apppasswords
    - Verify via confirmation email
  - Add `permisosrecalone@gmail.com` with custom "Send as" address `permisos@recalone.com` (same SMTP settings)
- [ ] **Set "Send mail as" defaults:** Make `tarek@recalone.com` the default for the tarek account, `permisos@recalone.com` for the permisos account
- [ ] **Document the setup** in a private note (which App Password belongs to which account, recovery options, etc.)

## Notes

- App Passwords require 2FA on the Gmail accounts. Enable it first if not already done.
- Cloudflare Email Routing is free for unlimited addresses.
- Gmail's "Send as" with custom domain via SMTP has a daily limit (~500 messages/day for free Gmail).

## Status

Pending domain confirmation + 2FA setup.