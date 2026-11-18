# Runbook: move the platform to therapysts.app (spec §4.1b)

**What moves:** the app, the API and every practice address.

| From | To |
|---|---|
| `app.unclutterdesk.com` | `therapysts.app` |
| `api.unclutterdesk.com` | `api.therapysts.app` |
| `{slug}.unclutterdesk.com` | `{slug}.therapysts.app` |
| Custom domains pointing at `customers.unclutterdesk.com` | Custom domains pointing at `customers.therapysts.app` |

The tenant router and the app's Pages project move to the **Therapysts** Cloudflare account, which already has the profiles Worker. That is what the §6.16 `PROFILES` service binding needs, since bindings only work within one account.

**What doesn't move yet:**
- **The marketing site** stays on `unclutterdesk.com` (the landing Pages project in the Unclutter account) until `apps/landing` merges into `apps/profiles` on `therapysts.com`. `MARKETING_URL` keeps its value everywhere until then.
- **Profiles** are already on `therapysts.com`, and R2 is already in the Therapysts account.

**Code, in PRs into `dev`:**
- `move/therapysts-app`:
  - The router serves `{slug}.therapysts.app`, with the app at the bare domain.
  - The router and app deploy to Therapysts, and the app build reads the domain settings.
  - The CSP names the new API host.
  - The nginx block for the new API host.
  - This runbook.
- `move/legacy-redirects`: the Worker that 301s every old address to its new one. It is deployed by hand, at the cutover.

**Everything else is settings.** Every address is a setting (§4.1a), so the code defaults keep today's values until the cleanup in §4 below.

Who does each step: **[you]** = dashboard, registrar or server; **[Claude]** = code, GitHub settings, deploys I can run from here.

---

## 1. Prepare (no visitor sees any of this)

Do these in any order, days before the cutover.

### Cloudflare, Therapysts account, zone `therapysts.app`

1. **[you] Confirm the zone is Active** in the Therapysts account.
2. **[Claude] DNS records.** **Done 17 Nov 2026**, through the Cloudflare API with a temporary token (`~/.config/cloudflare/therapysts-move.env`):
   - `api`: `A 169.58.3.186` and `AAAA 2a02:c207:2343:4945::1`, **DNS-only (grey cloud)** so certbot can issue the certificate (§1.9). Proxy both afterwards, as in `CLOUDFLARE_SETUP.md` §2. `deploy/nginx/api-therapysts.app.conf` already listens on both addresses.
   - `*`: `AAAA 100::`, **proxied**. Worker routes only run on proxied records, so this is what makes every `{slug}.therapysts.app` reach the router.
   - `customers`: `AAAA 100::`, **proxied**. This is the address every custom domain points at, and the Cloudflare for SaaS fallback origin (§1.4). It is its own record rather than a CNAME to the bare domain, because the bare domain only exists once the Pages custom domain is added (§2.4).
   - The bare domain has no record by hand: the Pages custom domain adds it.
3. **[Claude] Worker route exclusion for the API.** **Done 17 Nov 2026.** route `api.therapysts.app/*` with **Worker = None**. Without it, the router's `*.therapysts.app/*` route would answer every API call once `api` is proxied (the same trap noted in `CLOUDFLARE_SETUP.md` §1).
4. **[you] Cloudflare for SaaS on `therapysts.app`.** **Done 17 Nov 2026:** enabled, with fallback origin `customers.therapysts.app` Active. zone → SSL/TLS → Custom Hostnames → Enable. Set the fallback origin to `customers.therapysts.app`.
   - Cloudflare refuses both through the API until the zone has Cloudflare for SaaS enabled (error 1456; custom hostnames return 1404, no quota), so enabling it is a dashboard step.
   - The fallback origin can only be set in the dashboard. Follow `CLOUDFLARE_SETUP.md` §5 "One-time".
