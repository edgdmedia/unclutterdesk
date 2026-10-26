# Unclutter Desk v2 — Therapist Profiles

**Spec for Claude Code · Version 2.0 · 26 Oct 2026**
**Owner / decision-maker:** Olalekan Owonikoko

**Baseline:** before starting Phase 0, regenerate the current-state file from GitHub `main` (the 26 Oct `CURRENT_STATE` file came from an older local checkout). Where the regenerated baseline and this spec disagree about *what exists today*, the baseline wins. Where this spec says what to *build*, this spec wins. Known corrections to the old baseline:
- The public booking wizard has **no therapist step** (service → time → details → pay). See §7.1.
- Most Phase 0 housekeeping (§5.6) was done in commit `7a41424` on `dev`. Check it landed on `main` without conflicts.

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
7. **No hard-coded profile domain or brand.** Profiles will move to their own domain later. Every public profile URL and profile-brand string goes through one config module (§4.1). CI grep check: no literal `profiles.unclutterdesk.com` outside that config, except `apps/profiles/wrangler.jsonc` (route binding) and the API's excluded-origins / CORS configuration (§4.3).
8. **The profiles site is untrusted** (§4.3). Never relax those rules for convenience.
9. **Docs are part of "done."** Each phase updates `docs/LAUNCH_FEATURE_MATRIX.md` and any landing/legal copy it affects.
10. **Ask, don't guess, on anything marked `DECISION`.** Never invent a third option silently.

---

## 1. What v2 is

Therapists are often asked for their profile and send an Instagram page. v2 gives every therapist **a simple, professional profile page they can share with clients**, at a friendly URL, with:

- a clear structure set up in advance, so the profile reads well and the therapist knows what to put in it;
- **themes** (how the page looks) and **templates** (starting content for different kinds of practitioner);
- sharing tools: link, QR code, WhatsApp share, profile PDF, email signature;
- optional booking: the therapist can switch on Desk booking, or add an external booking link.

**Unclutter Desk is the backend.** Therapists create and edit their profile inside the Desk dashboard. Someone who signs up for a profile finds that booking, payments, notes and the rest of Desk are already there when they want them.

Unclutter Desk (unclutterdesk.com) remains its own product. Public profile pages are a separate surface at `profiles.unclutterdesk.com` until their own domain and brand are chosen.

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
- Per-practice timezones
- Referrals between practitioners

**Not planned**
- Paid placement, client reviews on profiles, messaging outside booking

---

## 2. Decisions

All confirmed by Olalekan on 26 Oct 2026.

| ID | Decision | Choice |
|---|---|---|
| D1 | Public profile URL | `https://profiles.unclutterdesk.com/{handle}` until the final domain is bought. Moving later is config + 301s (§4.1) |
| D2 | Who owns a profile | The **person** (`User`), not the practice (`Tenant`). One profile per user; globally unique handle |
| D3 | Where profiles are edited | Inside the Desk dashboard (`app.unclutterdesk.com`) |
| D4 | Booking on a profile | Three options: **none**, **Desk booking** (opt-in), or **external link**. Desk booking is the default suggestion |
| D5 | Plans | Free profile → Starter → Pro; Clinic for multi-therapist practices (§5.3). No trial |
| D6 | Which plan governs profile features | The **highest plan among practices where the person is OWNER or THERAPIST** with an active membership. Other roles (ADMIN, RECEPTIONIST, CLIENT) never count (§5.1) |
| D7 | Leaving a practice | The profile stays with the person. Only that practice's place is removed from it; if none remain, booking mode switches to NONE. The page is purged (§6.14) |
| D8 | Payments on Free | **Paystack only.** Bank transfer from Starter up. Review after the first 50 Free profiles or 60 days, whichever comes first: if fewer than half of the Free profiles that switch booking on finish Paystack setup, allow transfer on Free (§7.3) |
| D9 | Existing practices | No paying practices exist. Every existing practice gets **90 days of complimentary Starter**, with reminders 14 and 3 days before it ends, then drops to FREE. Olalekan's own practice gets a complimentary plan with **no end date** via an explicit flag (§5.4) |
| D10 | Email verification | Profile signup uses Desk's **existing 6-digit code step** (`/verify-email`). Auth rules for Desk don't change |
| D11 | Content responsibility | Profile content is the practitioner's responsibility (like LinkedIn). The platform provides terms of use, a report link and admin takedown. No verification required to publish |
| D12 | Experience figures | Optional. Hours and sessions recorded on Desk can be shown as ranges; self-reported figures allowed. Guidance discourages "success rate" claims |
| D13 | Client reviews on profiles | Not shown |
| D14 | Verification | Optional add-on badge, never required to publish. Nigerian bodies to seed: **CASSON, NAPC, ANEPCO** (acronyms; Olalekan enters full names and register links in admin) |
| D15 | Directory | Lists published profiles. Ranking: claimed before unclaimed; within claimed, verified first; then completeness, "accepting new clients", recent activity. No paid boosts |
| D16 | Unclaimed listings | Admin-created from public sources, limited data, no booking, `noindex`, instant removal on request, claim via signup + proof (§10) |
| D17 | Lapsed paid practices | 7 days' grace, then 14 days' notice with the exact date, then FREE. All staff except the owner are paused (and later reactivated only if the downgrade paused them). Upcoming sessions with paused therapists are surfaced to the owner (§5.4a) |
| D18 | Staff-entered bookings on the limit | Today or past dates: never blocked (they count). Future dates: follow the limit like online bookings (§5.5) |
| D19 | Several places of practice | One profile per person, with a "Where I practise" list of every practice they can be booked at, each with its own Book button; one is main (§6.1, §6.9) |
| D20 | Solo practices | A solo practice's address and the owner's profile address show the same page from one renderer. Automatic for practices without published reviews; practices showing reviews keep their page and are asked; opt-out available; clinics keep the practice page (§6.16) |
| D21 | Clinic listings | Opt-in clinic listings at `/clinic/{slug}` with the directory (Phase 4) |
| D22 | Domains | **Decided: one brand, two domains.** `therapysts.com` = landing page, profiles, directory. `therapysts.app` = the platform (sign-in and dashboard at the bare domain), API and practices. Until the domains are bought and checked, v2 runs on `unclutterdesk.com` / `profiles.unclutterdesk.com`; every origin is configurable from Phase 1 so the move is config, DNS and redirects (§4.1a, §4.1b) |

---

## 3. Concepts

| Term | Meaning |
|---|---|
| **Practitioner** | A `User` with an active `Profile` of role OWNER or THERAPIST and a `ConsultTherapistProfile` in some tenant |
| **Therapist profile** | `PractitionerProfile` — the public page at `profiles.unclutterdesk.com/{handle}`, owned by one user |
| **Practice entitlements** | What a practice (tenant) can do: bookings, fees, payments, domain, staff, assessments (§5.1) |
| **Profile entitlements** | What a person's profile can do: PDF, intro video. Derived from their qualifying memberships (§5.1) |
| **Profile structure** | The fixed set of sections every profile has (§6.4) |
| **Theme** | A visual preset for the public page: colours, fonts, layout (§6.5) |
| **Template** | Starting content for a kind of practitioner: section prompts and example wording (§6.6) |
| **Booking mode** | `NONE`, `DESK` or `EXTERNAL` (§6.9) |
| **Place of practice** | `PractitionerPlace`: a practice where this person can be booked. A profile can have several; one is main (§6.1, §6.9) |
| **Solo practice** | A practice whose only active therapist is its owner. Its address shows the owner's profile at `/` (§6.16) |
| **Profile-only practice** | A FREE practice created by profile signup that hasn't switched booking on (§6.8) |
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
  publicOrigin: string;     // PROFILE_PUBLIC_ORIGIN, v2: "https://profiles.unclutterdesk.com"
  profilePath: (handle: string) => string; // -> `${publicOrigin}/${handle}`
}
```

Rules:
- Every profile link, QR code, PDF, email, sitemap entry, canonical tag and JSON-LD uses `profilePath()`.
- Store **handles**, never full URLs, in the database.
- Future domain move (document only): new domain → same app; `profiles.unclutterdesk.com/{handle}` 301s to it. QR codes printed in v2 keep working through the 301.

### 4.1a All domains configurable (Phase 1 workstream)

The whole platform moves to therapysts.com / therapysts.app before launch (§4.1b). Today `unclutterdesk.com` appears ~100 times across 48 files (plus 36 test files). Moving now is a few days of mechanical work; after launch the external integrations turn it into a migration project. So, in Phase 1, make **every** origin a setting:

| Setting | Today | Notes |
|---|---|---|
| `MARKETING_ORIGIN` | `https://unclutterdesk.com` | |
| `APP_ORIGIN` | `https://app.unclutterdesk.com` | **Its own setting**, not derived from the root domain (a future layout may serve the app at a bare domain) |
| `API_ORIGIN` | `https://api.unclutterdesk.com` | |
| `TENANT_ROOT_DOMAIN` | `unclutterdesk.com` | Practice subdomains `{slug}.<root>` |
| `PROFILE_PUBLIC_ORIGIN` | `https://profiles.unclutterdesk.com` | §4.1 |
| `EMAIL_FROM_DOMAIN` / `NO_REPLY_ADDRESS` | `unclutterdesk.com` | Resend sending domain |
| `CUSTOM_DOMAIN_CNAME_TARGET` | current Cloudflare for SaaS target | What Pro customers point their domains at |

