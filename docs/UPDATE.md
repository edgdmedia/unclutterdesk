# Task: Run the founder's practice as a tenant on Unclutter Desk, bridged to the Unclutter Suite

## Context

Two fully separate codebases and deployments:

- **Unclutter Desk** (standalone repo). Multi-tenant practice-management SaaS for independent therapists. It shares no code, auth, or database with the Unclutter Suite. Domains: `unclutterdesk.com` (marketing), `app.unclutterdesk.com` (therapist and admin app), `{slug}.unclutterdesk.com` (client booking), plus verified custom domains per tenant.
- **Unclutter Suite** (monorepo). Journal, the other consumer apps, and the Unclutter API at `api.unclutter.com.ng`. It also contains Unclutter Consult, the founder's practice app at `consult.unclutter.com.ng`.

Neither product is in production. There is no real user data anywhere, so **no data migration is needed**.

## Goal

Stop maintaining two practice-management products. **Desk is the only practice-management codebase.** The founder's own practice runs as a normal tenant on Desk. Consult is retired.

Desk and the Suite remain **separate systems**, with separate databases, auth, and user pools. They connect only through the narrow, consent-based bridge below.

## Decisions already made (do not re-litigate; flag if something makes one impossible)

1. **The founder's practice is a normal Desk tenant.** It uses the same schema, flows, and dashboard (`app.unclutterdesk.com/dashboard`) as every other tenant, with no special-case code paths.
2. **Per-tenant capability flag `ecosystemIntegrationEnabled`.** It defaults to `false` for all tenants, is `true` only for the founder's tenant, and can be set only by platform admin. Every ecosystem behavior below must be gated on it.
3. **Custom domain.** The founder's tenant serves its client booking pages on `consult.unclutter.com.ng`.
4. **Journal → booking.** Journal's "Book a session" entry point links **only** to the founder's tenant. Journal never lists, searches, or links to any other Desk tenant. There is no directory or marketplace.
5. **Post-session → Suite invite.** For flagged tenants only, after the client views their first session summary, show a one-time, soft invitation to create or link an Unclutter account (Journal, mood tracker, resources). It is not a redirect or an ad, and dismissing it must be easy and permanent.
6. **Accounts are federated and opt-in, never merged.**
   - By default, a Desk client exists only inside its tenant.
   - A link to an Unclutter account is created **only** on explicit client consent. Store it on the Desk side, e.g. `ClientExternalLink { clientId, tenantId, unclutterUserId, consentedAt, consentVersion }`.
   - **No clinical data crosses the bridge.** Notes, intake answers, assessment scores, and consent forms stay in Desk. Only what's needed to create or link an account (name and email) is passed, inside a signed, short-lived, single-use token.
   - A Journal user arriving to book may have their name and email pre-filled, but **the full intake and consent flow always runs.** Consent to Journal does not count as consent to therapy.
   - Journal/mood data flowing to the therapist is **out of scope**. If it's ever built, it needs its own separate, explicit consent.
7. **Separate trust boundaries.** Desk and the Unclutter API use different signing keys. A token issued by one system must never be accepted as a session token by the other. Bridge tokens are a distinct token type with their own key, audience, and expiry.
8. **Email sender matches the client-facing domain.** Desk supports a per-tenant sending domain. The founder's tenant sends from an `@unclutter.com.ng` address, and default tenants send from `@unclutterdesk.com`.

## Phase 0 — Audit, then STOP and report (no code changes)

Write `docs/FOUNDER_TENANT_AUDIT.md` in the Desk repo:

1. **Feature coverage.** Compare Consult's feature set with Desk's. List anything the founder's practice needs that was dropped when Desk was mirrored from Consult. **Check the hours log specifically** (hours per session, manual entries, running total, PDF export), because the founder needs it for a counselling diploma's required client hours. If Desk dropped it, say whether it should return as a general feature, since trainee therapists are a plausible Desk segment.
2. **Tenant isolation.** Confirm that every client-data query is scoped by `tenantId` at the data layer, not only in route guards. List any unscoped queries.
3. **Custom domains.** Real, current status: CNAME verification, SSL provisioning, and Host → tenant resolution. State plainly whether it works end-to-end today.
4. **Email.** Can Desk send from a per-tenant domain today? If not, what's missing?
5. **DNS.** Where the `unclutter.com.ng` zone is hosted, and what that means for pointing `consult.unclutter.com.ng` at Desk.

**Stop after Phase 0 and wait for approval.**

## Phase 1 — Desk platform work (Desk repo)

1. Add the `ecosystemIntegrationEnabled` tenant flag and a platform-admin control for it.
2. Bring custom-domain support to verified, end-to-end working status if Phase 0 found gaps.
3. Add per-tenant sending domains, and document the SPF, DKIM, and DMARC records each one needs.
4. Restore any practice features Phase 0 found missing, such as the hours log, **as general features available to all tenants**, not founder-only code.
5. Fix any tenant-isolation gaps Phase 0 found.

## Phase 2 — The bridge (both repos)

**Desk side:**
- Booking entry that accepts an optional signed bridge token from Journal. If the token is valid, pre-fill name and email. The full intake and consent flow always runs regardless.
- Post-session invite component, rendered only when the tenant flag is on. It shows once after the first session summary and is permanently dismissible.
- When the client accepts the invite, issue a signed, short-lived, single-use bridge token and redirect to the Unclutter Suite's account create/link flow.
- An endpoint that receives link confirmation back from the Suite and writes the `ClientExternalLink` record.

**Suite side (monorepo):**
- A "Book a session" entry point in Journal that points to the founder's tenant booking page on `consult.unclutter.com.ng`. The target is configured, not hard-coded, and it supports exactly one tenant.
- For a logged-in Journal user, optionally attach a signed bridge token carrying name and email.
- An account create/link flow that accepts Desk's bridge token, lets the client create an account or sign in to an existing one, and then confirms the link back to Desk.

**Both sides:**
- Bridge tokens: dedicated signing key per direction, explicit audience, expiry of 15 minutes or less, single-use (track the token ID).
- Log every bridge event (token issued, redeemed, link created, invite dismissed) without logging clinical content.

## Phase 3 — Set up the founder's tenant and retire Consult

1. Create the founder's tenant on Desk, set `ecosystemIntegrationEnabled = true`, and configure `consult.unclutter.com.ng` as its custom domain and `@unclutter.com.ng` as its sending domain.
2. Point `consult.unclutter.com.ng` DNS at Desk only after the custom domain is verified working.
3. Freeze Consult in the monorepo: no new features. Remove it from active deployment once the tenant is live, and archive the code.

## Acceptance criteria

- The founder's tenant books, runs, and documents sessions entirely on Desk, served at `consult.unclutter.com.ng`.
- Booking emails for the founder's tenant come from `@unclutter.com.ng` and pass SPF, DKIM, and DMARC.
- A test tenant with the flag off shows **no** ecosystem invite, receives no Journal referrals, and has no bridge endpoints reachable for it.
- A Journal user can go Journal → book → intake and consent → session, with name and email pre-filled and consent still captured fresh.
- A client who accepts the post-session invite ends up with a linked Unclutter account. A client who declines has no presence in the Suite.
- No session notes, intake answers, assessment scores, or consent records exist anywhere in the Suite's database.
- A Desk session token is rejected by the Unclutter API, and an Unclutter token is rejected by Desk.
- Bridge tokens are rejected after expiry and after first use.

## Out of scope

- Journal/mood data flowing to therapists
- A therapist directory or marketplace
- Ecosystem integration for any tenant other than the founder's
- Any change to Desk's pricing, tiers, or design system