5. **[you] An API token for the API server.** **Done 17 Nov 2026:** `therapysts-api-server`, kept in `~/.config/cloudflare/therapysts-api-server.env` until §2.2; tested by creating and deleting a custom hostname and a route. No member account is needed any more.
   - **Why it changed:** `CLOUDFLARE_SETUP.md` §5 found on 5 Oct 2026 that custom-hostname endpoints refused API tokens. On 17 Nov 2026 a scoped token created and deleted a custom hostname on `therapysts.app`, and set its fallback origin. `cloudflare-saas.service.ts` already uses `CLOUDFLARE_API_TOKEN` when no Global API key is set.
   - **How:** My Profile → API Tokens → Create Token → Custom token, named e.g. `therapysts-api-server`:
     - Zone → **SSL and Certificates → Edit** (custom hostnames)
     - Zone → **Workers Routes → Edit** (each custom domain's router route)
     - Zone → **Zone → Read**
     - Zone resources: **Include → Specific zone → `therapysts.app`** only
     - No expiry. The server uses it for as long as custom domains exist.
   - Keep the value for §2.2. It goes only in the server's `.env`.
   - The `therapysts.app` zone ID is `0b58d5b875e210d484b8b82c6a96f968`.

6. **[you] An API token for GitHub deploys** in the Therapysts account, with these permissions:
   - Account → Workers Scripts: Edit
   - Account → Cloudflare Pages: Edit
   - Zone `therapysts.app` → Workers Routes: Edit
   - Account → Account Settings: Read

   **Decided:** the router and app deploys reuse the existing `THERAPYSTS_CLOUDFLARE_API_TOKEN` (the profiles deploy's token). If it lacks one of these permissions, the first release fails at that deploy step, before anything changes for visitors; add the permission to the token in the dashboard and re-run the workflow.

### Pages project for the app

7. **[Claude] Create the Pages project.** **Done 17 Nov 2026:** `therapysts-app` exists in the Therapysts account, at exactly `therapysts-app.pages.dev`, which matches `ORIGIN_HOST`.
   - It is a classic Pages project, like `app-unclutterdesk`, because `deploy-app.yml` runs `wrangler pages deploy`. Newer Wrangler versions create Pages projects as Workers unless `--force` is passed, so it was created with `wrangler pages project create therapysts-app --production-branch main --force`, from a folder with no wrangler config.
   - It has no deployment until the release in §2.3.

### Router secret in the new account

The router is renamed **`therapysts-tenant-router`** in the Therapysts account (`apps/tenant-router/wrangler.jsonc`), ahead of the full rename. The old `unclutterdesk-tenant-router` stays in the Unclutter account until §2.6, and its name comes back with the rollback in §3. The package and folder names change with the full rename.

8. **[you] Set the router's proxy secret.** **Done 17 Nov 2026**, on `therapysts-tenant-router`. It is a Worker secret, set with Wrangler. Use **the same value** the API already has, so the old router and the new one both match the API through the switch.
   1. On the server, show the current value:
      ```
      grep '^ROUTER_PROXY_SECRET=' /home/unclutterdesk/app/.env | cut -d= -f2-
      ```
   2. On your Mac, in your own terminal (not through Claude Code's `!`, because it prompts):
      ```
      cd ~/Projects/Unclutter/unclutterdesk/.worktrees/move-therapysts-app/apps/tenant-router
      CLOUDFLARE_ACCOUNT_ID=664a59b7ca9915d50f96a0b3890344fa pnpm exec wrangler secret put ROUTER_PROXY_SECRET
      ```
      Paste the value when asked. The router doesn't exist in Therapysts yet, so Wrangler asks whether to create it: answer **yes**. That makes an empty placeholder Worker with no routes. The release in §2.3 puts the code in, and the secret stays.
   3. Check: `CLOUDFLARE_ACCOUNT_ID=664a59b7ca9915d50f96a0b3890344fa pnpm exec wrangler secret list` shows `ROUTER_PROXY_SECRET`.
   - If no value exists yet, generate one with `openssl rand -hex 32` and put the same value in the Worker and in the API's `.env`.

### Server (API)

9–10. **[you] Certificate and nginx for `api.therapysts.app`.** **Done 17 Nov 2026:** certificate valid to 15 Feb 2027; `/health` answers on the new host; zone SSL set to **Full (strict)**, like `unclutterdesk.com`, and both `api` records proxied. The `api` records are DNS-only, which certbot needs. Run as root (or with `sudo`):
   1. Fetch the nginx file from the PR branch. The server's checkout is on `main`, where the file doesn't exist yet:
      ```
      cd /home/unclutterdesk/app
      git fetch origin move/therapysts-app
      git show origin/move/therapysts-app:deploy/nginx/api-therapysts.app.conf > /root/api-therapysts.app.conf
      ```
   2. Install **only its port-80 block** first. The 443 block names a certificate that doesn't exist yet, so `nginx -t` would refuse the whole file:
      ```
      awk '/^server \{/{n++} n==1' /root/api-therapysts.app.conf > /etc/nginx/conf.d/api-therapysts.app.conf
      nginx -t && systemctl reload nginx
      ```
   3. Issue the certificate:
      ```
      certbot certonly --webroot -w /var/www/html -d api.therapysts.app
      ```
   4. Install the whole file:
      ```
      cp /root/api-therapysts.app.conf /etc/nginx/conf.d/api-therapysts.app.conf
      nginx -t && systemctl reload nginx
      ```
   5. Check it (bound-listen rule, `deploy/nginx/README.md`):
      ```
      echo | openssl s_client -connect 169.58.3.186:443 -servername api.therapysts.app 2>/dev/null | openssl x509 -noout -subject
      ```
      This must print `CN = api.therapysts.app`. Then `curl -s https://api.therapysts.app/health` should answer like the old host.
   6. **[Claude]** Proxy both `api` records (orange cloud), then check the health URL again through Cloudflare.
   - Keep `api-unclutterdesk.com.conf`. The old host keeps serving webhooks and old links until §2.6.
   - Renewal: certbot's timer renews it like the other certificates, through the port-80 block.

### Email

11. **[you] Email sending domain: `notify.therapysts.com`** (decided 18 Nov 2026).
    - Mail comes from the brand's permanent domain, `therapysts.com`, not from the app's address. A `notify.` subdomain keeps automated mail's reputation separate from people's own mailboxes on `therapysts.com`.
    - The existing Resend API key keeps working **only if it has Full access, or Sending access for all domains**. A key restricted to one domain can't send from the new one; create a new key in that case and replace `RESEND_API_KEY` at the cutover.
    - Add `notify.therapysts.com` in Resend, add the DNS records it gives you in the `therapysts.com` zone, and wait for **Verified**.
    - Then `MAIL_FROM=Therapysts <no-reply@notify.therapysts.com>` on the server. The sender's name can stay as it is today until the rename (stage 2).
    - **Until it is verified, the cutover must keep today's sender explicitly.** When `MAIL_FROM` is unset, the API sends from `no-reply@<TENANT_ROOT_DOMAIN>`. Changing the root to `therapysts.app` would then switch the sender to an unverified address, and Resend would refuse every email.

### Journal (Unclutter Suite)

12. **[you or Claude, in the Suite repo] Allow the new Desk addresses:** add `https://*.therapysts.app` and `https://therapysts.app` to the Suite API's `DESK_RETURN_ORIGINS`, test environment first, then production.
    - Keep the old value alongside during the switch.
    - Without this, linking a client's Journal fails after the cutover (`docs/design/journal-integration.md`).

### Google sign-in (calendar)

13. **[you] Google Cloud console**, in the project that owns the calendar OAuth client (the one whose client ID is `GOOGLE_CLIENT_ID` in the server's `.env`):
    1. **APIs & Services → Credentials → OAuth 2.0 Client IDs →** open the web client.
    2. Under **Authorized redirect URIs**, **add** `https://api.therapysts.app/v1/calendar/google/callback`. Keep the `api.unclutterdesk.com` one until §4. Save.
    3. If the client lists **Authorized JavaScript origins**, add `https://therapysts.app` too. The flow is server-side, so it may have none.
    4. **Google Auth Platform → Branding → Authorized domains:** add `therapysts.app`. Save.
       - Google may ask you to prove you own the domain in Search Console first. Add it there as a **Domain** property; Search Console gives a TXT record, which I can add with the token.
    5. If the app's consent screen links a privacy policy or terms page on `unclutterdesk.com`, leave them: marketing stays there for now.
    - Changes can take a few minutes to apply. The smoke test in §2.8 includes connecting a calendar.

---

## 2. Cutover

Pick a quiet hour. Before step 3, rollback is just undoing settings (§3).

1. **[Claude] GitHub settings:**
   - Repository **variables:**
     - `VITE_TENANT_ROOT_DOMAIN=therapysts.app`
     - `VITE_MARKETING_URL=https://unclutterdesk.com`
     - `VITE_PROFILE_PUBLIC_URL=https://therapysts.com`
   - **Secrets:**
     - `VITE_API_URL=https://api.therapysts.app`
     - `VITE_APP_URL=https://therapysts.app`
     - `CLOUDFLARE_PAGES_APP_PROJECT=therapysts-app`
2. **[you] API `.env` on the server**, then restart the API:
   ```
   TENANT_ROOT_DOMAIN=therapysts.app
   APP_URL=https://therapysts.app
   API_URL=https://api.therapysts.app
   PROFILE_PUBLIC_URL=https://therapysts.com
   MARKETING_URL=https://unclutterdesk.com        # unchanged until the landing merge
   CUSTOM_DOMAIN_TARGET=customers.therapysts.app
   CLOUDFLARE_ZONE_ID=0b58d5b875e210d484b8b82c6a96f968
   CLOUDFLARE_API_TOKEN=<the server token from §1.5>
   CLOUDFLARE_WORKER_SCRIPT=therapysts-tenant-router       # the router's new name in Therapysts
   MAIL_FROM=<today's sender, unchanged>          # must be set: unset follows TENANT_ROOT_DOMAIN. no-reply@notify.therapysts.com once §1.11 is verified
   ```
   - Remove `CLOUDFLARE_SAAS_CNAME_TARGET`.
   - **Remove `CLOUDFLARE_AUTH_EMAIL` and `CLOUDFLARE_API_KEY`.** When both are set, the API uses them instead of the token, and that key can't reach the new zone.
   - Remove `GOOGLE_REDIRECT_URI` if it names the old host (it then follows `API_URL`).
   - The CSRF cookie domain follows the root, so it becomes `.therapysts.app`. Everyone signs in again once.
3. **[Claude] Release `dev` → `main`.** This deploys:
   - the router, to Therapysts (`deploy-tenant-router.yml`);
   - the app, to `therapysts-app` (`deploy-app.yml`);
   - and the API and profiles as usual.

   The old router and old app keep serving the `unclutterdesk.com` addresses from the Unclutter account in the meantime, so nothing goes dark.
4. **[you] Pages custom domain:** add `therapysts.app` to the `therapysts-app` project. Wait for it to be Active.
5. **[Claude] Check the router's route.** Within 5 minutes the API's custom-domain job creates `*.therapysts.app/*` in the new zone. I'll confirm it exists, then run the smoke tests in §2.8.
6. **[you, with me watching] Switch the old addresses over to the redirects:**
   1. In the **Unclutter** account, delete the router's routes on `unclutterdesk.com`: `*.unclutterdesk.com/*` and each custom domain's route.
      - Keep the `api.unclutterdesk.com/*` route with Worker = None.
      - Nothing recreates the deleted routes, because the API now points at the new zone.
   2. **[Claude]** Run the **Deploy Legacy Redirects** workflow on `main`. From then on, every old practice, app and profile address 301s to its new one, with path and query kept.
   3. **[you] Outside services that call the API:**
      - Paystack webhook → `https://api.therapysts.app/v1/billing/paystack-webhook`
      - Daily.co webhook: I re-run `scripts/create-daily-webhook.mjs` with the new `API_URL`
      - Resend webhook → `https://api.therapysts.app/v1/webhooks/resend`
7. **Custom domains** (today only your test domain, `consult.unclutter.com.ng`):
   1. **[you]** In the practice's dashboard, re-save the domain. The API creates it again as a custom hostname on the new zone, plus its router route.
   2. **[you]** At the domain's DNS, change its CNAME to `customers.therapysts.app`.
   3. Wait until the dashboard shows it Active with its certificate.
8. **[Claude] Smoke tests:**

   | Check | Expected |
   |---|---|
   | `https://therapysts.app` | Sign-in page; sign in works |
   | `https://app.therapysts.app/dashboard` | 301 to `https://therapysts.app/dashboard` |
   | `https://<slug>.therapysts.app/` and `/book` | The practice's page and booking, end to end, with a free test service |
   | `https://<made-up>.therapysts.app/` | The router's "Practice not found" page |
   | A solo practice's `/` (§6.16) | The owner's profile, with reviews |
   | `https://<slug>.unclutterdesk.com/book?x=1` | 301 to `https://<slug>.therapysts.app/book?x=1` |
   | `https://app.unclutterdesk.com/` | 301 to `https://therapysts.app/` |
   | `https://api.unclutterdesk.com/health` | Still answers (the old host stays) |
   | The custom domain | Client sign-in and booking through `/api` |
   | Journal link from a client | Completes (needs §1.12) |
   | A Paystack test payment | Its webhook arrives at the new host |

---

## 3. Rollback

- **Before §2.6:** undo the settings and redeploy.
  - Revert the API `.env` and restart.
  - Revert the GitHub variables and secrets.
  - Re-run `deploy-app.yml` to the old project and `deploy-tenant-router.yml` to the old account. Both need their old credentials back for one run, and revert the `move/therapysts-app` commit on `main` for those two files.
  - The old router never stopped serving the old addresses.
- **After §2.6:** also delete the legacy-redirects Worker's route and put back `*.unclutterdesk.com/*` for the old router. Re-saving each custom domain recreates its route too.

---

## 4. After the move

- **Keep the redirects for at least 12 months** (§4.1b).
- **Remove `app.unclutterdesk.com`** as a custom domain from the old `app-unclutterdesk` Pages project. The redirect Worker answers that host anyway.
- **Once every outside service uses `api.therapysts.app`:**
  - remove the old Google redirect URI;
  - retire `api-unclutterdesk.com.conf` on the server;
  - remove the old Suite origins.
- **Code defaults ([Claude], one PR):** switch the defaults in the config modules to the new addresses, and update the tests that assert old ones (`DOMAIN_MOVE.md` §2).
- **Later, with the landing merge:**
  - marketing moves to `therapysts.com`;
  - `MARKETING_URL` changes everywhere;
  - the legacy Worker's `www` and the bare `unclutterdesk.com` redirect there.
