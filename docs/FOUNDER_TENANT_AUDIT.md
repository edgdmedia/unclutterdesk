# Founder tenant audit (Phase 0)

Audit for `docs/UPDATE.md`, dated 27 Sep 2026. Read-only: no code, config or DNS was changed.

Sources:

- Desk: this repo at `e0c380e`.
- Consult: `unclutter-full/main/development/apps/consult/pwa` (the client) and `apps/api/src/modules/consult` (its backend, inside the Suite API).
- Live DNS, queried with `dig`.

## Summary

| Area | Status | Blocks the plan? |
|---|---|---|
| Feature coverage | Desk lacks the hours log, client-visible session reports, messaging, homework and resources, a client clinical profile, risk flags, supervision, and practice-created bookings | **Yes.** The hours log is needed for your diploma. The post-session invite needs a client-visible session summary, and Desk has none |
| Tenant isolation | Sound. Every client-data query is scoped to the practice or reached through a practice-scoped record. Two small inconsistencies | No |
| Custom domains | Code is complete and tested. The Cloudflare for SaaS side is unconfirmed. The Worker route does not cover custom hostnames. One DNS trap applies to `unclutter.com.ng` | **Yes**, until the Cloudflare setup is finished and tested with one real hostname |
| Per-tenant email | Not possible today. Desk has one global SMTP sender; each practice sets only the display name and Reply-To | **Yes**, for decision 8 |
| DNS | Both zones are on Cloudflare, in the account(s) you own. `consult.unclutter.com.ng` currently serves Consult through Cloudflare's proxy | No, but ordering matters (see §5) |

**Decision needing your input:** decision 5 triggers the Suite invite "after the client views their first session summary". Desk has no session summary that clients can see. Session notes (SOAP) are clinician-only and encrypted. The invite needs a new trigger, or Desk needs a client-visible summary (Consult had one). See §1.3.

---

## 1. Feature coverage: Consult compared with Desk

Consult's backend has 24 models and about 130 endpoints. Desk has an equivalent for most of the practice core:

- booking
- services
- availability
- online and bank-transfer payments
- discounts
- intake forms
- assessments
- SOAP notes
- telehealth
- Google Calendar
- reschedule
- team invites
- client portal
- data export and erasure

Desk also has features Consult never had:

- multi-tenancy, subscription plans and platform admin
- rule-based assessments with separate clinician and client text
- encrypted notes with locking
- a Paystack split to the practice's own bank account
- custom domains
- privacy tooling

The gaps are below, in priority order.

### 1.1 Hours log: **missing from Desk**

What Consult had (`ConsultHoursLog`, `/hours`, `/hours/manual`, `/hours/export`, `TherapistHoursPage`):

- **Automatic entries.** When a booking is completed, or its session report is saved, an entry is upserted with `source: 'booking'`, one per booking. It records date, client, type and duration.
- **Manual entries.** Date, duration (5 to 480 minutes), type (Individual Therapy, Group Session, Clinical Supervision, Administrative) and notes. The page says manual entries are "flagged for supervisor review", but nothing implements that review.
- **Running total.** Completed hours against a target of **200 hours, hard-coded** (`practicumTargetHours = 200`), with the hours remaining and a progress bar.
- **Export: CSV only.** The PDF export described in UPDATE.md did not exist. A "View historical logs" button had no function behind it.

In Desk, nothing records hours. `ConsultBooking` has a duration through its service, so completed sessions could be totalled, but there are no manual entries, target, export or page.

**Recommendation: add it back as a general feature for every practice.** Trainee and pre-licensure therapists are a real Desk segment: diploma practicum hours, supervision hours, and CPD in some bodies. Suggested shape:

- One log per practitioner, not per practice.
- Automatic entries from completed bookings, plus manual entries: direct, indirect and supervision hours, with notes and an optional supervisor name.
- A target the practitioner sets themselves, never hard-coded, with separate direct and supervision targets.
- CSV export, plus a **PDF export that a supervisor can sign**. Accrediting bodies usually ask for a signed log, so PDF is worth adding even though Consult never had it.
- Client names exported as initials by default. The log leaves the clinic, so treat it as a disclosure.

