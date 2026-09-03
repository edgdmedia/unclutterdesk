# Go-Live Checklist

Ordered by dependency, not importance. Doing these out of order breaks things:
the database baseline must happen *before* the API deploys, and the API must
have a valid certificate *before* it goes behind Cloudflare.

`dev` is 14 commits ahead of `main`. Nothing in it is live yet.

Legend: **[you]** needs credentials, a dashboard, or production access.
**[me]** is code I can still write.

---

## Phase 0 — before merging `dev` to `main`

Each of these will break the first deploy if skipped.

- [ ] **[you] Decide what happens to Stripe.** Stripe does not support signup
      from Nigeria, so the integration is being paused. Leaving
      `STRIPE_WEBHOOK_SECRET` unset is now the *correct* state: the webhook
      fails closed and returns 503 rather than accepting unsigned events. But
      the integration is still wired in and still referenced publicly — see
      "Pausing Stripe" below for what that touches.

- [ ] **[you] Install `postgresql-client` on the host** (`pg_dump` must be on
      `PATH`). `deploy.sh` aborts deliberately if it cannot take a backup.

- [ ] **[you] Run the database baseline.** `deploy.sh` now runs
      `prisma migrate deploy`, which will fail against the existing database
      until `0_init` is marked applied. Full procedure, including the drift
      check that must come first, in `docs/DATABASE_MIGRATION_RUNBOOK.md`.
      Short version, on the host, on the *current* `main`:

      npx prisma migrate diff --from-url "$DATABASE_URL" \
        --to-schema-datamodel prisma/schema.prisma --script
      # must print: -- This is an empty migration.
      # then: backup, git pull, npx prisma migrate resolve --applied 0_init

      If the drift check prints real SQL, **stop** — baselining a drifted
      database records a history that lies about the live state.

- [ ] **[you] Add `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`
      to the nginx site.** The API now sets `trust proxy`. Without the header,
      `req.ip` is nginx's own address and the rate limiter buckets every user on
      the platform together — the bug that capped the whole API at 10 requests a
      minute.

- [ ] **[you] Set `CORS_ORIGINS`** if any origin outside `*.unclutterdesk.com`
      needs API access. The permissive `.pages.dev` and `localhost` matching is
      gone.

- [ ] **[you] Confirm the seeded demo account is absent from production.**
      `docs/launch-checklist.md` §6 documents
      `dr.jane@smiththerapy.ng / password123`. CI sets `SEED_DB=false`, and live
      probes of `dr-smith` and `demo` return 404, which is consistent with the
      seed never having run — but that is not proof. Check the database directly
      and delete if present.

---

## Phase 1 — merge and deploy

- [ ] **[you] Merge `dev` into `main`.** CI now runs a `verify` job — recursive
      typecheck plus 124 tests — that every deploy job depends on.

- [ ] **[you] Watch the four workflows.** `deploy-tenant-router` will fail until
      the API token has *Workers Scripts: Edit* (Phase 2).

- [ ] **[you] Smoke test:** `GET https://api.unclutterdesk.com/health` returns
      `{"status":"ok","database":"up"}`; one login round-trip on the production
      domain; one real booking through to payment.

---

## Phase 2 — tenant booking subdomains

This is the launch blocker: every practice booking link is currently dead at
DNS level. Detail in `docs/CLOUDFLARE_SETUP.md` §1.

- [ ] **[you] Give the Cloudflare API token *Workers Scripts: Edit*.** The
      existing token may only carry Pages permissions.

- [ ] **[you] Deploy the Worker** — automatic on merge, or
      `pnpm --filter @unclutterdesk/tenant-router deploy`.

- [ ] **[you] Add the wildcard DNS record:** `CNAME` `*` →
      `app-unclutterdesk.pages.dev`, **Proxied**. Worker routes only fire on a
      proxied record.

- [ ] **[you] Add an explicit `www` record.** A specific record beats the
      wildcard.

- [ ] **[you] Verify:** a real practice subdomain serves the app; a made-up one
      returns a genuine 404; `api.unclutterdesk.com` still returns JSON.

---

