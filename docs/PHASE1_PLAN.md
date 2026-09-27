# Phase 1 plan: Desk platform work

Follows `docs/FOUNDER_TENANT_AUDIT.md` and the decisions made on 27 Sep 2026. Every step here is a general Desk feature. The only exception is the ecosystem flag, which is off for every practice except the founder's.

Each step is committed to `dev`, verified (API and app tests, typecheck, and a local run where the step has UI), and shipped to `main` by PR.

## Step 1: Groundwork

- **Only ACTIVE custom domains resolve a practice.** `getPublicTenantExistence` and `getPublicTenantInfo` currently match a domain in any status. The middleware and CORS already require ACTIVE.
- **Remove the `x-tenant-id` request header.** A practice is chosen by slug or host only. Authenticated routes keep taking the tenant from the JWT.
- **`Tenant.ecosystemIntegrationEnabled`.** A boolean, default `false`. Only platform admin can set it (admin tenant PATCH and a toggle on the tenant detail page). It is never exposed in public payloads until Phase 2 needs it.

## Step 2: Email, layers 1 and 2 (Resend)

All mail goes through one sending interface with interchangeable transports.

| Layer | Who | Sender | Setup |
|---|---|---|---|
| 1. Default | Every practice | `"Practice Name" <notifications@mail.unclutterdesk.com>`, with Reply-To set to the practice's public email | None |
| 2. Own domain via Desk | Any practice that verifies a domain | `"Practice Name" <{local}@{their domain}>` | Add the DNS records Desk shows, then press Verify |
| 3. Bring your own SMTP | Advanced (planned, not in step 2) | The practice's own mailbox | Host, port, user and app password, checked with a test send |

- **Transport.** Resend's REST API, with the key in `RESEND_API_KEY`. The existing Google SMTP transport stays as a fallback while production is migrated. Local development keeps its log-only mode.
- **Schema.** A `TenantSendingDomain` model with:
  - `tenantId` (unique)
  - `domain`
  - `resendDomainId`
  - `status`: `NOT_STARTED`, `PENDING`, `VERIFIED`, `FAILED` or `TEMPORARY_FAILURE`, mirroring Resend's statuses
  - `records` (JSON: the DNS rows shown to the practice)
  - `fromLocalPart` (default `notifications`)
  - `lastCheckedAt`, `verifiedAt`
- **API endpoints** (practice admin):
  - `GET /v1/tenant/sending-domain`
  - `POST` to register it: validate the domain, call Resend `domains.create` with a custom return path, and store the records.
  - `POST .../verify`: call Resend `domains.verify`, then `domains.get`.
  - `DELETE`: call Resend `domains.remove`.
- **Resend webhook** (`domain.updated`). It is signature-checked and keeps `status` current. A verified domain that drops to `temporary_failure` falls back to layer 1 automatically, and the practice is notified.
- **Choosing the sender** when sending: if the tenant has a `VERIFIED` domain, use that domain; otherwise use the platform default. Mail with no practice context, such as sign-up and password reset, always uses the platform default.
- **UI.** A "Sending email" card in Brand settings. It shows the DNS records to copy, the status, a Verify button and Remove. It recommends a subdomain but accepts a root domain.
- **Docs.** Each practice's SPF, DKIM, return-path MX and DMARC, including the `unclutter.com.ng` specifics. The existing Google SPF and DMARC stay untouched, because Resend's SPF lives on the return-path subdomain. Also add a DMARC record for `unclutterdesk.com`.
- **Plan tier:** open to every plan unless decided otherwise.
- **Cost:** check Resend's domain limit for the chosen plan before rollout.

## Step 3: Hours log (every practitioner)

- **`PractitionerHoursEntry`** with:
  - `tenantId`, `practitionerProfileId`
  - `bookingId` (unique, nullable)
  - `clientProfileId` (nullable)
  - `date`, `durationMinutes`
  - `category`: `DIRECT_CLIENT`, `GROUP`, `SUPERVISION`, `INDIRECT` or `OTHER`
  - `source`: `BOOKING` or `MANUAL`
  - `notes`, `supervisorName`
- **Automatic entries.** Completing a booking upserts its entry, using the service duration, and cancelling it removes the entry. Past completed bookings are backfilled on first open.
- **Manual entries:** create, edit and delete.
- **Targets.** The practitioner sets their own total and supervision target hours, plus a label (e.g. "Diploma practicum"). Nothing is hard-coded.
- **Export.**
  - **CSV:** date, client initials, category, duration, source, notes.
  - **PDF:** header, totals by category, the table, and signature lines for practitioner and supervisor.
  - Client names are initials by default. Full names require an explicit option.
- **Page:** `Dashboard → Hours`, with a summary card, the table, an add-entry form and the export buttons.

## Step 4: Practice-created bookings and emergency contact

- Staff can book a session for an existing client from the client's page or the schedule. They pick the service, a slot or a custom time, and payment: pay online (link emailed), mark as paid, or no charge. Double-booking and practitioner scoping are checked on the server, with the same checks as public booking.
- Emergency contact fields on the client record: name, relationship and phone. Staff with clinical access can see them, and they are included in the client's data export.

## Step 5: Client-shared session summary

- **`SessionSummary`**, one per booking, separate from the private SOAP note. It holds:
  - focus of the session
  - what we covered
  - agreed next steps or homework
  - next session plan
  - `sharedWithClientAt`

  It is encrypted like notes.
- The clinician writes it from the session room or the booking. Sharing it is an explicit action.
- The client sees shared summaries in the portal. The first time a client opens one is recorded (`firstViewedAt`), which is the trigger for Phase 2's invite.

## Step 6: Custom domain go-live (configuration)

- Add a Worker route covering custom hostnames on the Cloudflare for SaaS zone, and ship it through the tenant-router deploy.
- A runbook for the dashboard steps:
  - enable SaaS
  - set the fallback origin
  - set `CUSTOM_DOMAIN_TARGET`
  - add each custom hostname
  - make the CNAME DNS-only
- Test end to end on a spare hostname before touching `consult.unclutter.com.ng`.