### 1.2 Practice-created bookings: **missing**

In Consult, the practice could book a session for an existing client (`POST therapist/bookings`, `admin/sessions/for-client`, `admin/sessions/from-enquiry`). It could also mark sessions complete, waive payment and reassign. In Desk, only the client can book, from the public page. A practice cannot book a returning client's next session for them, which a solo practice does constantly. **Recommend adding this for all practices.**

### 1.3 Client-visible session report: **missing, and needed by decision 5**

Consult's `ConsultSessionReport` was separate from the private note. It held the session number, presenting concern, themes, interventions, assignments set, next-session plan, attendance and risk level. It had an `isSharedWithClient` flag and a private field only the therapist could see. Clients saw it at `/session/:id/report` (`PostSessionReport.tsx`).

Desk has SOAP notes only, and they are clinician-only by design. **Options for the invite trigger:**

- **(a) Build a client-shared session summary as a general feature.** Recommended: it is useful on its own, and it gives decision 5 its intended trigger.
- **(b) Change the trigger** to something that already exists, e.g. the client's first completed session, shown the next time they open the portal.

### 1.4 Other gaps, lower priority

| Consult feature | In Desk? | Recommendation |
|---|---|---|
| Client clinical profile: emergency contact, reason for therapy, goals, diagnosis, treatment plan, risk flags | Partly. SOAP notes include a diagnosis code; the rest is missing | Add an **emergency contact** for all practices. It is a safety basic. Goals and treatment plan could follow |
| Risk flags with severity, resolve and history | Only as assessment rule alerts | Revisit together with supervision |
| Secure messaging between therapist and client | No | Useful, but it brings retention and safeguarding duties. Defer and decide separately |
| Homework and resources (assignments with due dates, a resource library) | No | Medium value. Defer |
| Supervision: supervisor role, note review and flags, supervisee dashboard | No | Matters for trainees and group practices. Could pair with the hours log, e.g. a supervisor signs off hours. Defer to a later phase |
| Availability templates (named, reusable weekly windows) | Partial: Desk replaces recurring windows wholesale | Low priority |
| Client self-cancel | No: reschedule only | Add, with the practice's cancellation window |
| Session rating | Desk has public reviews instead | Fine as is |
| Enquiries, match requests and the Discover directory | No | **Out of scope** (no marketplace) |
| Client journal and insights inside Consult | No | **Belongs to the Suite.** These stay in Journal, behind the bridge |

---

## 2. Tenant isolation

Method:

- I scanned every Prisma call in `apps/api/src`, excluding tests, on the 13 models that carry `tenantId`.
- I flagged each call whose `where` does not mention `tenantId`: 39 calls.
- I read each one in context.
- The only raw SQL is `SELECT 1` in the health check and the invite-code claim; both are safe.

**Result: no leak found.** Every flagged call is one of the following:

- **A write by id straight after a read scoped to the practice.** For example, `updateBookingStatus` reads the booking with `{ id, tenantId, availability.providerProfileId }`, then updates it by id. Also services, forms, submissions, notes and role changes.
- **A lookup by an unguessable token:**
  - assessment links (`tokenHash`);
  - iCal links (an HMAC token compared in constant time, with the same 404 for a missing booking and a wrong token);
  - the Paystack webhook (`paymentRef`).
- **An identity or auth query**, e.g. the profile by `userId` at login or email verification.
- **A background job across all practices by design**, e.g. the payment-hold expiry cron.
- **A notification query scoped to the signed-in profile** (`profileId`). A notification belongs to one profile, and a profile belongs to one practice.

The tenant for authenticated routes comes from the JWT (`authenticatedTenantId`), not from a request header.

**Two small inconsistencies to fix in Phase 1:**

