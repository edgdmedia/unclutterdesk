# Unclutter Desk v2 — Therapist Profiles

**Spec for Claude Code · Version 2.0 · 26 Oct 2026**
**Owner / decision-maker:** Olalekan Owonikoko
**Baseline:** `CURRENT_STATE_2026-10-26.md` (code on `main`, last merge PR #53). Where this spec and that file disagree about *what exists today*, the current-state file wins. Where this spec says what to *build*, this spec wins.

---

## 0. How to use this spec (read first)

You are extending a working, multi-tenant NestJS + Prisma + React product. The practice platform (booking, payments, notes, assessments, hours, tenancy) is **done**. v2 adds **therapist profiles**, powered by Desk. Do not rewrite existing modules. Build on them.

### Working rules

1. **Check before building.** Before each phase, read the relevant modules and confirm the assumptions in that phase's "Builds on" list. If something differs, stop and report the difference before writing code.
2. **One PR per phase** (or per workstream inside a large phase). Each PR: migration(s), API, UI, tests, docs update. CI (typecheck + api/ui/app/tenant-router suites) must pass.
3. **Tenant isolation is enforced in services, not the DB.** Every new query on tenant-scoped data filters by `tenantId`. Extend `tenant-isolation.spec.ts` for every new tenant-scoped model.
4. **Never trust `req.user.roles` for practice roles.** Practice roles and permissions come from `Profile.role` + `Profile.permissions` via `RolesGuard`. Every new authenticated route needs a permission annotation (the build already enforces this).
5. **New models use Prisma enums**, not `String` status columns. Don't convert existing string columns in v2 unless a phase says so.
6. **Money stays in kobo (`BigInt`).** IDs stay `BigInt`, matching the existing schema.
7. **No hard-coded brand or domain for public profile pages.** Profiles will move to their own domain and brand later (not decided). Every public profile URL and profile-brand string goes through one config module (§4.1). CI grep check: no literal `unclutterdesk.com` inside `apps/profiles` or the new profile modules outside that config.
8. **Docs are part of "done."** Each phase updates `docs/LAUNCH_FEATURE_MATRIX.md` and any landing/legal copy it affects. Documentation drift is a known problem; v2 must not add to it.
9. **Ask, don't guess, on anything marked `DECISION`.** Never invent a third option silently.

---

## 1. What v2 is

Therapists are often asked for their profile and send an Instagram page. v2 gives every therapist **a simple, professional profile page they can share with clients**, at a friendly URL, with:

- a clear structure set up in advance, so the profile reads well and the therapist knows what to put in it;
- **themes** (how the page looks) and **templates** (starting content for different kinds of practitioner);
- sharing tools: link, QR code, WhatsApp share, profile PDF, email signature;
- optional booking: the therapist can switch on Desk booking, or add an external booking link.

**Unclutter Desk is the backend.** Therapists create and edit their profile inside the Desk dashboard. Someone who signs up for a profile finds that booking, payments, notes and the rest of Desk are already there when they want them.

Unclutter Desk (unclutterdesk.com) remains its own product. Public profile pages are a separate surface that will get its own domain and brand later.

### Scope

**Core of v2 (Phases 0–2) — build first**
- Therapist profile with a friendly URL, profile structure, guidance, themes and templates
- Profile-first signup into the Desk dashboard
- Booking: off, Desk booking (opt-in), or external link
- Share kit and privacy-safe profile stats
- Plans: free profile → Starter → Pro (+ Clinic), central entitlements, removal of the fake trial
- Terms of use, "Report this profile", admin takedown

**Extensions in v2 (Phases 3–5) — build after the core, in this order**
- Phase 3: Credential verification as an optional badge
- Phase 4: Directory and search over published profiles
- Phase 5: Unclaimed listings and claiming

The profile is the product. Phases 3–5 add to it; none of them is required for a therapist to create, publish or share a profile.

**Later (designed for, not built — §11)**
- Drag-and-drop profile builder
- Profiles on their own domain and brand
- Referrals between practitioners

**Not planned**
- Paid placement, client reviews on profiles, messaging outside booking

---

## 2. Decisions

All confirmed by Olalekan on 26 Oct 2026.

| ID | Decision | Choice |
|---|---|---|
| D1 | Public profile URL for v2 | `https://unclutterdesk.com/therapists/{handle}`. Moving to another domain later is config + 301s (§4.1) |
| D2 | Who owns a profile | The **person** (`User`), not the practice (`Tenant`). One profile per user; globally unique handle |
| D3 | Where profiles are edited | Inside the Desk dashboard (`app.unclutterdesk.com`) |
| D4 | Booking on a profile | Three options: **none**, **Desk booking** (opt-in), or **external link**. Desk booking is the default suggestion |
| D5 | Plans | Free profile → Starter → Pro; Clinic for multi-therapist practices (§5.2). No trial |
| D6 | Content responsibility | Profile content is the practitioner's responsibility (like LinkedIn). The platform provides terms of use, a report link and admin takedown. No verification required to publish |
| D7 | Experience figures | Optional. Hours and sessions recorded on Desk can be shown as ranges; self-reported figures allowed. Guidance discourages "success rate" claims |
| D8 | Client reviews on profiles | Not shown |
| D9 | Existing practices | No paying practices exist; migrate unpaid STARTER tenants to FREE |
| D10 | Verification | Optional add-on badge, never required to publish. Nigerian bodies to seed: **CASSON, NAPC, ANEPCO** (acronyms; Olalekan enters full names and register links in admin) |
| D11 | Directory | Lists published profiles. Ranking: claimed before unclaimed; within claimed, verified first; then completeness, "accepting new clients", recent activity. No paid boosts |
| D12 | Unclaimed listings | Admin-created from public sources, limited data, no booking, `noindex`, instant removal on request, claim via signup + proof (§10) |

---

## 3. Concepts

| Term | Meaning |
|---|---|
| **Practitioner** | A `User` with a `Profile` of role OWNER or THERAPIST and a `ConsultTherapistProfile` in some tenant |
| **Therapist profile** | `PractitionerProfile` — the public page at `/therapists/{handle}`, owned by one user |
| **Profile structure** | The fixed set of sections every profile has (§6.2) |
| **Theme** | A visual preset for the public page: colours, fonts, layout (§6.4) |
| **Template** | Starting content for a kind of practitioner: section prompts and example wording (§6.5) |
| **Booking mode** | `NONE`, `DESK` or `EXTERNAL` (§6.8) |
| **Profile-first practitioner** | Someone who signed up for a profile; Desk opens in profile-first mode for them (§6.7) |
| **Verified** | Optional badge: an admin has checked at least one credential against a professional body and it hasn't expired (Phase 3) |
| **Directory** | Public listing and search over published profiles (Phase 4) |
| **Claimed / unclaimed** | A claimed profile is owned by a signed-up practitioner. An unclaimed listing is admin-created from public information for someone who hasn't joined (Phase 5) |

---

## 4. Architecture

### 4.1 Profile domain & brand config (swap-later design)

Create `packages/shared/src/profile-config.ts` (and API/Astro equivalents reading the same env):

```ts
export interface ProfileConfig {
  brandName: string;        // PROFILE_BRAND_NAME, v2: "Unclutter Desk"
  publicBaseUrl: string;    // PROFILE_PUBLIC_BASE_URL, v2: "https://unclutterdesk.com/therapists"
  profilePath: (handle: string) => string; // -> `${publicBaseUrl}/${handle}`
}
```

Rules:
- Every profile link, QR code, PDF, email, sitemap entry, canonical tag and JSON-LD uses `profilePath()`.
- Store **handles**, never full URLs, in the database.
- Future domain move (document only): new domain → same app; old `/therapists/{handle}` paths 301 to it. QR codes printed in v2 keep working through the 301.

### 4.2 New app: `apps/profiles`

Serves the public profile pages.

- **Astro SSR** (Cloudflare adapter), its own Cloudflare Pages project.
- Mounted at `unclutterdesk.com/therapists*` via a Cloudflare Worker route (or Pages Functions routing) so `apps/landing` stays untouched. If path mounting proves awkward, fall back to `profiles.unclutterdesk.com` **behind the same config** and tell Olalekan.
- Server-renders from the public API (§6.10) with edge caching (`s-maxage` ~5 min, `stale-while-revalidate`); purged on change (§6.11).
- Published profiles are **indexable**: canonical tag, `sitemap.xml`, `robots.txt`, Open Graph/Twitter cards (a good link preview in WhatsApp matters most), JSON-LD `Person`. `tenant-router` keeps `noindex` on practice subdomains.
- Themes are implemented as token sets (§6.4), so the whole app can be rebranded with the future domain.
- Performance: LCP < 2.5 s on a mid-range Android on fast 3G; readable without JavaScript.

### 4.3 Where things live

| Concern | Location |
|---|---|
| Profile editor, themes, templates, booking mode, share kit, stats, credentials, claims | `apps/app` → `/dashboard/profile/*` |
| Templates, taxonomy, reports, takedowns, verification queue, directory, unclaimed listings | `apps/app` → `/admin/profiles/*` |
| Public profile pages, directory search (Phase 4) | `apps/profiles` |
| API | `apps/api/src/modules/entitlements/`, `.../practitioner-profile/`, `.../verification/` (Phase 3), `.../directory/` (Phase 4) |
| Booking | Unchanged: `{slug}.unclutterdesk.com/book` (deep-linked, §7.1) |

---

## 5. Phase 0 — Foundations (must land first)

**Builds on:** `subscription-plans.ts`, `booking-limits.ts`, `assessments/engine.ts` (`tierIncludes`), billing webhook handling, onboarding wizard, landing pricing copy.

### 5.1 Entitlements module

Replace scattered `tier === 'STARTER'` checks with one source of truth.

```ts
// apps/api/src/modules/entitlements/entitlements.ts
export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'CLINIC';

export interface Entitlements {
  monthlyBookingLimit: number | null;   // null = unlimited
  platformFeeBps: number;               // 500 = 5%
  customDomain: boolean;
  staffInviteRoles: Array<'ADMIN' | 'RECEPTIONIST' | 'THERAPIST'>;
  assessmentRank: number;               // replaces tierIncludes ranking
  googleCalendarSync: boolean;
  profileFeatures: { downloadablePdf: boolean; introVideo: boolean };
}

export const ENTITLEMENTS: Record<Tier, Entitlements> = { /* §5.2 */ };
export function entitlementsFor(tenant: Pick<Tenant, 'subscriptionTier' | 'complimentaryUntil'>): Entitlements;
```

- `EntitlementsService.assert(tenantId, key)` throws a typed `EntitlementError` (HTTP 402, `{ code: 'ENTITLEMENT_REQUIRED', feature, requiredTier }`).
- `GET /v1/tenant/entitlements` returns the current tenant's entitlements so the frontend gates UI **before** the API fails.
- Refactor every existing tier check to use it: booking limits, platform fee, custom domain, staff invites, assessments.
- Tests: table-driven spec for every key × tier; a test that fails if `subscriptionTier ===` appears outside the entitlements module.

### 5.2 Plans (confirmed)

| | Free profile (`FREE`) | Starter | Pro | Clinic |
|---|---|---|---|---|
| Price | ₦0 | ₦5,000/mo | ₦15,000/mo | from ₦45,000/mo |
| Therapist profile, themes, templates, share link/QR | ✅ | ✅ | ✅ | ✅ (per therapist) |
| Profile PDF, intro video | ❌ | ✅ | ✅ | ✅ |
| Desk booking (opt-in) | ✅ | ✅ | ✅ | ✅ |
| Bookings / month | **10** | **30** | Unlimited | Unlimited |
| Platform fee on booking payments | **5%** | **0%** | 0% | 0% |
| Google Calendar push | ❌ | ✅ | ✅ | ✅ |
| Assessments | PHQ-9, GAD-7 | PHQ-9, GAD-7 | + PCL-5, DASS-21 | all |
| Clinical notes, hours log, intake | ✅ | ✅ | ✅ | ✅ |
| Custom domain for booking pages | ❌ | ❌ | ✅ | ✅ |
| Staff | — | — | Admin/Receptionist | + Therapists |

Notes:
- Starter changes from today's code: limit 20 → **30**, fee 5% → **0%**.
- Desk's public pricing page shows **Starter, Pro, Clinic**, plus a line "Start with a free therapist profile". The free plan is presented as the free profile, not as a fourth Desk plan.
- Clinic Plus (sales flow), trainee access and invite-code periods stay off the public pricing page, unchanged.
- In-app upgrade prompts follow the path: free → Starter → Pro. Never skip straight to Clinic.

### 5.3 FREE tier & trial cleanup

- Add `FREE`; new tenants default to `FREE`.
- Migration: tenants on `STARTER` without an active subscription or `complimentaryUntil` → `FREE`.
- STARTER now requires an active Paystack subscription. On `subscription.disable` / `not_renew`, or `invoice.payment_failed` past a 7-day grace (configurable) → downgrade to FREE. Respect existing guards (if extra staff exist, flag and notify instead).
- Invite-code expiry cron sends practices back to **FREE** (not STARTER) unless they hold a paid subscription.
- Remove every "14-day trial / everything unlocked" string from landing, signup and onboarding.
- FREE booking limit reached: practice sees an upgrade prompt; the booking page shows "Fully booked this month" (not an error); the profile's Book button becomes "Not taking new online bookings this month".
- Update landing pricing to §5.2.

### 5.4 Housekeeping

- Delete stray `apps/prisma/migrations/` (confirm it duplicates `prisma/migrations/20261004090000_formats_and_locations`), commit the `fix_ts*.mjs` deletions, remove the untracked screenshot from `docs/`.
- Legal/landing accuracy: add **Daily.co** and JaaS/8x8 to the privacy policy processor table; correct the "Jitsi or Google Meet" claim; correct assessment tier claims; say "clinical notes are encrypted at rest", not everything.
- Update `docs/ARCHITECTURE.md` and `LAUNCH_FEATURE_MATRIX.md` to match code.

**Phase 0 acceptance**
- [ ] No tier string comparisons outside the entitlements module (test enforced)
- [ ] `GET /v1/tenant/entitlements` drives UI gating for at least booking limit, fee, custom domain, assessments
- [ ] New signup → FREE tenant; no trial copy anywhere
- [ ] Starter: 30 bookings, 0% fee; unpaid STARTER tenants migrated; webhook downgrades tested
- [ ] Legal pages list the actual video processors

---

## 6. Phase 1 — Therapist profile

A therapist can sign up, build a clear profile with a theme and template, choose how clients book, publish it, and share it.

**Builds on:** `User`, `Profile`, `ConsultTherapistProfile` (already has `publicUsername`, `tagline`, `specialty`, `modalities[]`, `credentials`, `yearsExperience`, `languages[]`, `isPublic`, `offersOnline/InPerson`), `ConsultService`/`ConsultServiceFormat`, `PracticeLocation`, `PractitionerHoursEntry`, `ConsultBooking`, signup/`tenant/register`, onboarding wizard, `pdfkit`.

### 6.1 Data model

```prisma
enum PractitionerProfileStatus { DRAFT PUBLISHED HIDDEN SUSPENDED }
enum PractitionerKind { COUNSELLOR PSYCHOTHERAPIST PSYCHOLOGIST PSYCHIATRIST SOCIAL_WORKER TRAINEE }
enum TaxonomyKind { SPECIALTY MODALITY POPULATION LANGUAGE }
enum BookingMode { NONE DESK EXTERNAL }

model PractitionerProfile {
  id                 BigInt   @id @default(autoincrement())
  userId             BigInt   @unique
  user               User     @relation(fields: [userId], references: [id])
  handle             String   @unique            // lowercase, 3–30, [a-z0-9-], reserved list applies
  status             PractitionerProfileStatus @default(DRAFT)
  kind               PractitionerKind
  templateKey        String?                     // template used to start (§6.5)
  themeKey           String   @default("calm")   // §6.4
  displayName        String
  pronouns           String?
  photoUrl           String?
  headline           String?                     // one line, <= 120 chars
  about              String?                     // <= 2,000 chars
  approach           String?                     // how I work, <= 1,500 chars
  introVideoUrl      String?                     // entitlement-gated
  credentialsText    String?                     // free text: qualifications & memberships as the therapist states them
  city               String?
  countryCode        String   @default("NG")     // ISO 3166-1 alpha-2
  offersOnline       Boolean  @default(true)
  offersInPerson     Boolean  @default(false)
  acceptingClients   Boolean  @default(true)
  faithIntegration   String?                     // optional self-description
  supervisedBy       String?                     // shown for trainees, optional
  showPlatformExperience Boolean @default(false) // D7
  selfReportedYears  Int?
  selfReportedClientsBucket String?              // e.g. "50-100"
  bookingMode        BookingMode @default(NONE)
  bookingTherapistProfileId BigInt?              // DESK mode: -> ConsultTherapistProfile.profileId
  externalBookingUrl String?                     // EXTERNAL mode: https only
  contactEmailPublic String?                     // optional, shown only if set
  socialLinks        Json?                       // optional: { instagram, linkedin, website, ... }
  completenessScore  Int      @default(0)        // 0–100, computed
  publishedAt        DateTime?
  lastActiveAt       DateTime?
  taxonomy           PractitionerTaxonomy[]
  timeline           PractitionerTimelineEntry[]
  handleHistory      PractitionerHandleHistory[]
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
  @@index([status, countryCode])
}

model TaxonomyTerm {
  id        BigInt       @id @default(autoincrement())
  kind      TaxonomyKind
  key       String                                  // stable slug, e.g. "grief", "cbt", "yoruba"
  label     String
  isActive  Boolean      @default(true)
  sortOrder Int          @default(0)
  @@unique([kind, key])
}

model PractitionerTaxonomy {
  profileId BigInt
  termId    BigInt
  isPrimary Boolean @default(false)                 // up to 3 primary specialties
  profile   PractitionerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  term      TaxonomyTerm        @relation(fields: [termId], references: [id])
  @@id([profileId, termId])
}

model PractitionerTimelineEntry {          // training & journey
  id           BigInt   @id @default(autoincrement())
  profileId    BigInt
  profile      PractitionerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  type         String   // EDUCATION | TRAINING | PRACTICE | SUPERVISION | MEMBERSHIP | MILESTONE
  title        String
  organisation String?
  startYear    Int?
  endYear      Int?     // null = ongoing
  description  String?
  sortOrder    Int      @default(0)
}

model PractitionerHandleHistory {          // old handles 301 to current
  handle    String   @id
  profileId BigInt
  profile   PractitionerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  changedAt DateTime @default(now())
}

model ProfileTemplate {                    // admin-editable content (§6.5)
  key         String   @id                 // e.g. "private-practice-counsellor"
  title       String
  description String
  kind        PractitionerKind?
  sections    Json                         // per-section prompts, example text, suggested taxonomy keys
  isActive    Boolean  @default(true)
  sortOrder   Int      @default(0)
  updatedAt   DateTime @updatedAt
}
```

Notes:
- `PractitionerProfile` is **global**, not tenant-scoped. Only the owning user (and platform admins) can read a draft or write. Add a dedicated access spec alongside `tenant-isolation.spec.ts`.
- Seed `TaxonomyTerm` with a starter list for Olalekan to review: ≈40 specialties, ≈15 modalities, populations, and languages incl. English, Yoruba, Igbo, Hausa, Nigerian Pidgin, French, Twi, Swahili. Population terms on sensitive identities go in only with Olalekan's approval.
- Back-fill on first profile creation from `ConsultTherapistProfile` (`tagline`→`headline`, `credentials`→`credentialsText`, `modalities`/`specialty`/`languages` → taxonomy matches, `yearsExperience` → `selfReportedYears`, `offersOnline/InPerson`). Keep the old fields; mark them deprecated in comments.
- Handle rules: lowercase; 3–30 chars; `[a-z0-9-]`; no leading/trailing hyphen; reserved list (reuse `reserved-slugs.ts` + `join`, `about`, `search`, `sitemap`, `admin`, `api`, `report`, `terms`). Suggest a handle from the name. Changing a handle writes history; old handles 301 forever.

### 6.2 Profile structure

Every profile has the same sections, in this order. The editor and the public page both use it. Empty optional sections are hidden on the public page.

| # | Section | Required to publish |
|---|---|---|
| 1 | **Identity** — photo, name, kind, headline, city/country, pronouns | name, kind, headline, country |
| 2 | **About** | ≥ 150 chars |
| 3 | **Qualifications & training** — `credentialsText` + journey timeline | — |
| 4 | **Specialties** — up to 3 primary + others | ≥ 1 |
| 5 | **Approach & modalities** | — |
| 6 | **Who I work with** — populations, faith integration (optional) | — |
| 7 | **Languages** | ≥ 1 |
| 8 | **Experience** — years, sessions/hours (D7) | — |
| 9 | **Sessions & fees** — online/in-person, locations, fees (from Desk services if booking mode is DESK; otherwise a simple fee range field) | — |
| 10 | **Book / contact** — per booking mode; optional public email and social links | — |

Requirements are kept light so a therapist can publish quickly. The completeness score (§6.6) encourages the rest. Trainees can fill `supervisedBy`; when set, the page shows "Practising under supervision".

### 6.3 Friendly URL

- `profilePath(handle)` → `unclutterdesk.com/therapists/{handle}` in v2.
- Handle chosen at signup, editable later; availability checked live.
- Open Graph image generated per profile (photo, name, kind, headline, theme colours) so the link previews well in WhatsApp, Instagram DMs and email.

### 6.4 Themes

- 4–5 presets in v2, defined as token sets (colours, fonts, header layout, photo shape): e.g. `calm` (default, soft neutrals), `warm`, `clinical` (crisp, white), `earth`, `night`. All themes available on all plans in v2.
- Picker in the editor with live preview. Themes change appearance only, never content or section order.
- All themes must pass WCAG 2.1 AA contrast; add a test that checks each theme's text/background pairs.

### 6.5 Templates

Templates help therapists know what to write. They provide **prompts and example wording per section**, plus suggested specialties/modalities.

- Seed templates (content drafted by Claude Code, reviewed and edited by Olalekan in admin before launch):
  - Counsellor in private practice
  - Trainee counsellor under supervision
  - Clinical psychologist
  - Faith-integrated counsellor
  - Child & adolescent specialist
  - Couples & family therapist
  - Workplace / corporate wellbeing practitioner
- Choosing a template at signup (or later) shows its prompts beside each section in the editor and offers "Use this example as a starting point", which inserts the example text for the therapist to rewrite.
- Inserted example text is marked internally; publishing warns if example text is still unchanged ("This section still has template text — make it yours?"). Warning only.
- Templates live in `ProfileTemplate` and are edited in admin, not in code.

### 6.6 Completeness score & guidance

- Server computes `completenessScore` on save: Identity 20, About 15, Qualifications & training 15, Specialties 10, Approach 10, Languages 5, Experience 10, Sessions & fees 10, Book/contact 5.
- Editor shows the score, the next most useful thing to add, and short guidance per section. Guidance text is editable content, not hard-coded.
- **Writing tips** (rule-based, warnings only, never blocking):
  - Outcome claims ("success rate", "% of clients", "guaranteed", "cure") → suggest describing approach and experience instead.
  - Superlatives ("best", "No. 1") → suggest specific, factual wording.
  - Identifiable client details → strong warning to remove them, for client confidentiality.
  - Phone numbers in free text → suggest the contact fields or booking instead.

### 6.7 Profile-first signup (inside Desk)

- Entry points: a "Create your free therapist profile" page at `unclutterdesk.com/therapists/join`, and a link from the Desk landing page.
- → `app.unclutterdesk.com/signup?intent=profile`. Signup asks for name, email, password, handle, kind, and template (optional). It creates in **one transaction**: `User`, `Tenant` (FREE, slug from handle), `Profile` (OWNER), `ConsultTherapistProfile`, `PractitionerProfile` (DRAFT).
- Set `Tenant.onboardingIntent = PROFILE` (new field). In this mode the dashboard is **profile-first**:
  - Home shows the profile editor, completeness, share and stats.
  - Desk's practice features (clients, sessions, services, availability) sit under a clear "Set up booking" entry, visible but not pushed, until booking is switched on.
  - Skip the full practice onboarding wizard.
- After publishing, a dismissible card: "Want clients to book you here? Switch on booking — intake, reminders and payments are already set up."
- Existing Desk practitioners see "Create your therapist profile" in the dashboard; no new tenant is created.

### 6.8 Booking modes

| Mode | Public page shows | Set-up |
|---|---|---|
| `NONE` | No Book button; optional public email/social links | — |
| `DESK` | **"Book a session"** → Desk booking flow (§7.1) | Guided set-up: add a service and fee, set weekly availability, choose payment (Paystack subaccount or manual transfer). Reuses existing Desk screens |
| `EXTERNAL` | **"Book a session"** → `externalBookingUrl` (opens new tab, `rel="noopener nofollow"`) | Enter an https URL (validated) |

- In the editor, `DESK` is presented first, with a short line on what it includes (intake and consent forms, reminders, payments, notes). `EXTERNAL` is available without friction.
- Switching to `DESK` sets `Tenant.onboardingIntent` to `PRACTICE` once a service and availability exist, so the dashboard shows the full practice view.
- CLINIC tenants: a practice OWNER/ADMIN can turn off their practice as a booking target for a therapist (`ConsultTherapistProfile.allowProfileBooking`, default true) but cannot edit or hide the therapist's profile.

### 6.9 Share kit

`/dashboard/profile/share`:
- **Link:** copy button, one-tap WhatsApp share with a suggested message, Instagram-bio tip.
- **QR code:** SVG/PNG download for flyers, business cards, slides.
- **Profile PDF** ("professional one-pager"), server-side with `pdfkit`, using the profile's theme: photo, name, kind, headline, qualifications, specialties, languages, link + QR. Starter and above; FREE users see a locked preview.
- **Email signature:** HTML snippet with name, kind and link.

### 6.10 Public profile page (`apps/profiles`)

`/therapists/{handle}`:
- Renders §6.2 sections in the chosen theme. Primary CTA per booking mode; secondary "Share".
- Footer: "Create your free therapist profile" link (signup with `?ref=profile&handle=`), "Report this profile" link, link to terms.
- `noindex` while `status ≠ PUBLISHED`; `410` for SUSPENDED; 301 for old handles; 404 otherwise.
- JSON-LD `Person` (name, jobTitle from kind, knowsLanguage, locality/country, image). No reviews or ratings.
- WCAG 2.1 AA; alt text required on photo upload; works at 320 px width.

Public API (no auth, cached):

```
GET  /v1/profiles/:handle        → public profile DTO (published only; redirect info for old handles)
GET  /v1/profiles/sitemap        → published handles + updatedAt
POST /v1/profiles/:handle/report → report (rate-limited, honeypot)
POST /v1/profiles/:handle/event  → stats beacon (Phase 2)
```

Public DTOs are **explicit allow-lists**; never serialise Prisma models. Never expose: account email, phone, userId, tenant internals, exact experience counts.

### 6.11 Freshness

On publish/update/unpublish/handle change/takedown: purge the profile URL at the edge. Purge failures are logged and retried through the existing outbox pattern, never swallowed (don't repeat the Google Calendar `.catch(() => undefined)` pattern). Changes visible within 1 minute.

### 6.12 Experience figures (D7)

- **Fix BKG-13 first.** Add booking outcome states (`COMPLETED`, `NO_SHOW`, `CANCELLED_LATE`). A daily cron moves past confirmed sessions to `COMPLETED` unless marked otherwise within 72 h; practitioners can correct it.
- `sessionsCompleted` = `COMPLETED` bookings across the practitioner's therapist profiles. `hoursLogged` = sum of `PractitionerHoursEntry`.
- Shown only when `showPlatformExperience = true`, as ranges: `<50`, `50–100`, `100–250`, `250–500`, `500–1,000`, `1,000+`, labelled "recorded on Unclutter Desk". Self-reported figures are labelled "self-reported".

### 6.13 Terms, reports & takedown (D6)

- Terms of use (new section in `terms.astro`): profile content is the practitioner's responsibility; impersonation and misleading content are not allowed; the platform may remove profiles that break the terms.
- "Report this profile" (impersonation, misleading content, unsafe content, other) → `PlatformRequest` with `type = PROFILE_REPORT` and the handle; appears in admin.
- Admin can hide or suspend a profile with a reason (audited); the practitioner is notified by email.

**Phase 1 acceptance**
- [ ] A new therapist signs up, picks a template and theme, and publishes a profile in under 10 minutes (manual test script)
- [ ] Profile-first dashboard mode works; switching on Desk booking moves the tenant to the full practice view
- [ ] All three booking modes work; external URL validated
- [ ] Templates and guidance editable in admin; unchanged-template-text warning works
- [ ] Themes pass contrast tests; OG image renders for each theme
- [ ] Handle change redirects; back-fill from `ConsultTherapistProfile` works
- [ ] Share link, QR and PDF use `profilePath()`; PDF gated to Starter+
- [ ] Report → admin → takedown works end to end; terms updated
- [ ] Public page SSR, readable without JS, Lighthouse accessibility ≥ 95

---

## 7. Phase 2 — Desk booking from profile & profile stats

**Builds on:** Phase 1, the public booking flow (`pages/public/booking/useBookingData.ts`).

### 7.1 Book from profile (DESK mode)

- Deep link: `https://{tenant.slug}.unclutterdesk.com/book?therapist={publicUsername}&src=profile` — or the tenant's ACTIVE `customDomain` if set.
- Booking flow change (`apps/app`): accept the `therapist` param, **preselect the therapist** and skip the therapist step. Unknown param → ignore silently.
- Attribution: carry `src` into a new nullable `ConsultBooking.source` column.
- Book button shows "Not taking online bookings right now" (no broken link) when the tenant is inactive, over its booking limit, or has `allowProfileBooking = false`.
- Browsing and starting a booking need no login; the client account is created inside the flow, as today.

### 7.2 Profile stats (privacy-safe)

- `ProfileStatDaily` (profileId, date, views, bookClicks, shares), incremented through the beacon endpoint.
- **No cookies, no visitor identifiers stored.** IP is used only in memory for de-duplication and never written. People looking for a therapist are not tracked.
- Dashboard **Stats** card: views, Book clicks, bookings from the profile (DESK mode, via `ConsultBooking.source`), last 30 days.
- Optional monthly "your profile this month" email (opt-out).

**Phase 2 acceptance**
- [ ] Book button preselects the therapist; `source` recorded on bookings
- [ ] Fallback text replaces the button in every unavailable case
- [ ] Stats count views and clicks without storing personal data (test asserts no IP/UA written)

---

## 8. Phase 3 — Verification (optional badge)

Therapists can publish and share without verification. Verification adds a badge for those who want it.

**Builds on:** Phases 1–2, admin panel, platform admin guard, the existing file upload mechanism (check how logos are stored today — `GET /v1/tenant/:id/logo` — and report before choosing storage), the field-encryption helper used for clinical notes.

### 8.1 Data model

```prisma
enum CredentialStatus { DRAFT SUBMITTED IN_REVIEW VERIFIED REJECTED EXPIRED REVOKED }

model ProfessionalBody {
  id          BigInt  @id @default(autoincrement())
  countryCode String
  shortName   String           // "CASSON", "NAPC", "ANEPCO"
  name        String?          // full name, entered by admin
  website     String?
  registerUrl String?          // public register, if one exists
  isActive    Boolean @default(true)
  @@unique([countryCode, shortName])
}

model PractitionerCredential {
  id               BigInt  @id @default(autoincrement())
  profileId        BigInt
  profile          PractitionerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  bodyId           BigInt?
  body             ProfessionalBody? @relation(fields: [bodyId], references: [id])
  type             String           // LICENCE | MEMBERSHIP | DEGREE | CERTIFICATE
  title            String
  membershipNumber String?          // encrypted (AES-256-GCM, same helper as clinical notes)
  issuedAt         DateTime?
  expiresAt        DateTime?
  documentKey      String?          // private object-storage key
  status           CredentialStatus @default(DRAFT)
  reviewerUserId   BigInt?
  reviewNote       String?          // shown to the practitioner on rejection
  reviewedAt       DateTime?
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

Add to `PractitionerProfile`: `verifiedAt DateTime?` (denormalised) and the `credentials PractitionerCredential[]` relation.

- Seed `ProfessionalBody` for Nigeria (`NG`): **CASSON, NAPC, ANEPCO** with `shortName` only. Admin can add bodies for other countries.
- Documents: private object storage (recommend Cloudflare R2), short-lived signed URLs, admin-only, every access audited. Max 10 MB; PDF/JPG/PNG.

### 8.2 Flow

1. In `/dashboard/profile/verification`, the practitioner adds a credential and uploads proof → `SUBMITTED`.
2. Admin queue `/admin/profiles/verification`: oldest first; profile, body, register link, document viewer, checklist (name matches, body matches, number checked on the register where possible, not expired).
3. Admin → `VERIFIED` (sets `verifiedAt`, purges the profile page) or `REJECTED` with a note; practitioner notified by email + in-app.
4. Daily expiry cron: past `expiresAt` → `EXPIRED`; the badge drops if no other verified credential remains; reminders 30 and 7 days before expiry.
5. Admin can `REVOKE` with a reason.

### 8.3 Display

- Badge on the profile and share PDF: "Verified · {body short name} · checked {month year}", linking to a short explainer page `/therapists/verification`.
- Unverified profiles show **no label**. The absence of a badge is the only difference (D6).
- Add **Verification** (10 points) to the completeness score; rescale the other weights proportionally.

**Phase 3 acceptance**
- [ ] Submit, verify, reject with notes, expire with reminders, revoke
- [ ] Documents reachable only via signed URLs by admins; access audited; membership numbers encrypted
- [ ] Badge appears within 1 minute of verification; no label on unverified profiles

---

## 9. Phase 4 — Directory & search

A public place to find published profiles. Profiles remain the product; the directory is an extra way to reach them.

**Builds on:** Phases 1–3, `apps/profiles`, taxonomy, `ConsultServiceFormat` prices.

### 9.1 Pages

- `/therapists`: free-text search, filters, results. Card: photo, name, kind, verified badge (if any), headline, primary specialties, languages, city/online, fee range, "accepting new clients".
- SEO landing pages for single-dimension filters with ≥ 3 claimed results: `/therapists/specialty/{key}`, `/therapists/language/{key}`, `/therapists/in/{country}/{city}`, `/therapists/online`. Multi-filter combinations use query params and are `noindex`.
- Empty state: suggest broadening filters, plus "Are you a therapist? Create your free profile".
- Practitioners can opt out of the directory (`PractitionerProfile.listedInDirectory`, default true) while keeping their shareable profile.

### 9.2 Search

- Postgres only (no new infra): a denormalised `DirectoryEntry` table refreshed on profile change, with `tsvector` over name, headline, about, taxonomy labels; GIN index; `pg_trgm` trigram index on name.
- Filters: specialty, modality, language, population (multi); kind; country; city; online/in-person; fee range (from min `ConsultServiceFormat.priceKobo` in DESK mode, or the profile's fee range); verified only; accepting new clients; gender (add optional self-declared `genderPublic` to the profile; filter matches only profiles that set it).
- Ranking per D11, then text relevance; a daily-rotating seed breaks ties so the same people don't always sit first.
- Cursor pagination, 20 per page.

### 9.3 API (no auth, cached)

```
GET  /v1/directory/profiles?q=&specialty=&modality=&language=&population=&kind=&country=&city=&online=&inPerson=&feeMin=&feeMax=&verified=&accepting=&cursor=
GET  /v1/directory/taxonomy      → active terms by kind
GET  /v1/directory/facets?...    → counts per filter value for the current query
```

- Reuse the public profile DTO allow-list from §6.10.
- Bookings that start from the directory carry `src=directory` into `ConsultBooking.source`.

**Phase 4 acceptance**
- [ ] Search with all filters, facets and cursor pagination
- [ ] SEO landing pages, sitemap, robots, canonical tags; practice subdomains still `noindex`
- [ ] Directory opt-out removes a profile from search without affecting its public page
- [ ] Profile changes reflected in search within 1 minute

---

## 10. Phase 5 — Unclaimed listings & claiming

Olalekan intends to list therapists found online before they join, so the directory is useful early and therapists are invited to claim their profile. Listing people who haven't signed up carries legal (NDPA) and trust risk, so these rules are **mandatory**.

**Builds on:** Phases 1–4.

### 10.1 Data model changes

On `PractitionerProfile`:
- `userId` becomes nullable (`BigInt? @unique`); null only for unclaimed listings.
- Add `claimState ClaimState @default(CLAIMED)` (`enum ClaimState { CLAIMED UNCLAIMED }`), `sourceUrls String[]`, `createdByAdminId BigInt?`.

```prisma
enum ClaimStatus { PENDING APPROVED REJECTED }

model ProfileClaim {
  id             BigInt  @id @default(autoincrement())
  profileId      BigInt
  profile        PractitionerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  claimantUserId BigInt
  status         ClaimStatus @default(PENDING)
  evidenceNote   String?
  reviewerUserId BigInt?
  reviewNote     String?
  createdAt      DateTime @default(now())
  reviewedAt     DateTime?
  @@index([profileId, status])
}

model DoNotRelist {
  id        BigInt   @id @default(autoincrement())
  name      String
  handle    String?
  reason    String?
  createdAt DateTime @default(now())
}
```

Update every access rule and test that assumes `userId` is non-null.

### 10.2 Creating listings (admin only)

- `/admin/profiles/unclaimed/new`: entered manually. **No automated scraping.**
- Allowed fields only: display name, kind, city/country, specialties and languages **as publicly stated**, and at least one `sourceUrl` (internal record of where the information was found).
- **Not allowed:** phone, email, photo (usually someone else's copyright), membership numbers, about/approach text copied from elsewhere.
- Handle auto-generated (`firstname-lastname`, de-duplicated); status PUBLISHED; `claimState = UNCLAIMED`.
- CSV bulk import with the same field allow-list and a required `sourceUrl` per row; rows with disallowed fields are rejected. Names on the `DoNotRelist` list are rejected.

### 10.3 Display

- Label at the top: "This profile hasn't been claimed. Information comes from public sources."
- **No Book button and no contact details.** Instead: "Is this you? Claim this profile" and "See therapists near you" (prefiltered by specialty and city).
- `noindex` and excluded from the sitemap, so the platform doesn't rank for people's names without their consent. Unclaimed listings appear in directory search, ranked after claimed profiles (D11).
- Visible "Remove this listing" link.

### 10.4 Removal (no account needed)

- `POST /v1/directory/removal-requests` with handle, requester name, email and relationship ("this is me" / "acting for them"). Rate-limited + honeypot.
- The listing is **hidden immediately**, pending admin review; admin confirms deletion within 7 days and adds the name to `DoNotRelist`.
- Claimed profiles can't be removed this way; such requests become reports (§6.13).

### 10.5 Claiming

1. "Claim this profile" → signup with `intent=claim&handle=…` (same one-transaction setup as §6.7, except the claim attaches to the existing listing instead of creating a new profile).
2. The claimant submits at least one credential with proof (§8); the name must match the listing.
3. Admin reviews claim and credential together. Approved → `userId` set, `claimState = CLAIMED`, credential `VERIFIED`, listing opens in the claimant's editor as a draft for them to complete and publish. Rejected → note to claimant; listing unchanged.
4. One PENDING claim per profile at a time; further claimants are queued and the admin sees all of them.
5. When a therapist signs up normally and an unclaimed listing with a matching name exists, the dashboard asks "Is this you?" and offers to claim it, to avoid duplicates.

**Phase 5 acceptance**
- [ ] Admin create + CSV import enforce the field allow-list, required `sourceUrl` and `DoNotRelist`
- [ ] Unclaimed listings: label, no Book button or contact details, `noindex`, excluded from sitemap
- [ ] Removal request hides instantly; admin confirmation adds to `DoNotRelist`
- [ ] Claim flow end to end; duplicate detection prompts "Is this you?"

---

## 11. Later — designed for, not built in v2

- **Profile builder:** drag-and-drop sections and custom blocks beyond themes and templates.
- **Own domain & brand** for profiles (§4.1).
- **Referrals** between practitioners.

Design implications: keep public DTOs allow-listed and taxonomy controlled (not free text), so new surfaces can reuse them.

---

## 12. Admin (`/admin/profiles`)

- **Profiles:** search, view, hide/suspend/restore with reason
- **Reports:** `PROFILE_REPORT` queue
- **Templates:** create/edit `ProfileTemplate` content
- **Taxonomy:** add/rename/deactivate terms (renames keep `key`)
- **Guidance text:** edit section guidance and writing tips
- **Verification queue** and **professional bodies** (Phase 3)
- **Directory insights** (Phase 4): searches with zero results, most-searched specialties and languages
- **Unclaimed listings, claims queue, removal requests, do-not-relist** (Phase 5)
- **Insights:** profiles created/published, booking mode split (NONE/DESK/EXTERNAL), FREE → Starter conversions, claim conversion
- Every admin action writes to an audit log (reuse the existing mechanism if present; otherwise add `AdminAuditLog`).

---

## 13. Cross-cutting requirements

**Privacy (NDPA)**
- Public DTO allow-lists; snapshot tests.
- Practitioners can export profile data and delete their profile (→ HIDDEN immediately, purged after 30 days; handle reserved 90 days to prevent impersonation).
- Update the privacy policy: public profile data, profile stats, report handling; then, as each phase lands, verification document processing and the object storage processor (Phase 3), the directory (Phase 4), and unclaimed listings with how to remove one (Phase 5).
- Unclaimed listings follow §10 without exception; `sourceUrls` is the record of where public information came from.
- Known risk to note in the v2 release notes (not v2 scope): intake answers, assessment answers and session summaries are stored as plaintext today.

**Operational limits**
- Single pm2 process, in-memory throttler, in-process crons. Profile reads are edge-cached, so v2 traffic is fine. Don't add high-frequency crons. Flag in the PR if anything would need Redis or a queue.

**Notifications** (existing outbox + Resend)
- Profile published; handle changed; profile reported (admin); profile hidden/suspended (practitioner); monthly profile summary (opt-out).
- Phase 3: credential submitted (admin), verified/rejected/expiring (practitioner). Phase 5: claim approved/rejected (claimant), removal request received (admin).

**Copy & tone**
- Calm, professional, plain. All profile-brand references go through `ProfileConfig.brandName`.

**Testing**
- Unit: entitlements table, writing tips, completeness scoring, handle rules, experience buckets, external URL validation, theme contrast.
- Integration: publish → purge; booking mode switches; FREE-limit behaviour; downgrade webhooks; report → takedown.
- E2E (Playwright; add minimal setup if absent): profile signup → template → publish → share link opens profile → switch on Desk booking → book (Paystack test mode).
- Access: owner-only profile writes; public DTO snapshot.
- Phases 3–5: verification lifecycle; directory filters and ranking; unclaimed-listing field allow-list; removal hides instantly; claim lifecycle end to end.

---

## 14. Delivery order & ownership

| Order | Phase | Builder | Olalekan's input |
|---|---|---|---|
| 1 | **0 Foundations** — entitlements, plans, trial removal, housekeeping, legal accuracy | Claude Code | — (decisions confirmed) |
| 2 | **1 Therapist profile** — structure, templates, themes, profile-first signup, booking modes, share kit, public page, reports | Claude Code | Review taxonomy list; edit template content and guidance; approve themes |
| 3 | **2 Desk booking from profile & stats** | Claude Code | Invite first therapists to create profiles |
| 4 | **3 Verification** (optional badge) | Claude Code | Enter CASSON, NAPC, ANEPCO details; act as first reviewer |
| 5 | **4 Directory & search** | Claude Code | Approve directory design; decide when there are enough profiles to launch it |
| 6 | **5 Unclaimed listings & claiming** | Claude Code | Add the first unclaimed listings; review claims |

Phases 0–2 are the core and ship first. Phases 3–5 follow in order. Each phase ends with green CI, updated `LAUNCH_FEATURE_MATRIX.md`, and a short PR summary listing anything that differed from this spec.

---

## 15. Definition of done for v2

- A therapist can sign up free, pick a template and theme, publish a clear profile at a friendly URL, and share it as a link, QR code, WhatsApp message and (on Starter) a PDF.
- A client opening the link sees a professional profile without logging in and can book through Desk, an external link, or contact details, depending on what the therapist chose.
- A profile-first therapist finds Desk's booking, payments and notes ready when they switch booking on.
- Plans run from one entitlements module: free profile (10 bookings, 5%) → Starter (30, 0%) → Pro; no trial promise remains.
- Therapists who want it can add a verified badge; nobody needs one to publish.
- Clients can search published profiles by specialty, language, location and format.
- Unclaimed listings follow the rules in §10, and the people they describe can claim or remove them.
- Moving profiles to a new domain later needs config, DNS and redirects — no code changes.
