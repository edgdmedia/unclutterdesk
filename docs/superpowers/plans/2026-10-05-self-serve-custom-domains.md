# Self-serve custom domains (SET-13)

**Source:** `docs/testing-feedback.md` · SET-13. Design agreed with the founder 5 Oct 2026.

## Goal

A practice types its own domain in Settings → Practice profile, adds one CNAME at its
registrar, and the platform provisions the certificate and routing itself. No admin
touching Cloudflare dashboards, no per-domain Pages custom domain, no manual SQL.

## Findings that shape this plan (verified 5 Oct 2026 against the live account)

- The `unclutterdesk.com` zone (id `d4b3dd0ef46d1eb1625327cdbf39086e`, account "Unclutter"
  `6ae9e9aa23ab03a89a0c73a2a19efb60`, Free plan) is the SaaS zone.
- The **app is already Worker-served** for anything under the apex: the
  `unclutterdesk-tenant-router` Worker is routed on `*.unclutterdesk.com/*`, fetches the
  Pages bundle, 404s unknown practices (via the API) and `noindex`es the app shell.
  `apps/tenant-router/src/router.ts` already treats **non-apex hosts as custom domains**
  ("arriving via Cloudflare for SaaS … serve it, checkTenant") — no router changes needed.
- API side is ready too: the middleware resolves `Host` → `customDomain` (`ACTIVE` only),
  CORS serves ACTIVE custom domains from the DB with a 60 s cache, `tenantWebOrigin()`
  already builds email links on the custom domain. No API routing work required.
- **Cloudflare for SaaS is not yet enabled**: the custom-hostnames endpoint answers
  `1404 No quota has been allocated`. Enabling is a dashboard action and — on non-Enterprise —
  requires a payment method on the account. This is the one blocking human step.
- Workers Routes API works today (`GET /zones/{id}/workers/routes` returns the two routes);
  a per-custom-hostname route `<hostname>/*` → `unclutterdesk-tenant-router` sends custom
  domain traffic to the Worker before origin resolution — chosen over a zone-wide `*/*`
  route, which would swallow the apex and future hostnames (blast radius per domain,
  and it is the documented "route only custom hostname traffic" option).
- Fallback origin: `app.unclutterdesk.com` (already proxied CNAME → Pages). Traffic only
  reaches it if a hostname has no Worker route; Pages then 403s the unknown host. Acceptable
  and self-healing: the provisioning service always creates the route with the hostname.

## Global constraints

- The API must work unchanged when `CLOUDFLARE_API_TOKEN`/`CLOUDFLARE_ZONE_ID` are absent
  (dev, CI, previews): saving a domain falls back to today's "store + PENDING" behaviour.
  All Cloudflare calls live behind one injectable service.
- Never log the token. Never return it to clients. The verification endpoints return only
  the CF-provided public records.
- Deletion must be safe: removing/changing a domain deletes the custom hostname **and** its
  Worker route; a failed CF delete must not block saving the new domain — keep the orphan id
  for a retry by cron (sweep of ids with no owning tenant).
- Existing state on the live box: `consult.unclutter.com.ng` is ACTIVE in the DB and served
  via a **Pages** custom domain. It keeps working throughout; migration to a SaaS hostname
  is the final validation step, done last, and can be reverted by pointing the record back.
- Follow repo test conventions: services mocked at the prisma/fetch boundary, cron specs
  drive `Tick`, no network in tests.

---

### Task 1: Schema — remember the Cloudflare hostname id

**Files:** `prisma/schema.prisma`, `prisma/migrations/20261005110000_custom_hostname_id/`

- Add to `Tenant`: `customHostnameId String?` (the CF custom-hostname object id) and
  `customHostnameError String?` (last human-readable failure, shown in Settings).
- Hand-written migration `ALTER TABLE "Tenant" ADD COLUMN ...` (TEXT, nullable).
- `prisma migrate deploy` + `prisma generate` (from `apps/api`, `--schema ../../prisma/schema.prisma`). Never `prisma format`.

**Commit:** `"SET-13: remember the Cloudflare custom hostname id and last error on the tenant"`

---

### Task 2: Cloudflare service (custom hostnames + routes)

**Files:** create `apps/api/src/modules/tenant/cloudflare-saas.service.ts` (+ spec), modify `tenant.module.ts`

- `configured(): boolean` — env present.
- `createHostname(hostname)` → `POST /zones/{zone}/custom_hostnames`
  body `{ hostname, ssl: { method: 'cname', settings: { min_tls_version: '1.2' } }, custom_metadata: { tenant: <id> } }`
  returns `{ id, status, sslStatus, cnameTarget, verificationRecords }` (surface CF's
  `ssl.verification_records` + `cname_target` for the UI).
- `getStatus(id)` → `GET /zones/{zone}/custom_hostnames/{id}` → `{ status, sslStatus }`.
- `deleteHostname(id)` → `DELETE`, tolerate 1009 (not found).
- `ensureRoute(hostname)` → `POST /zones/{zone}/workers/routes`
  `{ pattern: "<hostname>/*", script: env.CLOUDFLARE_WORKER_SCRIPT ?? 'unclutterdesk-tenant-router' }`;
  first `GET` the list and no-op if the pattern exists.