Work items (from the code audit):
- **API:** most of it already goes through `ROOT_DOMAIN` in `origins.ts` with `APP_URL`/`API_URL` overrides. Finish it: `tenant.service.ts`, `reserved-slugs.ts`, the Google Calendar callback in `calendar.service.ts`, and the tenant middleware. Stop building the app origin as `app.${ROOT_DOMAIN}`.
- **App:** remove the 13 hard-coded fallbacks in `apiClient.ts` (use `VITE_API_URL` / `VITE_APP_URL`); move legal links and settings-page URLs onto config.
- **Landing:** 14 places, mostly copy and legal pages.
- **Infra:** `tenant-router` config (including the apex rule), nginx and the TLS certificate, `deploy.sh`.
- **Tests:** use the config, not literals.
- **Document (don't change yet)** the external items a move would touch: Paystack, Google OAuth and Daily.co callback/webhook URLs; the Resend sending domain and `no-reply@` sender; the custom-domain CNAME target.
- Extend the §0 rule 7 grep check: no literal production domain outside the config files and the listed exceptions.

### 4.1b Target domains: therapysts.com + therapysts.app (D22)

**Decided layout** — one brand, two domains (the github.com / githubusercontent.com pattern):

| Address | What it is | Today (interim) |
|---|---|---|
| `therapysts.com` | Landing page: create your free profile, discover the platform. Directory from Phase 4 | `unclutterdesk.com` |
| `therapysts.com/{handle}` | Therapist profile | `profiles.unclutterdesk.com/{handle}` |
| `therapysts.com/clinic/{slug}` | Clinic listing (Phase 4) | `profiles.unclutterdesk.com/clinic/{slug}` |
| `therapysts.app` | Sign-in and dashboard (bare domain) | `app.unclutterdesk.com` |
| `api.therapysts.app` | API | `api.unclutterdesk.com` |
| `{slug}.therapysts.app` | Practice: booking, client login, sessions | `{slug}.unclutterdesk.com` |
| Custom domains (Pro) | Practice on the therapist's own domain | unchanged, new CNAME target |

Why two domains: `therapysts.com` and `therapysts.app` are **different sites** to the browser, so profile pages can never receive platform cookies, and the current CSRF design (a JavaScript-readable CSRF cookie on the platform domain) keeps working unchanged. The §4.3 rules still apply in full.

Rules for the move:
- **`therapysts.app` serves the platform at the bare domain.** `APP_ORIGIN` is its own setting (§4.1a). Visitors who aren't signed in see the sign-in page with a link to `therapysts.com`. Marketing never lives on `.app`. `app.therapysts.app` and `www.therapysts.app` redirect to the bare domain.
- `tenant-router`'s apex rule changes: the bare `therapysts.app` is the app, never a practice. Reserve `app`, `api`, `www` (and the existing reserved list) as practice slugs on `.app`.
- `.app` is HTTPS-only by browser rule (HSTS preload); the platform is already HTTPS-only.
- **One site on `therapysts.com`:** merge `apps/landing` into `apps/profiles` (one Astro app, one deployment, one reserved-path list covering marketing pages and handles, §6.2). Build `apps/profiles` in Phase 1 so it can absorb the landing pages; do the merge as part of the move.
- **Redirects after the move** (permanent): `profiles.unclutterdesk.com/*` → `therapysts.com/*`; `{slug}.unclutterdesk.com/*` → `{slug}.therapysts.app/*`; `app.unclutterdesk.com/*` → `therapysts.app/*`; `unclutterdesk.com` → `therapysts.com`. Keep them for at least 12 months.
- **External items to update at the move:** Paystack, Google OAuth and Daily.co callback and webhook URLs; Resend sending domain and the `no-reply@` sender; the Cloudflare for SaaS CNAME target (existing custom domains keep working via a fallback or are re-pointed with owner notice).
- **Timing:** before public launch, while there are no external customers to migrate. Prerequisites (Olalekan): buy `therapysts.com` and `therapysts.app`; run trademark checks on "Therapysts" (WIPO Global Brand Database, Nigeria's Trademarks Registry).

### 4.2 New app: `apps/profiles`

Serves the public profile pages (and, from Phase 4, the directory).

- **Astro SSR on Cloudflare Workers with static assets** (not Pages, which Cloudflare now steers new sites away from).
- Bound to its own Worker route `profiles.unclutterdesk.com/*`. **No change to `tenant-router` code is needed:** Cloudflare lets a more specific route win over `*.unclutterdesk.com/*`, and `tenant-router` already relies on this for `api`. This also keeps profiles out of the router's blanket `X-Robots-Tag: noindex`, which would otherwise hide every profile from search engines.
- Server-renders from the **public** API endpoints only (§6.11), with edge caching (`s-maxage` ~5 min, `stale-while-revalidate`); purged on change (§6.12).
- Published profiles are **indexable**: canonical tag, `sitemap.xml`, `robots.txt`, Open Graph/Twitter cards, JSON-LD `Person`.
- Themes are token sets (§6.5), so the app can be rebranded with the future domain.
- Performance: LCP < 2.5 s on a mid-range Android on fast 3G; readable without JavaScript.

### 4.3 Security: the profiles site is untrusted

Desk's auth cookies are set for `.unclutterdesk.com` with `SameSite=None`, so a signed-in therapist's browser sends them to `profiles.unclutterdesk.com`. The profiles site also displays content that therapists write. Rules:

1. **Cookies are ignored end to end.**
   - The edge cache key **excludes cookies**, and responses never vary on them.
   - The profile renderer **never reads cookies or `Authorization`**, and never calls authenticated API endpoints. It calls only the public endpoints in §6.11, without credentials.
   - Responses set `Cache-Control` explicitly and never set cookies.
   - Otherwise one person's view could be cached and served to everyone.
2. **Not a trusted origin.** The API currently trusts every `*.unclutterdesk.com` origin for signed-in requests, and its CORS setup sends credentials globally. **Exclude `profiles.unclutterdesk.com`** from the trusted-origin / CORS-with-credentials list and from the CSRF allow-list. It only needs public endpoints.
   - Add a **separate CORS rule without credentials** (`Access-Control-Allow-Credentials` absent) for the profiles origin, applied only to the browser-called public endpoints: `POST /v1/profiles/:handle/report`, `POST /v1/profiles/:handle/event`, and from Phase 4 `POST /v1/directory/removal-requests`. Server-side rendering calls from the Worker don't need CORS.
   - The stats beacon and report form use `fetch(…, { credentials: 'omit' })`.
   - Add a test that a credentialed request from that origin is rejected, and that the public endpoints respond without `Allow-Credentials`.
3. **Strict Content Security Policy** on every profiles response, e.g.: `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' <R2 public host> data:; font-src 'self'; connect-src <API origin for the stats beacon only>; frame-ancestors 'none'; base-uri 'none'; form-action <API origin>`. No inline scripts (use hashed or external scripts if any are needed). Also `X-Content-Type-Options: nosniff` and `Referrer-Policy: strict-origin-when-cross-origin`.
4. **Therapist text is rendered as plain text, never HTML.** No Markdown-to-HTML, no `set:html`, no `dangerouslySetInnerHTML`. Line breaks are preserved with CSS (`white-space: pre-line`). URLs (social links, external booking) are validated as `https:` and rendered as `href` attributes only. Add a test that a profile containing `<script>` and `javascript:` payloads renders inert.

### 4.4 Shared infrastructure added in Phase 1

These don't exist today and Phase 1 needs them:

- **File storage (Cloudflare R2).** Today logos and photos are stored as base64 in the database. Add an R2-backed storage service for profile photos, preview images and intro videos. Public bucket (or public path) for published-profile assets; a separate **private** bucket for anything sensitive (credential documents in Phase 3). Existing base64 logos can stay as they are in v2.
- **Background job table.** `NotificationDispatch` only handles notifications. Add a small generic `BackgroundJob` table (`type`, `payloadJson`, `runAfter`, `attempts`, `lastError`, `dedupeKey`, `completedAt`) processed by an existing in-process cron (no new high-frequency cron; reuse the 5-minute schedule). Used for cache purges and preview-image generation, with retries.
- **Admin audit log.** No audit log exists today. Add `AdminAuditLog` (`actorUserId`, `action`, `targetType`, `targetId`, `reason`, `metaJson`, `createdAt`) in Phase 1, since takedowns need it. Every admin action in this spec writes to it.

### 4.5 Where things live

| Concern | Location |
|---|---|
| Profile editor, themes, templates, booking mode, share kit, stats, credentials, claims | `apps/app` → `/dashboard/profile/*` |
| Templates, taxonomy, reports, takedowns, verification queue, directory, unclaimed listings | `apps/app` → `/admin/profiles/*` |
| Public profile pages, directory search (Phase 4) | `apps/profiles` |
| API | `apps/api/src/modules/entitlements/`, `.../practitioner-profile/`, `.../storage/`, `.../jobs/`, `.../audit/`, `.../verification/` (Phase 3), `.../directory/` (Phase 4) |
| Booking | Unchanged: `{slug}.unclutterdesk.com/book` (deep-linked, §7.1) |

---

## 5. Phase 0 — Foundations (must land first)

**Status (26 Oct 2026): built, not yet merged to `main`.** A Claude Code session built Phase 0 before the later decisions in this spec were agreed. A code review found it solid but incomplete. **Do not rebuild it.** Finish it with the follow-ups in §5.7, then merge. §5.1–§5.6 describe the target state; §5.7 lists what differs today.

**Builds on:** `subscription-plans.ts`, `booking-limits.ts`, `assessments/engine.ts` (`tierIncludes`), `manual-payment.service.ts`, billing webhook handling, invite-code expiry cron, `auth.service.ts`, onboarding wizard, landing pricing copy, frontend tier checks in `apps/app`.

### 5.1 Entitlements module (two scopes)

Plans belong to practices, but profiles belong to people. The module therefore has two scopes.

```ts
// apps/api/src/modules/entitlements/entitlements.ts
export type Tier = 'FREE' | 'STARTER' | 'PRO' | 'CLINIC';

/** What a practice (tenant) can do. */
export interface PracticeEntitlements {
  monthlyBookingLimit: number | null;   // null = unlimited
  platformFeeBps: number;               // 500 = 5%
  bankTransferPayments: boolean;
  customDomain: boolean;
  staffInviteRoles: Array<'ADMIN' | 'RECEPTIONIST' | 'THERAPIST'>;
  assessmentRank: number;               // replaces tierIncludes ranking; FREE == STARTER
  googleCalendarSync: boolean;
}

/** What a person's profile can do. */
export interface ProfileEntitlements {
  downloadablePdf: boolean;
  introVideo: boolean;
}

export const PRACTICE_ENTITLEMENTS: Record<Tier, PracticeEntitlements> = { /* §5.3 */ };
export const PROFILE_ENTITLEMENTS: Record<Tier, ProfileEntitlements> = { /* §5.3 */ };

/** Effective tier of a practice, including complimentary periods. Empty/unknown → 'FREE'. */
export function effectiveTier(tenant: Pick<Tenant, 'subscriptionTier' | 'subscriptionStatus' | 'complimentaryUntil' | 'complimentaryReason'>): Tier;

export function practiceEntitlements(tenant: …): PracticeEntitlements;

/**
 * Profile entitlements for a user = PROFILE_ENTITLEMENTS of the highest effectiveTier among
 * tenants where the user has an ACTIVE Profile with role OWNER or THERAPIST.
 * ADMIN, RECEPTIONIST and CLIENT memberships never count. Inactive or closed practices
 * (Tenant.isActive = false, or closureRequestedAt set) never count. No qualifying membership → FREE.
 */
export function profileEntitlementsForUser(userId: bigint): Promise<ProfileEntitlements>;
```

- `EntitlementsService.assertPractice(tenantId, key)` and `assertProfile(userId, key)` throw a typed `EntitlementError` → **HTTP 402** with `{ code: 'ENTITLEMENT_REQUIRED', scope, feature, requiredTier }`.
- `GET /v1/tenant/entitlements` returns the current practice's entitlements; `GET /v1/me/profile-entitlements` returns the signed-in user's profile entitlements. The frontend gates UI from these **before** the API fails.
- **Frontend:** the app currently handles 400 and 403. Add handling for 402 (upgrade prompt naming the plan from `requiredTier`). Move frontend tier comparisons onto the entitlements responses.
- **Refactor every existing tier check** to use the module: booking limits, platform fee, manual (bank transfer) payments, custom domain, staff invites, assessments, Google Calendar.
- **Fallbacks:** there are ~9 places that fall back to `'STARTER'` when the plan is empty. All must go through `effectiveTier()`, which falls back to **`FREE`**. Otherwise an empty plan quietly gets paid features.
- **Assessments:** admin-authored instruments store `tier: 'STARTER'` inside saved definitions. `assessmentRank` must rank FREE equal to STARTER so those definitions keep working unchanged.
- **Enforcement test (API and frontend):** a grep-based test (cheaper than ESLint if ESLint isn't set up in every app) that fails on:
  - any read of `subscriptionTier` outside the entitlements module and the billing/webhook code that writes it;
  - any comparison against a plan literal (`=== 'STARTER'`, `!== 'PRO'`, `case 'CLINIC':`, `includes('FREE')`, etc.) outside the entitlements module.

  Plan names may still appear as display labels, Paystack env names, tests, migrations and saved assessment definitions. The test bans **comparisons and direct reads**, not the strings.
- Tests: table-driven spec for every key × tier in both scopes; `profileEntitlementsForUser` cases (solo owner, Clinic therapist, receptionist at a Pro practice → FREE, deactivated membership ignored, several practices → highest).

### 5.2 Email verification code

- Signup already generates a 6-digit code and sends the user to `/verify-email`. Keep this flow; profile signup uses it unchanged (D10).
- **Fix:** the code is generated with `Math.random()` in `auth.service.ts`. Switch to `crypto.randomInt(0, 1_000_000)`, zero-padded to 6 digits. Apply the same change anywhere else `Math.random()` generates a security code or token. Add a test.

### 5.3 Plans (confirmed)

| | Free profile (`FREE`) | Starter | Pro | Clinic |
|---|---|---|---|---|
| Price | ₦0 | ₦5,000/mo | ₦15,000/mo | from ₦45,000/mo |
| **Profile** | | | | |
| Therapist profile, themes, templates, share link/QR | ✅ | ✅ | ✅ | ✅ (per therapist) |
| Profile PDF, intro video *(profile entitlements)* | ❌ | ✅ | ✅ | ✅ |
| **Practice** | | | | |
| Desk booking (opt-in) | ✅ | ✅ | ✅ | ✅ |
| Bookings / month | **10** | **30** | Unlimited | Unlimited |
| Platform fee on Paystack payments | **5%** | **0%** | 0% | 0% |
| Paystack payments | ✅ | ✅ | ✅ | ✅ |
| **Bank transfer payments** | ❌ | ✅ | ✅ | ✅ |
| Google Calendar push | ❌ | ✅ | ✅ | ✅ |
| Assessments | PHQ-9, GAD-7 | PHQ-9, GAD-7 | + PCL-5, DASS-21 | all |
| Clinical notes, hours log, intake | ✅ | ✅ | ✅ | ✅ |
| Custom domain for booking pages | ❌ | ❌ | ✅ | ✅ |
| Staff | — | — | Admin/Receptionist | + Therapists |

Notes:
- Changes from today's code: Starter limit 20 → **30**, Starter fee 5% → **0%**, bank transfer opens to **Starter** (today `manual-payment.service.ts` allows it on Pro/Clinic only).
- Free users must set up a Paystack subaccount (bank details) before taking a paid booking. That set-up step is measured (§7.3).
- Desk's public pricing page shows **Starter, Pro, Clinic**, plus the line "Start with a free therapist profile". The free plan is presented as the free profile, not as a fourth Desk plan.
- Clinic Plus (sales flow), trainee access and invite-code periods stay off the public pricing page, unchanged.
- In-app upgrade prompts follow the path free → Starter → Pro. Never skip straight to Clinic.

### 5.4 FREE tier, complimentary periods & migration

- Add `FREE`; new tenants default to `FREE`.
- Add to `Tenant`: `complimentaryReason` (enum `INVITE_CODE | MIGRATION | INTERNAL`, nullable). Semantics:
  - `complimentaryUntil` set → complimentary until that date (existing behaviour).
  - `complimentaryReason = INTERNAL` **and** `complimentaryUntil = null` → complimentary with **no end date**. No far-future dates.
  - **INTERNAL with a null date is active everywhere.** `effectiveTier`, the expiry cron and the lapse logic (§5.4a) must each treat it as an active complimentary plan, with a test for each. (As built, `effectiveTier` and the cron already do; the lapse query doesn't, because it includes practices with `complimentaryUntil: null`. Exclude `complimentaryReason = INTERNAL` there explicitly.)
  - **A payment clears both** `complimentaryUntil` **and** `complimentaryReason`. Otherwise a paying INTERNAL practice would be skipped by the lapse logic for ever.
- **Migration** (data only; no email, no tenant IDs):
  - **Edit the existing, unmerged migration** `20261026090000_free_tier` rather than adding a new one. It has never reached `main` or production, and no shared database has run it. Reset any dev database that ran it (`prisma migrate reset`).
  - Unpaid STARTER practices **stay on STARTER** with `complimentaryUntil = now() + 90 days` and `complimentaryReason = MIGRATION`. They are **not** set to FREE. The existing expiry cron already handles a complimentary period with no invite code, and drops them to FREE when it ends.
  - The migration runs safely on fresh, local and CI databases (no hard-coded tenants).
- **Emails** (a migration can't send email): the cron queues them through `NotificationDispatch` with a `dedupeKey`:
  - "You have Starter free until {date}" for each practice with `complimentaryReason = MIGRATION` (dedupe key per tenant + period end);
  - **reminders 14 days and 3 days before** `complimentaryUntil` for migration and invite-code periods, stating the date and what changes (10 bookings a month, no calendar sync, no bank transfer). Each is sent once.
- **Olalekan's practice: one-off script, run right after deploy** (it can't run before, since `complimentaryReason` only exists once the migration has run). Until it runs, his practice simply has 90 days of Starter like everyone else.
  - `pnpm tsx scripts/set-internal-tenant.ts --tenant <id> --tier <tier>`
  - Refuses to run if the tenant doesn't exist.
  - Safe to run twice (idempotent).
  - Sets `complimentaryReason = INTERNAL`, `complimentaryUntil = null`, `subscriptionTier = <tier>`.
  - Cancels any pending migration emails for that tenant **through the same `dedupeKey`s the cron uses**, so the cron doesn't queue them again.
  - Logs what it changed (before/after) to stdout; the audit log arrives in Phase 1.
  - Later changes go through the admin "Complimentary plans" screen (§12).
- The expiry cron (invite codes and migration periods) drops practices to **FREE** (not STARTER) unless they hold a paid subscription.
- STARTER and above now require an active Paystack subscription or a complimentary period. Lapsed subscriptions follow §5.4a.
- **Renewal date:** `subscription.create` must always store `subscriptionRenewsAt`. On `not_renew`/`disable`, if `subscriptionRenewsAt` is missing, fetch it from Paystack. **Never downgrade immediately** because the date is unknown: the practice keeps its plan until the end of the period it paid for (if Paystack can't answer, assume one month from the last successful charge).
- Remove all trial copy from landing, signup and onboarding (see §5.7 for the test). Update landing pricing to §5.3.

### 5.4a Lapsed paid practices

**Timeline** (all durations configurable; defaults shown):

| Day | Event | What happens |
|---|---|---|
| 0 | Payment fails, or the paid period ends after `not_renew` / `disable` | Owner emailed; practice keeps its plan |
| 0–7 | **Grace period** | Practice keeps its plan; reminder emails |
| 7 | Grace ends | Practice enters **downgrade notice**. Owner emailed with the **exact date** the practice moves to Free |
| 7–21 | **Notice period** (14 days) | Practice keeps its plan. Dashboard banner with the date. Owner sees the list of upcoming sessions with staff who will be paused (below) |
| 21 | Move to Free | Practice drops to FREE; staff paused (below) |

Resubscribing at any point stops the timeline.

**Who gets paused:** FREE allows no staff, so **every active membership except the OWNER** is paused, including ADMIN, RECEPTIONIST and THERAPIST. Clients are not affected.

**How:**
- Add `Profile.pausedByDowngradeAt DateTime?`. On the move to Free, set `status = inactive` and `pausedByDowngradeAt = now()` for each paused membership.
- Paused staff can't sign in to that practice. Their accounts, notes, records and history are kept intact.
- **Upcoming sessions:** during the notice period, the owner sees every future booking with a therapist who will be paused, and can reassign it to themselves, reschedule it or cancel it (with the usual client notifications). Sessions still unhandled on day 21 are kept, and the owner is emailed the list. They must not silently stop working.
- **On resubscribe:** reactivate **only** memberships with `pausedByDowngradeAt` set, and clear the field. People the owner had set to inactive by hand stay inactive.
- **Downgrade checks** (staff counts, "can this practice drop to Free?") count only **active** non-owner, non-client memberships. Inactive staff never block a downgrade.

**Profiles aren't affected.** A therapist's profile belongs to the person (D2). Pausing them in a practice doesn't hide their profile; it only turns off a Book button that points at that practice, using the same rule as leaving a practice (§6.14).

### 5.5 Booking limit

- **What counts** towards `monthlyBookingLimit`:
  - confirmed bookings;
  - bookings with an **active** payment hold;
  - bank transfers awaiting confirmation;
  - bookings created by staff.

  Expired holds and cancelled bookings don't count, so abandoned checkouts don't use up slots.
- **What the limit blocks:**
  - Online bookings by clients: blocked once the limit is reached.
  - Bookings staff enter for a **future** date: blocked once the limit is reached, same as online bookings (otherwise staff entry with a pay link would bypass the limit).
  - Bookings staff enter for **today or a past date** (recording a session that happened, e.g. a walk-in): **never blocked**. They count towards the total, and going over shows the upgrade prompt.
  - "Today" is judged in Africa/Lagos time.
- **Late cancellations and no-shows count** (the slot was held). Only on-time cancellations and expired holds don't. The late/on-time distinction starts once the booking-outcome work (§6.13) ships; until then every cancellation is plain `CANCELLED` and doesn't count.
- **Which month:** the month the booking is **created**, in **Africa/Lagos** time always (not the server's local midnight). Practices have no timezone field; per-practice timezones are on the later list (§11).
- **Check early, not only at creation.** Today the limit triggers at booking creation, after the client has signed up. Add `fullyBookedThisMonth: boolean` to the public availability response and to the public profile DTO, so:
  - the booking page shows "Fully booked this month" before the client starts;
  - the profile's Book button becomes "Not taking new online bookings this month";
  - the practice sees an upgrade prompt.
- Keep the creation-time check as a backstop.

### 5.6 Housekeeping

- Verify commit `7a41424` (stray `apps/prisma/migrations/`, `fix_ts*.mjs`, untracked screenshot) is on `main` and didn't conflict; finish anything left.
- Legal/landing accuracy: add **Daily.co** and JaaS/8x8 to the privacy policy processor table; correct the "Jitsi or Google Meet" claim; correct assessment tier claims; say "clinical notes are encrypted at rest", not everything.
- Update `docs/ARCHITECTURE.md` and `LAUNCH_FEATURE_MATRIX.md` to match code.

### 5.7 Phase 0 follow-ups (from code review, 26 Oct 2026)

Already correct, keep as built: empty/unknown plans fall back to FREE; FREE ranks with STARTER for assessments; expired complimentary periods aren't honoured even before the cron runs; a payment clears `complimentaryUntil`; "fully booked" shows before client signup; fee in basis points with correct rounding; invite-code expiry sends practices to FREE; privacy and terms name Daily.co and 8x8; the booking count (everything not cancelled, with abandoned holds cancelled by the cron) matches §5.5; the plan table, downgrade handling and API tier-comparison test.

**Merge blockers — fix before Phase 0 reaches `main`:**

| # | Issue | Fix |
|---|---|---|
| 1 | Trial copy still on the landing page (`LandingPage.tsx:156` "Start free trial", `:544` "Start Free 14-Day Trial") | Remove it. Add a test over `apps/landing` and `apps/app` that fails on trial **phrases**, not the word alone: e.g. `free trial`, `start trial`, `14-day`, `14 day`, `trial ends`, `unlocked for 14 days`, `days left in your trial` (case-insensitive). "There is no time-limited trial" in the FAQ and legal uses of "trial" must pass |
| 4 | Bank transfer still Pro/Clinic only | Open it to Starter in the entitlements table, `manual-payment.service.ts`, the plan table UI and landing copy (§5.3) |
| 5 | Migration drops unpaid Starter practices straight to Free; no no-end-date flag | Edit `20261026090000_free_tier` per §5.4: keep STARTER with a 90-day `complimentaryUntil`; add `complimentaryReason`; cron-queued emails and 14-/3-day reminders; payment clears both fields; add the `set-internal-tenant` script (run after deploy) |
| 4a | Lapse logic includes practices with `complimentaryUntil: null`, so an INTERNAL practice would only be safe while it has no Paystack status | Exclude `complimentaryReason = INTERNAL` explicitly in `enforceLapsedSubscriptions`; test it |
| 7 | `staffCounts()` counts inactive staff, so a practice with one paused receptionist can never drop to Free | Count only active non-owner, non-client memberships (§5.4a) |

**Also before Phase 1:**

| # | Issue | Fix |
|---|---|---|
| 2 | No frontend handling for 402 | Add a global handler in `apps/app` that turns 402 `ENTITLEMENT_REQUIRED` into an upgrade prompt naming `requiredTier` |
| 3 | Frontend still compares plan names (`SubscriptionSettingsPage.tsx:68,71,196`, `SignupPage.tsx:13`, `DashboardPage.tsx:247`, `AdminInvitesPage`) | Move them onto the entitlements responses; extend the tier-comparison test to scan `apps/app` |
| 6 | `monthStart()` uses server local midnight (pm2 sets no timezone) | Compute month boundaries in Africa/Lagos time (§5.5) |
| 8 | A lapsed practice with staff keeps its paid plan forever | Implement §5.4a (grace → notice → Free, pause staff with `pausedByDowngradeAt`, upcoming-sessions view, reactivate only downgrade-paused staff) |
| 9 | `not_renew` with no `subscriptionRenewsAt` downgrades immediately | Always store the renewal date on `subscription.create`; fetch from Paystack if missing; never downgrade immediately (§5.4) |
| — | Staff-entered bookings blocked at the limit | Apply the §5.5 split: today/past never blocked; future dates follow the limit |

**Minor:**
- `hasEntitlement('platformFeeBps')` returns a misleading answer (FREE "has" it because its fee is above zero). Replace with an explicit `platformFeeBps(tenant)` lookup and remove numeric keys from `hasEntitlement`.
- `EntitlementsService.summary()` repeats the booking-count query. Make it call `countMonthlyBookings()` so the two can't drift.
- Local `node_modules` is broken; run `pnpm install` and the full test suite locally before merging.

**Phase 0 acceptance**
- [ ] Two-scope entitlements in place; tier-comparison test scans **API and frontend**; all empty-plan fallbacks resolve to FREE
- [ ] `profileEntitlementsForUser` counts only active OWNER/THERAPIST memberships (tested)
- [ ] 402 handled in the frontend with an upgrade prompt
- [ ] Verification code uses `crypto.randomInt`
- [ ] New signup → FREE tenant; trial-phrase test passes on `apps/landing` and `apps/app`
- [ ] Starter: 30 bookings, 0% fee, bank transfer enabled; Free: Paystack only
- [ ] Edited `free_tier` migration keeps unpaid practices on Starter for 90 days and runs cleanly on a fresh database; emails and 14-/3-day reminders queued by the cron with dedupe keys; cron drops expired periods to FREE
- [ ] `set-internal-tenant` script: refuses unknown tenants, idempotent, logs changes, cancels pending migration emails; INTERNAL with null date treated as active by `effectiveTier`, the expiry cron and the lapse logic (tested); payment clears `complimentaryUntil` and `complimentaryReason`
- [ ] Renewal date always stored; no immediate downgrade on `not_renew`
- [ ] Lapse timeline (§5.4a) works end to end: grace, notice with exact date, upcoming-sessions view, pause with `pausedByDowngradeAt`, selective reactivation; inactive staff don't block downgrades
- [ ] Booking limit counts per §5.5 by creation month in Lagos time; staff today/past entries never blocked; future entries limited; `fullyBookedThisMonth` exposed
- [ ] Legal pages list the actual video processors

---

## 6. Phase 1 — Therapist profile

A therapist can sign up, build a clear profile with a theme and template, choose how clients book, publish it, and share it.

**Builds on:** Phase 0; `User`, `Profile`, `ConsultTherapistProfile` (already has `publicUsername`, `tagline`, `specialty`, `modalities[]`, `credentials`, `yearsExperience`, `languages[]`, `isPublic`, `offersOnline/InPerson`), `ConsultService`/`ConsultServiceFormat`, `PracticeLocation`, `PractitionerHoursEntry`, `ConsultBooking`, signup/`tenant/register`, `/verify-email`, `reserved-slugs.ts`, `GET /v1/tenant/public/exists/:slugOrDomain`, onboarding wizard, `pdfkit`. Adds the infrastructure in §4.4.

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
  templateKey        String?                     // template used to start (§6.6)
  themeKey           String   @default("calm")   // §6.5
  displayName        String
  pronouns           String?
  photoKey           String?                     // R2 object key (§4.4)
  previewImageKey    String?                     // R2 key of the generated OG image (§6.3)
  headline           String?                     // one line, <= 120 chars
  about              String?                     // <= 2,000 chars, plain text
  approach           String?                     // <= 1,500 chars, plain text
  introVideoKey      String?                     // R2 key; profile-entitlement-gated
  credentialsText    String?                     // plain text: qualifications & memberships as the therapist states them
  city               String?
  countryCode        String   @default("NG")     // ISO 3166-1 alpha-2
  offersOnline       Boolean  @default(true)
  offersInPerson     Boolean  @default(false)
  acceptingClients   Boolean  @default(true)
  faithIntegration   String?
  supervisedBy       String?                     // shown for trainees, optional
  showPlatformExperience Boolean @default(false) // D12 opt-in
  selfReportedYears  Int?
  selfReportedClientsBucket String?              // e.g. "50-100"
  feeRangeText       String?                     // used when booking mode isn't DESK
  bookingMode        BookingMode @default(NONE)
  places             PractitionerPlace[]         // DESK mode: where this person can be booked (§6.9)
  externalBookingUrl String?                     // EXTERNAL mode: https only
  contactEmailPublic String?                     // optional, shown only if set
  socialLinks        Json?                       // optional: { instagram, linkedin, website, ... } https only
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

model PractitionerPlace {                  // "Where I practise": one row per practice this person can be booked at
  id                 BigInt   @id @default(autoincrement())
  profileId          BigInt
  profile            PractitionerProfile @relation(fields: [profileId], references: [id], onDelete: Cascade)
  tenantId           BigInt                       // the practice
  therapistProfileId BigInt                       // -> ConsultTherapistProfile.profileId in that practice
  isMain             Boolean  @default(false)     // exactly one main place when any exist; drives the primary Book button
  sortOrder          Int      @default(0)
  createdAt          DateTime @default(now())
  @@unique([profileId, therapistProfileId])
  @@index([tenantId])
}

model ProfileTemplate {                    // admin-editable content (§6.6)
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

Also add to `Tenant`:
- `onboardingIntent` (enum `PROFILE | PRACTICE`, default `PRACTICE`);
- `homePage` (enum `PROFILE | PRACTICE`, nullable; null = automatic, see §6.16) — what a solo practice shows at `/`.

Add to `ConsultTherapistProfile`: `allowProfileBooking Boolean @default(true)` — the practice's consent to appear as a place on this therapist's profile (§6.9).

**Places of practice:** the data already supports one person in several practices (a `Profile` + `ConsultTherapistProfile` per practice). `PractitionerPlace` exposes that on the profile. It replaces a single booking target, and must be in the first migration: changing it after launch would need a data migration. Rules:
- A place can only point at a `ConsultTherapistProfile` belonging to the same user, in an active practice.
- Exactly one place is `isMain` whenever any exist; removing the main place promotes the next by `sortOrder`.
- Each place keeps its own services, fees, availability, booking limit and `fullyBookedThisMonth` state.

Notes:
- `PractitionerProfile` is **global**, not tenant-scoped. Only the owning user (and platform admins) can read a draft or write. Add a dedicated access spec alongside `tenant-isolation.spec.ts`.
- Seed `TaxonomyTerm` with a starter list for Olalekan to review: ≈40 specialties, ≈15 modalities, populations, and languages incl. English, Yoruba, Igbo, Hausa, Nigerian Pidgin, French, Twi, Swahili. Population terms on sensitive identities go in only with Olalekan's approval.
- Back-fill on first profile creation from `ConsultTherapistProfile` (`tagline`→`headline`, `credentials`→`credentialsText`, `modalities`/`specialty`/`languages` → taxonomy matches, `yearsExperience` → `selfReportedYears`, `offersOnline/InPerson`). Keep the old fields; mark them deprecated in comments.
- **Photo back-fill:** existing therapist photos are base64 in `Profile.avatarUrl`. On first profile creation, decode, validate (image type, size), upload to R2 and set `photoKey`, so profiles start with a photo. `avatarUrl` is left unchanged.

### 6.2 Handles, slugs and reserved words

**Handle rules:** lowercase; 3–30 chars; `[a-z0-9-]`; no leading/trailing hyphen. Suggest one from the name. Changing a handle writes `PractitionerHandleHistory`; old handles 301 forever.

**Reserved handles** (handles sit at the root of `profiles.unclutterdesk.com`, so they mustn't collide with the site's own paths): everything in `reserved-slugs.ts`, plus `join`, `search`, `verification`, `specialty`, `language`, `in`, `online`, `terms`, `privacy`, `report`, `sitemap`, `sitemap.xml`, `robots.txt`, `assets`, `_astro`, `api`, `admin`, `directory`, `clinic`, `claim`, `remove`.

Also reserve every **marketing** path now, because the landing page and profiles will share `therapysts.com` (§4.1b), so they share one path space: `pricing`, `features`, `about`, `blog`, `help`, `support`, `contact`, `login`, `signin`, `signup`, `register`, `start`, `app`, `dashboard`, `careers`, `press`, `legal`, `security`, `status`, `docs`, `faq`, `for-clinics`, `for-therapists`, `enterprise`. Keep the list in one shared file so marketing pages and handles can't collide later.

**Reserved practice slugs:** add `profiles` and `directory` to `reserved-slugs.ts`. **Before adding them, query the database** for existing tenants with those slugs; if any exist, stop and report to Olalekan.

**Two namespaces at signup:** profile signup creates a handle (profile namespace) and a practice slug (tenant namespace). When the therapist picks a handle:
- check both namespaces live;
- if the handle is free but the slug is taken, create the practice with a short suffix (`{handle}-2`, `-3`…) inside the same transaction, so signup never fails on a slug collision;
- when the therapist later switches booking on (§6.9), show the booking address and let them **rename the slug** (availability-checked), since the slug then becomes their client-facing booking URL.

### 6.3 Friendly URL & link previews

- `profilePath(handle)` → `https://profiles.unclutterdesk.com/{handle}`.
- **Preview (Open Graph) images are generated on save, never on request.** On publish, and on any change to photo, name, kind, headline or theme, enqueue a `BackgroundJob` that renders the image in the **API** (Node, e.g. satori + resvg; no Worker size limit), uploads it to R2, and sets `previewImageKey`. The page's `og:image` points at the R2 URL. A profile shared widely on WhatsApp never touches the API.
- Until the first image exists, fall back to a static default image per theme stored in R2.

### 6.4 Profile structure

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
| 8 | **Experience** — years, sessions/hours (D12) | — |
| 9 | **Where I practise / sessions & fees** — in DESK mode, one block per `PractitionerPlace` (practice name, online/in-person, locations, fees from that practice's services, its own Book button and "fully booked" state), main place first; otherwise `feeRangeText` | — |
| 10 | **Book / contact** — primary Book button (main place, or external link); optional public email and social links | — |

Requirements are light so a therapist can publish quickly; the completeness score (§6.7) encourages the rest. When `supervisedBy` is set, the page shows "Practising under supervision".

### 6.5 Themes

- 4–5 presets in v2, defined as token sets (colours, fonts, header layout, photo shape): e.g. `calm` (default), `warm`, `clinical`, `earth`, `night`. All themes on all plans.
- Picker in the editor with live preview. Themes change appearance only, never content or section order.
- All themes pass WCAG 2.1 AA contrast; a test checks each theme's text/background pairs.
- Fonts self-hosted (CSP `font-src 'self'`).

### 6.6 Templates

Templates help therapists know what to write: **prompts and example wording per section**, plus suggested specialties and modalities.

- Seed templates (drafted by Claude Code, reviewed and edited by Olalekan in admin before launch):
  - Counsellor in private practice
  - Trainee counsellor under supervision
  - Clinical psychologist
  - Faith-integrated counsellor
  - Child & adolescent specialist
  - Couples & family therapist
  - Workplace / corporate wellbeing practitioner
- Choosing a template (at signup or later) shows its prompts beside each section and offers "Use this example as a starting point", which inserts the example text for the therapist to rewrite.
- Inserted example text is tracked; publishing warns if it's unchanged ("This section still has template text — make it yours?"). Warning only.
- Templates live in `ProfileTemplate` and are edited in admin, not in code.

### 6.7 Completeness score & guidance

- Server computes `completenessScore` on save: Identity 20, About 15, Qualifications & training 15, Specialties 10, Approach 10, Languages 5, Experience 10, Sessions & fees 10, Book/contact 5.
- Editor shows the score, the next most useful thing to add, and short guidance per section. Guidance text is editable content, not hard-coded.
- **Writing tips** (rule-based, warnings only, never blocking):
  - Outcome claims ("success rate", "% of clients", "guaranteed", "cure") → suggest describing approach and experience instead.
  - Superlatives ("best", "No. 1") → suggest specific, factual wording.
  - Identifiable client details → strong warning to remove them, for client confidentiality.
  - Phone numbers in free text → suggest the contact fields or booking instead.

### 6.8 Profile-first signup (inside Desk)

- Entry points: `profiles.unclutterdesk.com/join` ("Create your free therapist profile") and a link from the Desk landing page. Both send the therapist to `app.unclutterdesk.com/signup?intent=profile`.
- Signup asks for name, email, password, handle (§6.2), kind, and template (optional). It creates in **one transaction**: `User`, `Tenant` (FREE, slug per §6.2, `onboardingIntent = PROFILE`), `Profile` (OWNER), `ConsultTherapistProfile`, `PractitionerProfile` (DRAFT).
- **Email verification uses Desk's existing 6-digit code step** (`/verify-email`); after the code is entered, the therapist lands in the profile editor. No change to Desk's sign-in rules.
- **Profile-first dashboard** (`onboardingIntent = PROFILE`):
  - Home shows the profile editor, completeness, share and stats.
  - Desk's practice features (clients, sessions, services, availability) sit under a clear "Set up booking" entry, visible but not pushed.
  - Skip the full practice onboarding wizard.
- After publishing, a dismissible card: "Want clients to book you here? Switch on booking — intake, reminders and payments are already set up."
- Existing Desk practitioners see "Create your therapist profile" in the dashboard; no new tenant is created.

What a profile-first therapist's practice address shows at `/` is covered by the solo-practice rule (§6.16); there's no separate redirect.

### 6.9 Booking modes

| Mode | Public page shows | Set-up |
|---|---|---|
| `NONE` | No Book button; optional public email/social links | — |
| `DESK` | **"Book a session"** → main place's Desk booking flow (§7.1); "Where I practise" lists every place with its own Book button | Guided set-up for the therapist's own practice: confirm or rename the booking address (slug, §6.2); add a service and fee; set weekly availability; set up payment — **Paystack subaccount** on all plans, **bank transfer** from Starter up (§5.3). Reuses existing Desk screens. Places in other practices (e.g. a clinic) are added from a list of the user's own active therapist memberships |
| `EXTERNAL` | **"Book a session"** → `externalBookingUrl` (new tab, `rel="noopener nofollow"`) | Enter an https URL (validated) |

- In the editor, `DESK` is presented first, with a short line on what it includes (intake and consent forms, reminders, payments, notes). `EXTERNAL` is available without friction.
- Once a service and availability exist, switching to `DESK` sets `Tenant.onboardingIntent = PRACTICE`, so the dashboard shows the full practice view.
- Adding a place sets that `ConsultTherapistProfile.publicUsername` to the profile handle if it's empty (it's optional today), so the deep link in §7.1 always resolves.
- **Per-place consent:** a practice OWNER/ADMIN can turn off their practice as a place on a therapist's profile (`ConsultTherapistProfile.allowProfileBooking = false`). That place then shows "Not taking online bookings here right now"; the practice cannot edit or hide the therapist's profile.
- `DESK` mode with no remaining places falls back to `NONE`.

### 6.10 Share kit

`/dashboard/profile/share`:
- **Link:** copy button, one-tap WhatsApp share with a suggested message, Instagram-bio tip.
- **QR code:** SVG/PNG download for flyers, business cards, slides.
- **Profile PDF** ("professional one-pager"), server-side with `pdfkit`, using the profile's theme: photo, name, kind, headline, qualifications, specialties, languages, link + QR. Gated by **profile entitlements** (`downloadablePdf`); without it the therapist sees a locked preview and an upgrade prompt.
- **Email signature:** HTML snippet with name, kind and link (generated with escaped values).

### 6.11 Public profile page (`apps/profiles`)

`/{handle}` on `profiles.unclutterdesk.com`:
- Renders §6.4 sections in the chosen theme, **as plain text** (§4.3). Primary CTA per booking mode; secondary "Share".
- Footer: "Create your free therapist profile" (signup with `?ref=profile&handle=`), "Report this profile", terms.
- `noindex` while `status ≠ PUBLISHED`; `410` for SUSPENDED; 301 for old handles; 404 otherwise.
- JSON-LD `Person` (name, jobTitle from kind, knowsLanguage, locality/country, image), serialised safely. No reviews or ratings.
- `/` shows a short page inviting therapists to create a profile (becomes the directory in Phase 4).
- WCAG 2.1 AA; alt text required on photo upload; works at 320 px width.

Public API (no auth, no credentials, cached):

```
GET  /v1/profiles/:handle        → public profile DTO (published only; redirect info for old handles; fullyBookedThisMonth)
GET  /v1/profiles/sitemap        → published handles + updatedAt
POST /v1/profiles/:handle/report → report (rate-limited, honeypot)
POST /v1/profiles/:handle/event  → stats beacon (Phase 2)
```

Public DTOs are **explicit allow-lists**; never serialise Prisma models. Never expose: account email, phone, userId, tenant internals, exact experience counts, R2 keys for private objects.

### 6.12 Freshness

On publish/update/unpublish/handle change/takedown/booking-mode change: enqueue a `BackgroundJob` to purge the profile URL at the edge (and regenerate the preview image where §6.3 applies). Failures are retried with backoff and logged, never swallowed (don't repeat the Google Calendar `.catch(() => undefined)` pattern). Changes visible within 1 minute.

### 6.13 Experience figures (D12)

- **Fix BKG-13 first.** Add booking outcome states (`COMPLETED`, `NO_SHOW`, `CANCELLED_LATE`). A daily cron moves past confirmed sessions to `COMPLETED` unless marked otherwise within 72 h; practitioners can correct it.
- `sessionsCompleted` = `COMPLETED` bookings across the practitioner's therapist profiles. `hoursLogged` = sum of `PractitionerHoursEntry`.
- Shown only when `showPlatformExperience = true`, as ranges: `<50`, `50–100`, `100–250`, `250–500`, `500–1,000`, `1,000+`, labelled "recorded on Unclutter Desk". Self-reported figures are labelled "self-reported".

### 6.14 Leaving a practice (D7)

- **Triggers:** there's no single "deactivated" event in the code, only separate paths. Route every one of them through one `onMembershipEnded(profileId)` handler:
  1. the therapist status toggle (set to inactive);
  2. removing a staff member;
  3. a downgrade pausing staff (§5.4a);
  4. a platform admin setting `Tenant.isActive = false` (applies to every therapist in that practice, including the owner);
  5. a practice closure (`closureRequestedAt` / the closure flow; applies to everyone in the practice).

  Add a test for each path. Profile entitlements also ignore inactive and closed practices (§5.1).
- On each trigger:
  - **remove just that practice's `PractitionerPlace`**; if it was the main place, promote the next one;
  - if no places remain, set `bookingMode = NONE`;
  - enqueue a purge (§6.12), so a printed QR code still lands on a working profile;
  - recompute the solo status of the practice it left (§6.16);
  - email the therapist: "Your profile no longer books through {practice}." If they now have no places, add "Set up your own booking in one step", which creates a FREE practice for them (same flow as §6.8, minus the profile).
- If the membership is later reactivated (e.g. the practice resubscribes), the place is **not** re-added automatically; the therapist is emailed that they can add that practice back.
- Profile entitlements are recomputed (§5.1); if PDF access is lost, previously downloaded PDFs are unaffected but new downloads are locked.

### 6.16 Solo practices: one page, two addresses

For a solo therapist, the person and the practice are the same thing to a client. Their practice address (`name.unclutterdesk.com`, or their custom domain on Pro) and their profile address (`profilePath(handle)`) show **the same page, from one renderer**.

**Definition of solo:** the practice has exactly **one active therapist membership** (role OWNER or THERAPIST with a `ConsultTherapistProfile`), and it is the owner. ADMIN and RECEPTIONIST staff **don't** make a practice non-solo. (The existing staff-count code treats all non-owner roles alike; solo detection must not reuse it.)

**What `/` shows on a practice address** (`Tenant.homePage`):

| Situation | `/` shows |
|---|---|
| Solo, owner's profile PUBLISHED, `homePage` null (automatic), **no published client reviews** | The owner's profile |
| Solo, profile published, practice **currently shows published reviews**, `homePage` null | The practice page, as today. Dashboard prompt: "Show your therapist profile here instead? Your profile doesn't show client reviews (D13), so they'd no longer appear on this page." The therapist chooses; choosing sets `homePage = PROFILE` |
| `homePage = PRACTICE` (opt-out) | The practice page, always |
| `homePage = PROFILE` | The owner's profile, while the practice is solo and the profile is published |
| Not solo (clinic), or profile not published | The practice page. A clinic's page lists its therapists, each linking to their profile |

When a second therapist becomes active, `/` switches to the practice page automatically; when the practice drops back to one, it switches back (unless `homePage = PRACTICE`). Profile-first practices (§6.8) follow the same rules; there is no separate redirect.

**Everything except `/` is unchanged on the practice address:** `/book`, client login, `/session/:id`, `/set-password`, `/assessment/:token`, pay links, review forms.

**How it's served (one renderer):**
- `GET /v1/tenant/public/exists/:slugOrDomain` (already called by `tenant-router`) adds `homePage: 'PROFILE' | 'PRACTICE'` (the resolved result of the table above) and `profileHandle`.
- When it's `PROFILE`, `tenant-router` serves `/` by calling the **profiles Worker through a service binding** (not over the public internet), requesting the owner's profile page.
- On the way in, **strip `Cookie` and `Authorization`**. On the way out, **never pass `Set-Cookie`** back to the visitor. Cache the response with a cookie-free key. All §4.3 rules (plain text, CSP) apply, since it's the same page.
- **Links must work from both addresses.** The proxied page is served on the practice host, so relative URLs would resolve against it:
  - asset URLs (`/_astro/...`), fonts and the preview image are **absolute URLs on the profiles origin**, and the CSP allows that origin;
  - site links ("Report", "Join", "Terms", "Create your free profile") point to the profiles origin;
  - **the Book button is the exception:** on the practice address it goes to the same host's `/book` (with `?therapist=`); on the profiles address it goes to the main place (§7.1).

  The profiles app receives the serving context (practice host or profiles host) from the router via a header set only on the service binding, never from the client.
- **Search:** `<link rel="canonical">` always points to `profilePath(handle)`. Practice subdomains keep `noindex`, so Google lists the profile address once.
- **Custom domains are not redirected.** A Pro therapist paying for `chente.com` keeps clients on `chente.com`; the page is served there with the canonical tag. **Check first** that custom-domain traffic (Cloudflare for SaaS) passes through `tenant-router`; if it doesn't, report before building.
- **Freshness:** when solo status changes (a therapist activated or deactivated), `homePage` changes, or the profile is published/unpublished, enqueue a `BackgroundJob` that clears the router's `exists` cache entry and the cached `/` page for that practice host (and its custom domain). The `exists` lookup is cached for ~60 s at most.

### 6.15 Terms, reports & takedown (D11)

- Terms of use (new section in `terms.astro`): profile content is the practitioner's responsibility; impersonation and misleading content are not allowed; the platform may remove profiles that break the terms.
- "Report this profile" (impersonation, misleading content, unsafe content, other) → `PlatformRequest` with `type = PROFILE_REPORT` and the handle; appears in admin.
- Admin can hide or suspend a profile with a reason, written to `AdminAuditLog`; the practitioner is notified by email.

**Phase 1 acceptance**
- [ ] A new therapist signs up (including the 6-digit code), picks a template and theme, and publishes a profile in under 10 minutes (manual test script)
- [ ] Handle/slug checks across both namespaces; slug suffix on collision; slug rename when switching booking on; `profiles` and `directory` reserved after a DB check
- [ ] Profile-first dashboard mode works; switching on Desk booking moves the tenant to the full practice view
- [ ] Solo practices (§6.16): `/` serves the owner's published profile through the service binding, on subdomains and custom domains; practices with published reviews keep their page and get the prompt; opt-out works; clinics keep the practice page; switching on second-therapist activation and back; admin/receptionist staff don't affect solo status; all other paths unchanged
- [ ] Proxied page: cookies and `Authorization` stripped, no `Set-Cookie` passed back, assets and site links absolute on the profiles origin, Book button goes to the same host's `/book`, canonical points to the profile address
- [ ] All three booking modes work; several places per profile with one main; per-place consent; Free offers Paystack only; external URL validated
- [ ] Templates and guidance editable in admin; unchanged-template-text warning works
- [ ] Themes pass contrast tests; preview images generated on save into R2 and served from R2
- [ ] Security (§4.3): cache ignores cookies; renderer never reads them; credentialed requests from the profiles origin are rejected; CSP present; script/HTML payloads render inert
- [ ] Leaving a practice removes only that place (via every exit path), promotes a new main place, falls back to NONE when none remain, and purges the page
- [ ] Share link, QR and PDF use `profilePath()`; PDF gated by profile entitlements
- [ ] Report → admin → takedown works end to end and is audited; terms updated
- [ ] Public page SSR, readable without JS, Lighthouse accessibility ≥ 95

---

## 7. Phase 2 — Desk booking from profile & profile stats

**Builds on:** Phase 1, the public booking flow (`pages/public/booking/useBookingData.ts`), `GET /v1/consult/public/services|availability`.

### 7.1 Book from profile (DESK mode)

- Each place's Book button deep-links to **that place's practice**: `https://{tenant.slug}.unclutterdesk.com/book?therapist={publicUsername}&src=profile` — or the tenant's ACTIVE `customDomain` if set. The primary Book button uses the main place. `publicUsername` is guaranteed non-empty for every place (§6.9). On a solo practice's own address, the Book button goes to the same host's `/book` (§6.16).
- The booking wizard has **no therapist step** (service → time → details → pay). The `therapist` param instead **filters what the wizard shows**: only services that therapist offers, and only that therapist's available times. On a solo practice it changes nothing visible. Unknown or inactive therapist → ignore the param silently.
- Attribution: carry `src` into a new nullable `ConsultBooking.source` column.
- Each place's Book button shows "Not taking online bookings here right now" (no broken link) when that practice is inactive, its `fullyBookedThisMonth` is true, or its `allowProfileBooking = false`. Other places are unaffected; if the main place is unavailable, the primary button offers the next available place.
- Browsing and starting a booking need no login; the client account is created inside the flow, as today.

### 7.2 Profile stats (privacy-safe)

- `ProfileStatDaily` (profileId, date, views, bookClicks, shares), incremented through the beacon endpoint.
- **No cookies, no visitor identifiers stored.** IP is used only in memory for de-duplication and never written.
- The beacon runs in JavaScript, so visitors without JavaScript aren't counted. That's accepted.
- Dashboard **Stats** card: views, Book clicks, bookings from the profile (DESK mode, via `ConsultBooking.source`), last 30 days.
- Optional monthly "your profile this month" email (opt-out).

### 7.3 Free-payment review (D8)

- Track per Free practice: booking switched on (date), Paystack subaccount set-up started, completed.
- Admin insight: "Free profiles that switched booking on" and "% that completed Paystack set-up".
- When there are 50 Free profiles or 60 days have passed since Phase 2 shipped (whichever comes first), show a dashboard flag to platform admins with the figure. If fewer than half completed set-up, Olalekan decides whether to open bank transfer on Free; the change is a one-line entitlement edit.

**Phase 2 acceptance**
- [ ] `?therapist=` filters services and times on a Clinic; no visible change on a solo practice; `source` recorded on bookings
- [ ] Fallback text replaces the button in every unavailable case
- [ ] Stats count views and clicks without storing personal data (test asserts no IP/UA written)
- [ ] Free-payment review metric and admin flag in place

---

## 8. Phase 3 — Verification (optional badge)

Therapists can publish and share without verification. Verification adds a badge for those who want it.

**Builds on:** Phases 1–2, admin panel, platform admin guard, R2 private bucket (§4.4), the field-encryption helper used for clinical notes, `AdminAuditLog`.

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
  documentKey      String?          // private R2 key
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
- Documents go in the **private** R2 bucket: short-lived signed URLs, admin-only, every access written to `AdminAuditLog`. Max 10 MB; PDF/JPG/PNG.

### 8.2 Flow

1. In `/dashboard/profile/verification`, the practitioner adds a credential and uploads proof → `SUBMITTED`.
2. Admin queue `/admin/profiles/verification`: oldest first; profile, body, register link, document viewer, checklist (name matches, body matches, number checked on the register where possible, not expired).
3. Admin → `VERIFIED` (sets `verifiedAt`, enqueues purge) or `REJECTED` with a note; practitioner notified by email + in-app.
4. Daily expiry cron: past `expiresAt` → `EXPIRED`; the badge drops if no other verified credential remains; reminders 30 and 7 days before expiry.
5. Admin can `REVOKE` with a reason.

### 8.3 Display

- Badge on the profile and share PDF: "Verified · {body short name} · checked {month year}", linking to `/verification` (short explainer page).
- Unverified profiles show **no label**; the absence of a badge is the only difference (D11).
- Add **Verification** (10 points) to the completeness score; rescale the other weights proportionally.

**Phase 3 acceptance**
- [ ] Submit, verify, reject with notes, expire with reminders, revoke
- [ ] Documents reachable only via signed URLs by admins; access audited; membership numbers encrypted
- [ ] Badge appears within 1 minute of verification; no label on unverified profiles

---

## 9. Phase 4 — Directory & search

A public place to find published profiles. Profiles remain the product; the directory is an extra way to reach them.

**Builds on:** Phases 1–3, `apps/profiles`, taxonomy, `ConsultServiceFormat` prices.

### 9.1 Pages (on `profiles.unclutterdesk.com`)

- `/` becomes the directory: free-text search, filters, results. Card: photo, name, kind, verified badge (if any), headline, primary specialties, languages, city/online, fee range, "accepting new clients". Keep a clear "Create your free profile" link for therapists.
- SEO landing pages for single-dimension filters with ≥ 3 claimed results: `/specialty/{key}`, `/language/{key}`, `/in/{country}/{city}`, `/online`. Multi-filter combinations use query params and are `noindex`.
- Empty state: suggest broadening filters, plus "Are you a therapist? Create your free profile".
- Practitioners can opt out of the directory (`PractitionerProfile.listedInDirectory`, default true) while keeping their shareable profile.
- **Clinic listings:** practices can be listed too, at `/clinic/{slug}` (using the existing practice slug). No new model: built from `Tenant` (name, logo, city, tagline) and its active therapists, each linked to their profile. Add `Tenant.listedInDirectory` (default false; opt-in by the practice OWNER). Clinic listings are a discovery page, not a second website: the main CTA goes to the practice address. Directory cards for people show "Practises at {clinic}" from their places. Solo practices aren't listed separately; their owner's profile already represents them.

### 9.2 Search

- Postgres only (no new infra): a denormalised `DirectoryEntry` table refreshed on profile change, with `tsvector` over name, headline, about, taxonomy labels; GIN index; `pg_trgm` trigram index on name. **Check first** that the VPS Postgres role can run `CREATE EXTENSION pg_trgm`; if not, report before building.
- Filters: specialty, modality, language, population (multi); kind; country; city; online/in-person; fee range (from min `ConsultServiceFormat.priceKobo` in DESK mode, or `feeRangeText` parsed into a range); verified only; accepting new clients; gender (add optional self-declared `genderPublic`; filter matches only profiles that set it).
- Ranking per D15, then text relevance; a daily-rotating seed breaks ties so the same people don't always sit first.
- Cursor pagination, 20 per page.

### 9.3 API (no auth, cached)

```
GET  /v1/directory/profiles?q=&specialty=&modality=&language=&population=&kind=&country=&city=&online=&inPerson=&feeMin=&feeMax=&verified=&accepting=&cursor=
GET  /v1/directory/taxonomy      → active terms by kind
GET  /v1/directory/facets?...    → counts per filter value for the current query
```

- Reuse the public profile DTO allow-list from §6.11. All §4.3 rules apply.
- Bookings that start from the directory carry `src=directory` into `ConsultBooking.source`.

**Phase 4 acceptance**
- [ ] Search with all filters, facets and cursor pagination
- [ ] SEO landing pages, sitemap, robots, canonical tags; practice subdomains still `noindex`
- [ ] Clinic listings at `/clinic/{slug}` for opted-in practices, linking to therapists' profiles and the practice address
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
- Handle auto-generated (`firstname-lastname`, de-duplicated, reserved list applies); status PUBLISHED; `claimState = UNCLAIMED`.
- CSV bulk import with the same field allow-list and a required `sourceUrl` per row; rows with disallowed fields are rejected. Names on `DoNotRelist` are rejected.

### 10.3 Display

- Label at the top: "This profile hasn't been claimed. Information comes from public sources."
- **No Book button and no contact details.** Instead: "Is this you? Claim this profile" and "See therapists near you" (prefiltered by specialty and city).
- `noindex` and excluded from the sitemap, so the platform doesn't rank for people's names without their consent. Unclaimed listings appear in directory search, ranked after claimed profiles (D15).
- Visible "Remove this listing" link.

### 10.4 Removal (no account needed)

- `POST /v1/directory/removal-requests` with handle, requester name, email and relationship ("this is me" / "acting for them"). Rate-limited + honeypot.
- The listing is **hidden immediately**, pending admin review; admin confirms deletion within 7 days and adds the name to `DoNotRelist`.
- Claimed profiles can't be removed this way; such requests become reports (§6.15).

### 10.5 Claiming

1. "Claim this profile" → signup with `intent=claim&handle=…` (same one-transaction setup and 6-digit code step as §6.8, except the claim attaches to the existing listing instead of creating a new profile).
2. The claimant submits at least one credential with proof (§8); the name must match the listing.
3. Admin reviews claim and credential together. Approved → `userId` set, `claimState = CLAIMED`, credential `VERIFIED`, listing opens in the claimant's editor as a draft to complete and publish. Rejected → note to claimant; listing unchanged.
4. One PENDING claim per profile at a time; further claimants are queued and the admin sees all of them.
5. When a therapist signs up normally and an unclaimed listing with a matching name exists, the dashboard asks "Is this you?" and offers to claim it, to avoid duplicates.

**Phase 5 acceptance**
- [ ] Admin create + CSV import enforce the field allow-list, required `sourceUrl` and `DoNotRelist`
- [ ] Unclaimed listings: label, no Book button or contact details, `noindex`, excluded from sitemap
- [ ] Removal request hides instantly; admin confirmation adds to `DoNotRelist`
- [ ] Claim flow end to end; duplicate detection prompts "Is this you?"

---

## 11. Later — designed for, not built in v2

- **Profile builder:** drag-and-drop sections and custom blocks beyond themes and templates. Must keep the plain-text rendering rule (§4.3) or introduce a vetted, allow-listed block format.
- **Per-practice timezones:** add a timezone to `Tenant` once there are practices outside West Africa time; until then booking limits use Africa/Lagos (§5.5).
- **Referrals** between practitioners.

Design implications: keep public DTOs allow-listed and taxonomy controlled (not free text), so new surfaces can reuse them.

---

## 12. Admin (`/admin/profiles`)

- **Profiles:** search, view, hide/suspend/restore with reason
- **Reports:** `PROFILE_REPORT` queue
- **Templates:** create/edit `ProfileTemplate` content
- **Taxonomy:** add/rename/deactivate terms (renames keep `key`)
- **Guidance text:** edit section guidance and writing tips
- **Complimentary plans:** view and set `complimentaryReason` / `complimentaryUntil`
- **Free-payment review** (Phase 2, §7.3)
- **Verification queue** and **professional bodies** (Phase 3)
- **Directory insights** (Phase 4): searches with zero results, most-searched specialties and languages
- **Unclaimed listings, claims queue, removal requests, do-not-relist** (Phase 5)
- **Insights:** profiles created/published, booking mode split (NONE/DESK/EXTERNAL), FREE → Starter conversions, claim conversion
- Every admin action writes to `AdminAuditLog` (§4.4).

---

## 13. Cross-cutting requirements

**Security**
- §4.3 rules apply to every response from `apps/profiles`, in every phase.
- Security codes and tokens use `crypto` (never `Math.random()`).

**Privacy (NDPA)**
- Public DTO allow-lists; snapshot tests.
- Practitioners can export profile data and delete their profile (→ HIDDEN immediately, purged after 30 days, including R2 objects; handle reserved 90 days to prevent impersonation).
- Update the privacy policy: public profile data, profile stats, report handling, R2 as a processor; then, as each phase lands, verification document processing (Phase 3), the directory (Phase 4), and unclaimed listings with how to remove one (Phase 5).
- Unclaimed listings follow §10 without exception; `sourceUrls` is the record of where public information came from.
- Known risk to note in the v2 release notes (not v2 scope): intake answers, assessment answers and session summaries are stored as plaintext today.

**Operational limits**
- Single pm2 process, in-memory throttler, in-process crons. Profile pages and preview images are served from the edge and R2, so shared links don't reach the API. Slow work (preview images, purges) runs through `BackgroundJob`, off the request path. Don't add high-frequency crons. Flag in the PR if anything would need Redis or a queue.

**Notifications** (existing `NotificationDispatch` + Resend)
- Profile published; handle changed; profile reported (admin); profile hidden/suspended (practitioner); left-a-practice booking switch-off (practitioner); monthly profile summary (opt-out).
- Plans: migration Starter period granted (owner); complimentary period ending in 14 and 3 days (owner); payment failed, grace ending, downgrade notice with exact date, moved to Free (owner); paused by downgrade and reactivated (staff).
- Phase 3: credential submitted (admin), verified/rejected/expiring (practitioner). Phase 5: claim approved/rejected (claimant), removal request received (admin).

**Copy & tone**
- Calm, professional, plain. All profile-brand references go through `ProfileConfig.brandName`.

**Testing**
- Unit: both entitlement scopes, `effectiveTier` fallbacks, booking-limit counting, verification code generation, writing tips, completeness scoring, handle/slug rules, experience buckets, URL validation, theme contrast.
- Integration: publish → preview image → purge; places of practice (add, main, remove, consent); solo-status changes switch `/` and purge the router cache; reviews prompt; proxied page strips cookies and never returns `Set-Cookie`; booking mode switches; leaving a practice; FREE-limit behaviour, staff today/past vs future entries, and `fullyBookedThisMonth`; migration, reminders and complimentary expiry; lapse timeline with pause and selective reactivation; downgrade webhooks incl. missing renewal date; report → takedown → audit.
- Copy: trial-phrase test over `apps/landing` and `apps/app`.
- Security: cookie-free cache key; renderer ignores cookies; credentialed request from the profiles origin rejected; public endpoints answer the profiles origin without `Allow-Credentials`; CSP header present; HTML/script payloads inert.
- Leaving a practice: one test per exit path in §6.14.
- E2E (Playwright; add minimal setup if absent): profile signup → 6-digit code → template → publish → share link opens profile → switch on Desk booking → book (Paystack test mode).
- Access: owner-only profile writes; public DTO snapshot.
- Phases 3–5: verification lifecycle; directory filters and ranking; unclaimed-listing field allow-list; removal hides instantly; claim lifecycle end to end.

---

## 14. Delivery order & ownership

| Order | Phase | Builder | Olalekan's input |
|---|---|---|---|
| 0 | **Regenerate the baseline** from `main` | Claude Code | — |
| 1 | **0 Foundations** — *built*; finish the §5.7 follow-ups (merge blockers first), then merge; run `set-internal-tenant` right after deploy | Claude Code | Supply his own practice's tenant ID and tier for the INTERNAL flag |
| 2 | **1 Therapist profile** — all domains configurable (§4.1a), R2, job table, audit log, places of practice, solo-practice home page, structure, templates, themes, profile-first signup, handles/slugs, booking modes, security rules, share kit, public page, leaving a practice, reports | Claude Code | Review taxonomy list; edit template content and guidance; approve themes |
| 3 | **2 Desk booking from profile, stats & Free-payment review** | Claude Code | Invite first therapists to create profiles; make the D8 call when flagged |
| 4 | **3 Verification** (optional badge) | Claude Code | Enter CASSON, NAPC, ANEPCO details; act as first reviewer |
| 5 | **4 Directory & search** | Claude Code | Approve directory design; decide when there are enough profiles to launch it |
| 6 | **5 Unclaimed listings & claiming** | Claude Code | Add the first unclaimed listings; review claims |
| — | **Domain move** to therapysts.com / therapysts.app (§4.1b) — after Phase 1's config work, **before public launch** | Claude Code | Buy both domains; trademark checks on "Therapysts"; approve the cut-over date |

Phases 0–2 are the core and ship first. Phases 3–5 follow in order. Each phase ends with green CI, updated `LAUNCH_FEATURE_MATRIX.md`, and a short PR summary listing anything that differed from this spec.

---

## 15. Definition of done for v2

- A therapist can sign up free, verify their email with the 6-digit code, pick a template and theme, publish a clear profile at `profiles.unclutterdesk.com/{handle}`, and share it as a link, QR code, WhatsApp message and (on Starter and above) a PDF.
- A client opening the link sees a professional profile without logging in and can book through Desk, an external link, or contact details, depending on what the therapist chose.
- A profile-first therapist finds Desk's booking, payments and notes ready when they switch booking on.
- Plans run from one entitlements module with practice and profile scopes: free profile (10 bookings, 5%, Paystack only) → Starter (30, 0%, transfer allowed) → Pro; no trial promise remains; existing practices kept Starter for 90 days.
- The profiles site is cookie-blind, untrusted by the API, and renders therapist text as plain text.
- Therapists who want it can add a verified badge; nobody needs one to publish.
- Clients can search published profiles by specialty, language, location and format.
- Unclaimed listings follow the rules in §10, and the people they describe can claim or remove them.
- Moving profiles to a new domain later needs config, DNS and redirects — no code changes.
