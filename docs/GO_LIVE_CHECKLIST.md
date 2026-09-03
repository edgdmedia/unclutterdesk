# Go-Live Checklist

Ordered by dependency, not importance. Doing these out of order breaks things:
the database baseline must happen *before* the API deploys, and the API must
have a valid certificate *before* it goes behind Cloudflare.

**Status: Phases 0-2 complete and verified against production.** The API,
app, landing site and tenant router are all deployed. What remains is Phase 3
(putting the API behind Cloudflare) and Phase 4 hardening — none of it blocking.

Verified live: `/health` returns `database: up`; the removed Stripe route 404s;
helmet headers present; the CORS origins that were reflected with credentials
are rejected; an unknown practice address returns a real 404; `www` 301s to the
apex; Sentry is receiving events.

Legend: **[you]** needs credentials, a dashboard, or production access.
**[me]** is code I can still write.

---

## Phase 0 — before merging `dev` to `main`

**Exact copy-pasteable commands for the server: `docs/VPS_PREPARATION.md`.**

Each of these will break the first deploy if skipped.

Most of them are checked by one read-only command **on the production host** —
it creates, changes and deletes nothing.

The script lives on `dev`, which the host does not have yet, so fetch just the
scripts directory. Do **not** check out `dev`'s `prisma/schema.prisma`: the
drift check compares the live database against whatever schema is in the working
tree, and it must be `main`'s for the answer to mean anything.

    ssh <PROD_SSH_USER>@<PROD_SSH_HOST>
    cd /home/unclutterdesk/app

    git fetch origin dev
    git checkout origin/dev -- scripts/     # scripts only, not the schema

    node scripts/preflight.mjs

It reports Node and `pg_dump` availability, the required environment variables,
migration baseline state, schema drift, whether the seeded demo account is
present, and leftover Stripe config. It exits non-zero on anything blocking.
The items below are the fixes for what it reports.

Run it again after the merge: drift is only a blocking failure *before* the
baseline exists. Once baselined, a difference just means migrations are pending,
which is what `deploy.sh` applies.

- [x] **[you] Create the three Paystack subscription plans** and set
      `PAYSTACK_PLAN_STARTER`, `PAYSTACK_PLAN_PRO` and `PAYSTACK_PLAN_CLINIC` to
      their `PLN_` codes on the host. Without them `POST /v1/billing/subscribe`
      returns 503 — deliberately, since the alternative is upgrading a practice
      without charging it.

      Either use the dashboard at <https://dashboard.paystack.com/#/plans>
      (Starter ₦5,000, Pro ₦15,000, Clinic ₦45,000, all monthly), or run:

          node scripts/create-paystack-plans.mjs            # dry run
          node scripts/create-paystack-plans.mjs --create

      The script reads the amounts from the application's own plan definitions,
      so the price created cannot drift from the price charged, and it reuses
      plans that already exist rather than duplicating them. Run it once with
      the test key and once with the live key — plan codes differ between
      them.

      The live plans already exist. Set these on the host:

          PAYSTACK_PLAN_STARTER=PLN_an5ij398kgugwr4   # ₦5,000
          PAYSTACK_PLAN_PRO=PLN_f4ncmm3xmcy7b90       # ₦15,000
          PAYSTACK_PLAN_CLINIC=PLN_leght05vpcu41ad    # ₦45,000

- [x] **[you] Confirm the plan mapping on the host**, with the live key loaded:

          node scripts/create-paystack-plans.mjs --verify

      This fetches each code and checks its amount and interval against what
      the application charges. Plan codes are opaque, so a code in the wrong
      variable looks valid and simply bills the wrong tier — this is the only
      check that catches it. It exits non-zero on any mismatch.

- [x] **[you] Add the subscription events to the Paystack webhook**:
      `subscription.create`, `subscription.disable`, `subscription.not_renew`
      and `invoice.payment_failed`, alongside the `charge.success` you already
      receive. — done

- [x] **[you] Install `postgresql-client` on the host** (`pg_dump` must be on
      `PATH`). `deploy.sh` aborts deliberately if it cannot take a backup.

- [x] **[you] Run the database baseline.** `deploy.sh` now runs
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

- [x] **nginx forwarded-for headers** — already present in
      `/etc/nginx/conf.d/api-unclutterdesk.com.conf`, inside the `location`
      block. No change needed. Revisit at Phase 3, when Cloudflare adds a second
      proxy hop.

- [x] **[you] Set `CORS_ORIGINS`** if any origin outside `*.unclutterdesk.com`
      needs API access. The permissive `.pages.dev` and `localhost` matching is
      gone.