1. `getPublicTenantExistence` and `getPublicTenantInfo` match `customDomain` **whatever its status**. The API middleware and CORS correctly require `customDomainStatus: 'ACTIVE'`. A PENDING or FAILED domain should not resolve to a practice in these two lookups either.
2. `TenantMiddleware` accepts an `x-tenant-id` header and loads that practice. It is harmless today, because authenticated routes use the tenant in the JWT. Public routes can then only be pointed at another practice's public data, which is public anyway. It would still be safer to limit it to slug or host lookups.

Isolation is enforced in services, not with a Prisma extension or row-level security. That works but depends on discipline. Adding a lint or test that flags new unscoped queries on these models would be a cheap guard. Optional.

---

## 3. Custom domains

**The app side works end to end in code and tests. The Cloudflare side is not confirmed working today.**

### Built and tested

- **Setting a domain:** `PATCH /v1/tenant/brand` validates it and sets it to `PENDING`.
- **Verifying it:** `POST /v1/tenant/brand/custom-domain/verify` in `tenant.service.ts` checks that:
  1. `CUSTOM_DOMAIN_TARGET` is set; otherwise it answers "not available yet";
  2. the domain's CNAME points to that target;
  3. the domain answers over HTTPS, meaning a certificate has been issued.

  Only then is the domain marked `ACTIVE`.
- **Hostname → practice:**
  - The app sends the page's whole hostname as `x-tenant-slug`.
  - The middleware falls back to an **ACTIVE** custom domain (`tenant.middleware.ts`).
  - CORS trusts only ACTIVE custom domains (`common/cors.ts`).
- **Edge router:** the Worker treats any host outside `unclutterdesk.com` as a practice address. It serves the app, or a 404 page when no practice claims the host (`router.ts`, which has tests).

### Not in place or not confirmed

1. **Cloudflare for SaaS.** `customers.unclutterdesk.com` and `fallback.unclutterdesk.com` already resolve to Cloudflare IPs, so someone created those records. I cannot see from here whether SaaS is enabled on the zone, whether the fallback origin is set, or whether `CUSTOM_DOMAIN_TARGET` is set on the production API. `docs/CLOUDFLARE_SETUP.md` §5 still lists these steps as to-do.
2. **Worker route.** `wrangler.jsonc` routes only `*.unclutterdesk.com/*`. A request for `consult.unclutter.com.ng` would not reach the tenant router. It needs a route that matches custom hostnames on the SaaS zone, such as a `*/*` route, or a route on the fallback origin. Check this against current Cloudflare for SaaS docs when configuring it.
3. **Custom hostnames are added by hand.** Nothing in the app registers a hostname with Cloudflare's API. For one domain, adding it in the dashboard is fine. Automating it matters only when practices self-serve.
4. **Cost:** Cloudflare for SaaS is priced per custom hostname above the included allowance. Check current rates.

**Verdict:** it does not work end to end today, and it cannot until items 1 and 2 are done and one real hostname is tested. It is configuration plus one Worker route, not new code.

---

## 4. Per-tenant email

**Not possible today.**

- `mail.service.ts` uses **one global SMTP transport**: Google SMTP with an app password (`SMTP_HOST/USER/PASS`).
- It has one fixed sender address (`SMTP_FROM`, default `no-reply@unclutterdesk.com`).
- Each practice changes only the **display name** (its practice name) and **Reply-To** (its public email) (`email.channel.ts`).

**What's missing for decision 8:**