- `removeRoute(hostname)` → find by pattern, `DELETE /zones/{zone}/workers/routes/{id}`.
- Plain `fetch` against `https://api.cloudflare.com/client/v4`, `Authorization: Bearer`,
  10 s abort timeout, throw `Error(cf errors[0].message)` on `!ok`.
- Spec: fetch mocked; covers create payload, route idempotency, 1009 tolerance, no-network-when-unconfigured.

**Commit:** `"SET-13: Cloudflare for SaaS service — custom hostnames and Worker routes"`

---

### Task 3: Provisioning in the save path + status endpoint

**Files:** modify `apps/api/src/modules/tenant/tenant.service.ts`, `tenant.controller.ts`, (+ specs)

- In `updateTenantBrand`: when `dto.customDomain` changes:
  - old `customHostnameId` → best-effort `deleteHostname` + `removeRoute(oldDomain)`.
  - empty new domain → null out id/error, status `''`… keep current PENDING semantics only
    when a domain is present.
  - present + service configured → `createHostname` (status PENDING regardless — the
    practice has not pointed DNS yet) → store `customHostnameId`, then `ensureRoute`
    (route may be created before CF activates: allowed, harmless). On CF error: save the
    domain as PENDING *without* an id and record `customHostnameError` — cron retries.
- New `GET /v1/tenant/brand/custom-domain` (`@Permissions` per house style, tenant-scoped):
  `{ hostname, status, error, verification: { cnameTarget, records: [{name,type,data,target}] } }`
  (verification only while status is PENDING; re-fetch from CF by id and cache-in-memory-per-id is overkill — call CF, 2 s timeout, degrade to stored fields).
- Retain: `customDomainTarget()` unchanged for legacy display.

**Commit:** `"SET-13: saving a custom domain provisions the Cloudflare hostname and route"`

---

### Task 4: Poller — PENDING → ACTIVE, orphan sweep

**Files:** create `apps/api/src/modules/tenant/custom-domain.cron.ts` (+ spec), register in `tenant.module.ts`

- `@Cron(EVERY_5_MINUTES)`: for each tenant with `customHostnameId` and status ≠ ACTIVE:
  `getStatus` → when `status==='active' && ssl.status==='active'` → flip `ACTIVE`,
  clear error. (DNS CNAME may lag the hostname object: CF reports `status pending` until
  the customer's CNAME exists — the UI explains what to add.)
- Retry pass: tenants with a domain, no id, service configured → attempt `createHostname`
  again (recovers task-3 failures).
- Sweep: custom hostnames whose `custom_metadata.tenant` no longer matches a live tenant →
  delete + remove route.
- Spec: drives tick with mocked service+prisma: activates, leaves pending, retries missing id.

**Commit:** `"SET-13: poller promotes verified domains and sweeps orphans"`

---

### Task 5: Settings UI — the practice's own domain panel

**Files:** modify `apps/app/src/pages/practice/settings/PracticeProfilePage.tsx`

- Section "Custom domain": input (lowercase, no scheme), Save; status chip
  (Not set / Pending DNS / Live / error line).
- While PENDING: a bordered "Add these records at your domain provider" block listing the
  verification records (type/name/data) and `cname_target` as the CNAME the practice adds —
  each row with a copy button (reuse `CopyRow` pattern from ConfirmationStep or the clipboard
  helper used there). Refresh button refetches the status endpoint.
- App host only (dashboard); no tenant is implied on booking hosts — reuse the existing
  brand/profile GET for current values.

**Commit:** `"SET-13: practices add and verify their own domain from Settings"`

---

### Task 6: Docs and env

**Files:** modify `docs/CLOUDFLARE_SETUP.md`, `docs/VPS_PREPARATION.md`

- CLOUDFLARE_SETUP: new §"Cloudflare for SaaS (custom domains)": one-time steps —
  add payment method; zone → SSL/TLS → Custom Hostnames → **Enable**; fallback origin
  `app.unclutterdesk.com`; create an API token with **Cloudflare for SaaS: Edit** +
  **Workers Routes: Edit** + **Zone: Read**, scoped to the zone; per-domain flow diagram
  (save → hostname → route → practice CNAME → cron → ACTIVE).
- VPS_PREPARATION `.env` list: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID=d4b3dd0ef46d1eb1625327cdbf39086e`,
  `CLOUDFLARE_WORKER_SCRIPT=unclutterdesk-tenant-router`.

**Commit:** `"SET-13: one-time enablement and token steps, environment variables"`

---

### Task 7: Validation and migration of the existing domain

- [ ] Full gates: api + app + ui suites, typechecks, `nest build`.
- [ ] Live (needs the human enable step): via this session's Cloudflare access or curl from the VPS —
  create a hostname for `consult.unclutter.com.ng` through the new endpoint by saving it in
  Settings on the production box; verify the hostname object, the Worker route, the CNAME
  switch (`consult` → `<zone-tag>.my.cloudflare.net` replacing the Pages custom-domain CNAME,
  after deleting the Pages custom domain), cron flipping DB to ACTIVE, and the booking page
  + portal working through the SaaS path. Email link check (`tenantWebOrigin` unchanged).
- [ ] Sheet: SET-13 → Fixed with the record; note consult.unclutter.com.ng migration done.

**Commit:** `"Testing sheet: SET-13 fixed"`