- [x] **[you] Confirm the seeded demo account is absent from production.**
      `docs/launch-checklist.md` §6 documents
      `dr.jane@smiththerapy.ng / password123`. CI sets `SEED_DB=false`, and live
      probes of `dr-smith` and `demo` return 404, which is consistent with the
      seed never having run — but that is not proof. Check the database directly
      and delete if present.

---

## Phase 1 — merge and deploy

- [x] **[you] Merge `dev` into `main`.** CI now runs a `verify` job — recursive
      typecheck plus 124 tests — that every deploy job depends on.

- [x] **[you] Watch the four workflows.** `deploy-tenant-router` will fail until
      the API token has *Workers Scripts: Edit* (Phase 2).

- [x] **[you] Smoke test:** `GET https://api.unclutterdesk.com/health` returns
      `{"status":"ok","database":"up"}`; one login round-trip on the production
      domain; one real booking through to payment.

---

## Phase 2 — tenant booking subdomains

This is the launch blocker: every practice booking link is currently dead at
DNS level. Detail in `docs/CLOUDFLARE_SETUP.md` §1.

- [x] **[you] Give the Cloudflare API token *Workers Scripts: Edit*.** The
      existing token may only carry Pages permissions.

- [x] **[you] Deploy the Worker** — automatic on merge, or
      `pnpm --filter @unclutterdesk/tenant-router deploy`.

- [x] **[you] Add the wildcard DNS record:** `CNAME` `*` →
      `app-unclutterdesk.pages.dev`, **Proxied**. Worker routes only fire on a
      proxied record.

- [x] **[you] Add an explicit `www` record.** A specific record beats the
      wildcard.

- [x] **[you] Verify:** a real practice subdomain serves the app; a made-up one
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
- [ ] **[you]** Re-verify Paystack webhooks still arrive, and that
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
- [ ] **[you] Schedule the nightly backup and run one restore drill.**
      `scripts/backup-database.sh` is written and tested; it needs a cron entry
      and an off-host target. Until an S3-compatible bucket is configured the
      backups sit on the same disk as the database, so a disk failure loses
      both. Steps — including R2 setup — in `docs/DATABASE_MIGRATION_RUNBOOK.md`.
- [ ] **[you] Rotate any secret that has lived on a developer laptop** —
      Paystack, Google OAuth, JWT, SMTP — and move production secrets to the
      host's secret store.

---

## Still to build

- [x] **[me] Practice-account closure** — done. `POST /v1/privacy/practice/close`
      (owner, slug confirmation) deactivates and starts a 30-day window;
      `POST /v1/admin/privacy/practices/:tenantId/purge` (platform admin) erases
      irreversibly once it elapses.
- [x] **[me] Error monitoring (Sentry)** — built and inert until you add a DSN.
      Set `SENTRY_DSN` in `/home/unclutterdesk/app/.env` and restart:
      `pm2 restart unclutterdesk-api --update-env`. Optionally
      `SENTRY_TRACES_SAMPLE_RATE` (default 0 — errors only; tracing is billed
      per request). Only 5xx are reported, tagged with the same reference id the
      caller is shown. Request bodies, cookies, query strings and non-allowlisted
      headers are stripped before anything leaves the process.
- [ ] **[me] Cluster mode** needs a shared throttler store (Redis) first. PM2 is
      pinned to one instance because the in-memory limiter would otherwise
      multiply every limit per worker.

---

## Stripe removal — done

Stripe does not support merchant signup from Nigeria, so it was removed rather
than paused: the controller, service, SDK dependency, frontend Connect card and
onboarding placeholder, database columns and both legal-page references are all
gone. Subscriptions now run on Paystack.

One thing to confirm before the migration applies — it drops three columns:

    SELECT count(*) FROM "Tenant"
     WHERE "stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL;
    SELECT count(*) FROM "BankSubaccount" WHERE "stripeAccountId" IS NOT NULL;

Both must return 0. They should: no Stripe customer was ever created. If either
does not, stop — the DROPs are irreversible.

Also worth knowing: **subscription upgrades used to be free.** The old endpoint
wrote the new tier straight to the database without taking payment. It now
returns a Paystack checkout URL and the tier changes only on a verified webhook.

## Not blocking launch, worth knowing

- Test coverage is 124 tests across eleven files, concentrated in the code
  changed during this audit. Bookings, payments and intake still have thin
  coverage.
- The two `debug:` commits remain in the branch history; their logging was
  removed in `300d6e4`, so the shipped code is clean.
