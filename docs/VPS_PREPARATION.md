# VPS preparation — run before merging `dev` to `main`

Everything here happens on the production server, with `main` still checked out.
None of it deploys anything.

**Why first:** merging fires all four deploy workflows at once. The app, landing
and worker deploys will succeed; the API deploy will fail at
`prisma migrate deploy` because the database has not been baselined. That leaves
the new frontend talking to the old API — the billing page would call
`/v1/billing/subscribe` expecting a Paystack checkout URL and get the old
free tier-flip response instead.

The failure itself is safe (`set -e` stops before `pm2 reload`, so the running
API is untouched), but the mismatch is not obvious, so avoid it.

---

## 0. Connect

```bash
ssh <PROD_SSH_USER>@<PROD_SSH_HOST>
cd /home/unclutterdesk/app
```

`<PROD_SSH_USER>` and `<PROD_SSH_HOST>` are the GitHub secrets used by
`.github/workflows/deploy-api.yml`.

## 1. Fetch the scripts and migrations — but not the schema

```bash
git fetch origin dev
git checkout origin/dev -- scripts/ prisma/migrations/
```

`scripts/` for the checks below; `prisma/migrations/` because step 5 marks
`0_init` as applied and cannot do that if the migration folder is missing.

**Do not check out `dev`'s `prisma/schema.prisma`.** The drift check compares
the live database against whatever schema is in the working tree. It must be
`main`'s, which is what `0_init` was generated from — `dev`'s schema contains
columns the database does not have yet, and would report drift that is not
drift.

## 2. See what is missing

```bash
node scripts/preflight.mjs
```

Read-only. Everything below is a fix for something it reports, so if it says a
step is already done, skip it.

## 3. Install `pg_dump` if it is missing

`deploy.sh` now aborts rather than change a schema without a backup.

```bash
sudo apt-get update && sudo apt-get install -y postgresql-client
pg_dump --version
```

## 4. Environment variables

Edit `/home/unclutterdesk/app/.env` — that is the one the API loads, since PM2
runs with this directory as its working directory.

```bash
# Paystack subscription plans (live-mode codes)
PAYSTACK_PLAN_STARTER=PLN_an5ij398kgugwr4
PAYSTACK_PLAN_PRO=PLN_f4ncmm3xmcy7b90
PAYSTACK_PLAN_CLINIC=PLN_leght05vpcu41ad

# Only needed if an origin outside *.unclutterdesk.com calls the API
# CORS_ORIGINS=https://example.com

NODE_ENV=production
```

Delete the `STRIPE_*` lines — the integration is gone.

If `apps/api/.env` also exists, keep it consistent: `deploy.sh` copies it to the
root `.env` when the root one is absent.

Then confirm the plan codes point at the right tiers. Codes are opaque, so one
in the wrong variable looks valid and simply bills the wrong amount:

```bash
node scripts/create-paystack-plans.mjs --verify
```

Expected: three ✓ lines at ₦5,000, ₦15,000 and ₦45,000, monthly.

## 5. Baseline the database

Currently the deploy runs `prisma db push`, which resolves any difference by
altering or dropping whatever is in the way. It becomes `prisma migrate deploy`,
which only applies committed migration files — but that fails against an
existing database until the initial migration is recorded as already applied.

```bash
export DATABASE_URL="$(grep -E '^[[:space:]]*DATABASE_URL=' .env | tail -n 1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')"

# a. Confirm the live schema matches main's schema.prisma
npx prisma migrate diff \
  --from-url "$DATABASE_URL" \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Expected: `-- This is an empty migration.`**

If it prints real SQL, **stop and send it to me.** Baselining a drifted database
records a history that lies about the live state, and every later migration
builds on that lie.

```bash
# b. Back up first
mkdir -p "$HOME/backups/unclutterdesk"
pg_dump --format=custom --no-owner --no-acl \
  --file="$HOME/backups/unclutterdesk/pre-baseline-$(date +%Y%m%d-%H%M%S).dump" \
  "$DATABASE_URL"
ls -lh "$HOME/backups/unclutterdesk/"

# c. Record the baseline — writes one row, runs no DDL
npx prisma migrate resolve --applied 0_init

# d. Check
npx prisma migrate status
```

After (d) expect **two migrations pending** — `tenant_closure` and
`paystack_subscriptions`. Leave them. `deploy.sh` applies them on the first
deploy, after taking its own backup.

## 6. Confirm the Stripe columns are empty

The `paystack_subscriptions` migration drops three columns. They should be
unused, but the DROPs are irreversible, so check:

```bash
psql "$DATABASE_URL" -c 'SELECT count(*) FROM "Tenant" WHERE "stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL;'
psql "$DATABASE_URL" -c 'SELECT count(*) FROM "BankSubaccount" WHERE "stripeAccountId" IS NOT NULL;'
```

Both must be `0`. If either is not, stop — there is billing state to migrate.

## 7. nginx: pass the real client IP

The API now sets `trust proxy`. Without this header it sees nginx's own address
for every request, and the rate limiter buckets every user on the platform into
one counter — the bug that capped the whole API at ten requests a minute.

```bash
grep -rl "api.unclutterdesk.com" /etc/nginx/sites-available/
```

In that file's `location / { ... }` block, alongside the existing
`proxy_pass`:

```nginx
proxy_set_header Host              $host;
proxy_set_header X-Real-IP         $remote_addr;
proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;
proxy_set_header X-Forwarded-Proto $scheme;
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

Safe to do now: the current code ignores the header, the new code needs it.

## 8. Re-check

```bash
node scripts/preflight.mjs
```

Expect **0 blocking**. Migration state will report pending migrations and drift
will be advisory — both correct once the baseline exists.

---

## Then merge

Open the PR, let CI run (typecheck plus 168 tests, which every deploy job
depends on), and merge. Watch `deploy-api`: it should back up, apply the two
migrations, and reload PM2.

`deploy-tenant-router` will fail until the Cloudflare API token has
**Workers Scripts: Edit** — that is Phase 2 and does not block the API.

Smoke test:

```bash
curl -s https://api.unclutterdesk.com/health
```

Expect `{"status":"ok","database":"up",...}`.