1. **A sending path that may send from `@unclutter.com.ng`.** Google SMTP only sends as the signed-in account or its verified aliases. `unclutter.com.ng` is its own Google Workspace (its MX records are Google's). Two routes:
   - **(a) Per-practice SMTP credentials**, stored encrypted per tenant: the practice's own Workspace address and app password. This is quick for your one tenant. It is awkward as a general feature, and Google's daily sending limits apply.
   - **(b) A transactional provider** with per-domain verification (e.g. Postmark, Resend, Amazon SES, or Cloudflare Email Service). Each practice domain gets its own DKIM and return-path. **Recommended** for a SaaS, and needed anyway before volume grows.
2. **Schema and settings:** a per-tenant sending domain and from-address, with verification status, and a fallback to `@unclutterdesk.com` until it is verified.
3. **Authentication records:**
   - `unclutter.com.ng` already has SPF (`include:_spf.google.com -all`) and DMARC (`p=quarantine`). A new provider must be **added to that SPF record**, and needs its own DKIM, or mail will be quarantined.
   - `unclutterdesk.com` has SPF (`~all`) but **no DMARC record at all**. Add one before launch, whatever else is decided.

---

## 5. DNS

- **`unclutter.com.ng`:** on Cloudflare (`isla`/`justin.ns.cloudflare.com`). Google Workspace handles its mail.
- **`unclutterdesk.com`:** on Cloudflare (`garrett`/`sloan.ns.cloudflare.com`), probably in a different account or zone.
- **`consult.unclutter.com.ng` today:** proxied through Cloudflare (A records `104.21.85.213`, `172.67.211.104`), presumably serving Consult.

What that means for the switch:

1. **The record must be a DNS-only CNAME** (grey cloud) to `customers.unclutterdesk.com`. With a proxied record, Cloudflare flattens it, `dns.resolveCname` sees no CNAME, and **Verify fails**. Cloudflare's own guidance is also DNS-only for custom hostnames that point at another Cloudflare zone.
2. **Order matters.** Add the custom hostname in Cloudflare for SaaS first, and confirm its certificate is issued (SaaS can validate over HTTP or TXT before traffic moves). Only then change the `consult` record, because that change takes Consult offline at that address.
3. If you'd rather not touch `consult` until the end, test the whole path first on a spare hostname, e.g. `book-test.unclutter.com.ng`.

---

## What Phase 1 would contain, given the above

1. `ecosystemIntegrationEnabled` flag, set only by platform admin.
2. Custom domains:
   - finish the Cloudflare for SaaS setup and the Worker route (configuration);
   - fix the two lookups in §2 so only ACTIVE domains resolve;
   - test with a spare hostname.
3. Per-tenant sending domain through a transactional provider; the provider is your call. Also document SPF, DKIM and DMARC for each domain, and add DMARC to `unclutterdesk.com`.
4. General features restored for every practice:
   - **hours log** with CSV and PDF export;
   - **practice-created bookings**;
   - **client-shared session summary** (if you pick option (a) in §1.3);
   - **emergency contact** on the client record.
5. The `x-tenant-id` header hardening from §2.

Deferred, each worth its own decision: messaging, homework and resources, supervision, client self-cancel, availability templates.

## Decisions (27 Sep 2026)

1. **Invite trigger:** build a client-shared session summary as a general feature. The one-time invite shows after the client first views a summary. Flagged practices also get a **static invite**: a small, permanent card in the client portal, so clients who never open a summary still have a way in.
2. **Email:** use **Resend**, for every practice. Each practice can add its own sending domain; until one is verified, mail goes from the shared `@unclutterdesk.com` domain. Signing in with a practice's own Google Workspace account is a possible later option.
3. **Hours log:** available to every practice, with CSV and PDF export.
4. **Founder tenant:** reuse the production `unclutter` practice. The local database has no `unclutter` practice, only `dr-smith`, `unclutter-desk-demo-practice` and E2E test practices, so local testing needs a seeded copy.
5. **Production data:** there are no real client records yet.

## Questions that were open before Phase 1

1. **Invite trigger:** build a client-shared session summary, or trigger the invite after the first completed session? (§1.3)
2. **Email:** per-practice SMTP credentials or a transactional provider, and which one? (§4)
3. **Hours log scope:** CSV and PDF with a supervisor sign-off line, or CSV only to start? (§1.1)
4. **Your tenant:** reuse the existing `unclutter` practice (`unclutter.unclutterdesk.com`, which already has payouts set up) or create a new one?
5. **Production data:** the brief says no real data exists. Desk is live and `unclutter` has taken at least one booking attempt. Confirm there are no real clients whose records would move or be deleted.
