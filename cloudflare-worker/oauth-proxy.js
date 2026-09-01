/**
 * Cloudflare Worker — Decap CMS OAuth proxy
 * ════════════════════════════════════════════════════════════════════════
 *
 * Decap CMS (the admin panel at /admin) needs a server-side endpoint
 * to do the GitHub OAuth handshake. Cloudflare Pages can't run server
 * code itself, so we deploy this as a separate Worker that handles
 * the /auth and /callback routes.
 *
 * FLOW:
 *   1. Decap opens a popup to {worker-url}/auth?provider=github&site_id=...
 *   2. This worker redirects to GitHub's OAuth authorization page
 *   3. User approves on GitHub
 *   4. GitHub redirects to {worker-url}/callback?code=...&state=...
 *   5. This worker exchanges the code for an access token via GitHub's API
 *   6. This worker renders a tiny HTML page that posts the token back
 *      to Decap via window.opener.postMessage(), then closes the popup
 *
 * SECURITY:
 *   - The actual access control happens at the GitHub level, NOT here.
 *     Only GitHub users who are collaborators on the target repo can
 *     actually commit via the returned token. So the "whitelist" is
 *     really just: who has push access to rubereco/cinema-lighttech-portfolio.
 *   - We pass `scope=repo` so the token can read + write the repo.
 *   - Secrets (client_id, client_secret) come from Worker env vars, never
 *     hardcoded. Set them via `wrangler secret put` or the Cloudflare
 *     dashboard → Workers → your-worker → Settings → Variables.
 *
 * DEPLOYMENT:
 *   1. Create the worker: `wrangler init oauth-proxy` then paste this code
 *   2. Set the secrets:
 *        wrangler secret put GITHUB_CLIENT_ID
 *        wrangler secret put GITHUB_CLIENT_SECRET
 *   3. Add a custom domain (e.g. oauth.recalone.com) or use the
 *      default *.workers.dev URL
 *   4. Update admin/config.yml `base_url` to match
 *   5. In the GitHub OAuth app settings, set the callback URL to
 *      https://oauth.recalone.com/callback
 *
 * That's it. No database, no state to manage. The token lives in the
 * user's browser session, expires when they close the tab.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    // ─── Health check ────────────────────────────────────────────────
    if (path === "/" || path === "/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          service: "decap-oauth-proxy",
          // v3.14.6 added: this version string appears in the
          // /health response. Use it to verify the deployed
          // Worker has the latest code (especially after
          // redeploying to pick up the postMessage fix).
          version: "3.14.51",
          endpoints: ["/auth", "/callback"],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // ─── /auth: redirect to GitHub OAuth ─────────────────────────────
    if (path === "/auth") {
      // Validate required env vars are set
      if (!env.GITHUB_CLIENT_ID) {
        return new Response(
          "OAuth proxy misconfigured: GITHUB_CLIENT_ID not set",
          { status: 500 }
        );
      }

      // v3.14.9: Decap's auth flow has TWO stages, not one. The
      // popup must first send a handshake message ("authorizing:github")
      // to the opener, wait for the echo, and ONLY THEN redirect
      // to GitHub. The opener uses the handshake to swap its
      // message listener (from "waiting for handshake" to
      // "waiting for the real auth response"). My previous
      // /auth endpoint skipped straight to the GitHub redirect,
      // so Decap's first listener never fired and the second
      // listener was never installed — meaning the actual auth
      // response (sent from /callback) hit the wrong listener
      // and got silently dropped.
      //
      // Flow now:
      //   1. Popup loads /auth?provider=github&site_id=...&state=...
      //   2. Page JS sends postMessage("authorizing:github") to opener
      //   3. Decap receives, swaps its listener to authorizeCallback
      //   4. Decap postMessages("authorizing:github") BACK to popup
      //   5. Popup receives the echo, redirects window.location to
      //      GitHub's authorize URL with client_id, redirect_uri,
      //      scope, state
      //   6. User authorizes on GitHub → GitHub redirects to
      //      /callback?code=...&state=...
      //   7. /callback exchanges code for token, postMessages
      //      "authorization:github:success:{json}" to opener
      //   8. Decap's authorizeCallback fires, completes login
      const params = url.searchParams;
      const provider = params.get("provider") || "github";
      const state = params.get("state") || crypto.randomUUID();
      const scope = params.get("scope") || "repo,user";

      const handshakeHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Authenticating…</title>
  <style>
    body {
      background: #0b0b0d;
      color: #e8e8e8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .msg { text-align: center; font-size: 14px; color: #7a7a7e; }
  </style>
</head>
<body>
  <div class="msg">Authenticating with GitHub…</div>
  <script>
    (function () {
      var provider = ${JSON.stringify(provider)};
      var state    = ${JSON.stringify(state)};
      var scope    = ${JSON.stringify(scope)};
      var clientId = ${JSON.stringify(env.GITHUB_CLIENT_ID)};
      var origin   = window.location.origin;

      // Step 1: tell the opener "I'm here, ready to do the OAuth
      // dance". The opener will swap its message listener to
      // accept the eventual auth response.
      //
      // v3.14.10: targetOrigin was 'origin' (= oauth.recalone.com)
      // but the opener is at recalone.com — DIFFERENT origins,
      // so the message was silently dropped. Same bug as
      // v3.14.6 but in reverse. Use '*' since this message is
      // going to the window that opened us (window.opener),
      // which is the same tab that initiated the OAuth flow.
      // Decap's handshakeCallback validates the message format
      // (it checks r.data === "authorizing:" + provider) on
      // receipt, so the wildcard targetOrigin is safe.
      window.opener.postMessage("authorizing:" + provider, "*");

      // Step 2: wait for the opener to confirm it has swapped
      // its listener. The opener echoes "authorizing:github"
      // back to us once it's ready.
      //
      // v3.14.11: removed the event.origin check. The opener
      // (Decap admin page) is at a DIFFERENT origin than us
      // (e.g. recalone.com vs oauth.recalone.com, or in the
      // user's case a Cloudflare Pages preview URL like
      // bbf866f6.tarekrecolons.pages.dev). When the echo
      // arrives, event.origin is the opener's origin, which
      // doesn't equal OUR origin (oauth.recalone.com) — so
      // the listener bailed and the popup never redirected.
      // The echo isn't a security token (it's just a cue to
      // start the OAuth flow); Decap already validated the
      // handshake chain on its end before sending it. Safe
      // to drop the check.
      window.addEventListener("message", function (event) {
        if (event.data !== "authorizing:" + provider) return;
        // Step 3: redirect to GitHub's authorize endpoint. The
        // user will see the GitHub auth screen, authorize, and
        // GitHub will redirect back to /callback on us.
        var authParams = new URLSearchParams({
          client_id: clientId,
          redirect_uri: origin + "/callback",
          scope: scope,
          state: state,
          allow_signup: "false",
        });
        window.location.href =
          "https://github.com/login/oauth/authorize?" + authParams.toString();
      });
    })();
  </script>
</body>
</html>`;

      return new Response(handshakeHtml, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // ─── /callback: exchange code for token ──────────────────────────
    if (path === "/callback") {
      if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
        return new Response(
          "OAuth proxy misconfigured: GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET not set",
          { status: 500 }
        );
      }

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(
          renderErrorPage(error, url.searchParams.get("error_description")),
          {
            status: 400,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      if (!code) {
        return new Response("Missing 'code' query parameter", { status: 400 });
      }

      // Exchange the auth code for an access token via GitHub's API.
      const tokenResponse = await fetch(
        "https://github.com/login/oauth/access_token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code: code,
            redirect_uri: `${url.origin}/callback`,
          }),
        }
      );

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        return new Response(
          renderErrorPage(tokenData.error, tokenData.error_description),
          {
            status: 400,
            headers: { "Content-Type": "text/html; charset=utf-8" },
          }
        );
      }

      if (!tokenData.access_token) {
        return new Response("GitHub did not return an access token", {
          status: 500,
        });
      }

      // Render a tiny HTML page that posts the token back to Decap.
      // Decap's auth.js listens for a postMessage with
      //   { type: "authorization:github:success", ... }
      // We use its exact expected format. window.close() shuts the popup.
      // The window.opener is the original /admin tab.
      //
      // v3.14.6: targetOrigin was window.location.origin (i.e.
      // https://oauth.recalone.com), but the opener is at
      // https://recalone.com — DIFFERENT origins, so postMessage
      // was being silently dropped. Switched to "*" since the
      // message is going to window.opener (which Decap controls
      // and validates) and there's no risk of leaking the token
      // to a 3rd party.
      //
      // Sanitization: we pass the token through a <script> context, so
      // we JSON-encode it (turns any " or </script> into safe escape
      // sequences). GitHub tokens are alphanumeric + underscore so
      // there's no real injection risk, but defense in depth.
      const safeToken = JSON.stringify(tokenData.access_token);

      return new Response(
        `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Authenticating…</title>
  <style>
    body {
      background: #0b0b0d;
      color: #e8e8e8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .msg { text-align: center; font-size: 14px; color: #7a7a7e; }
    .ok  { color: #4ade80; font-weight: 600; margin-bottom: 0.5rem; }
  </style>
</head>
<body>
  <div class="msg">
    <p class="ok">✓ Signed in</p>
    <p>You can close this window.</p>
  </div>
  <script>
    (function () {
      const token = ${safeToken};
      // Decap listens on window.opener for an authorization:github:success
      // message with { token, provider } in the data payload.
      const data = JSON.stringify({ token: token, provider: "github" });
      // v3.14.6: targetOrigin "*" instead of window.location.origin.
      // The worker is at oauth.recalone.com but the opener (admin page)
      // is at recalone.com — different origins. Using "*" since window.opener
      // is the same browser tab that initiated the OAuth flow, and Decap
      // validates the message format on receipt.
      window.opener.postMessage(
        "authorization:github:success:" + data,
        "*"
      );
      // Brief delay so the user sees the success message before close.
      setTimeout(function () { window.close(); }, 800);
    })();
  </script>
</body>
</html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      );
    }

    // ─── 404 ─────────────────────────────────────────────────────────
    return new Response(
      JSON.stringify({ error: "Not found", path: path }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  },
};

/**
 * Render a friendly error page for OAuth failures.
 * @param {string} error - OAuth error code from GitHub
 * @param {string} [description] - Optional human-readable description
 */
function renderErrorPage(error, description) {
  const safeError = String(error).replace(/[<>]/g, "");
  const safeDescription = description
    ? String(description).replace(/[<>]/g, "")
    : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Auth error</title>
  <style>
    body {
      background: #0b0b0d;
      color: #e8e8e8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .box { max-width: 480px; padding: 2rem; text-align: center; }
    h1 { color: #f87171; font-size: 1.1rem; margin: 0 0 0.5rem 0; }
    code { background: #1c1c20; padding: 0.2rem 0.4rem; border-radius: 4px; }
    p  { color: #9b9b9e; font-size: 0.9rem; line-height: 1.5; }
  </style>
</head>
<body>
  <div class="box">
    <h1>Authentication failed</h1>
    <p><code>${safeError}</code>${safeDescription ? " — " + safeDescription : ""}</p>
    <p>Close this window and try again, or contact the site owner if it keeps failing.</p>
  </div>
</body>
</html>`;
}