## Phase 3 — put the API behind Cloudflare

**Order is load-bearing.** Proxying before the origin has a valid certificate
takes the API down. Detail in `docs/CLOUDFLARE_SETUP.md` §2.

- [ ] **[you]** Install a valid origin certificate (Let's Encrypt, or a
      Cloudflare Origin Certificate).
- [ ] **[you]** Set SSL/TLS mode to **Full (strict)**.
- [ ] **[you]** Switch the `api` record to **Proxied**.
- [ ] **[you]** Add `real_ip_header CF-Connecting-IP` and the Cloudflare ranges
      to nginx.
- [ ] **[you]** Firewall the origin to Cloudflare ranges only. The IP
      `169.58.3.186` is already public, so proxying without this leaves the
      bypass open.
- [ ] **[you]** Add a Worker route `api.unclutterdesk.com/*` with **Worker =
      None**. Until then the Worker returns 404 for that host rather than
      serving the SPA, so a missed step fails loudly.
- [ ] **[you]** Re-verify Stripe and Paystack webhooks still arrive, and that
      `GET /v1/notifications/stream` is not buffered.

---

## Phase 4 — hardening and hygiene

- [ ] **[you] Enable HSTS** at 6 months, `includeSubDomains` **off** until every
      subdomain serves HTTPS. Preload last — it is effectively irreversible.
- [ ] **[you] Promote CSP from Report-Only.** Both `_headers` files ship
      `Content-Security-Policy-Report-Only`. Watch the console across a few real
      bookings, then rename the header. A wrong CSP breaks checkout silently.
- [ ] **[you] Fill the ~25 legal placeholders** and have a lawyer review
      `/privacy` and `/terms`. Search `class="todo"`. Includes one engineering
      question: **are the database and backups encrypted at rest?** I would not
      claim it without knowing.
- [ ] **[you] Schedule an off-host nightly `pg_dump`** and run one restore
      drill. `deploy.sh` only backs up at deploy time, to the same server.
- [ ] **[you] Rotate any secret that has lived on a developer laptop** — Stripe,
      Paystack, Google OAuth, JWT, SMTP — and move production secrets to the
      host's secret store.

---

## Still to build

- [x] **[me] Practice-account closure** — done. `POST /v1/privacy/practice/close`
      (owner, slug confirmation) deactivates and starts a 30-day window;
      `POST /v1/admin/privacy/practices/:tenantId/purge` (platform admin) erases
      irreversibly once it elapses.
- [ ] **[me] Error monitoring (Sentry)** — blocked on a DSN from you. The
      exception filter logs 5xx with a reference id, but nothing aggregates or
      alerts. Until then, production failures surface only in PM2 logs.
- [ ] **[me] Cluster mode** needs a shared throttler store (Redis) first. PM2 is
      pinned to one instance because the in-memory limiter would otherwise
      multiply every limit per worker.

---

## Pausing Stripe

Stripe is unavailable for Nigerian signup, so payments run on Paystack. The
integration is still present and still referenced in places customers see:

- [ ] **[you/me] Platform subscription billing** currently goes through
      `StripeService` (`setup-intent`, `connect-account`). Paystack already
      handles session payments and payouts; subscription billing needs to move
      there, or plans need charging another way.
- [ ] **[me] Remove Stripe from the sub-processor table** in `/privacy`. Listing
      a processor that receives no data is inaccurate in the direction that
      matters least, but it is still wrong.
- [ ] **[me] Remove Stripe from `/terms` §7**, which names it alongside Paystack.
- [ ] **[you] Check the landing page and pricing copy** for card/Stripe claims.
- [ ] **[me] Decide the endpoints' fate.** They currently 503 without a secret,
      which is safe. Removing the routes is cleaner than leaving dead ones
      behind a guard.

Nothing here blocks the merge — the webhook already fails closed.

## Not blocking launch, worth knowing

- Test coverage is 124 tests across eleven files, concentrated in the code
  changed during this audit. Bookings, payments and intake still have thin
  coverage.
- The two `debug:` commits remain in the branch history; their logging was
  removed in `300d6e4`, so the shipped code is clean.
