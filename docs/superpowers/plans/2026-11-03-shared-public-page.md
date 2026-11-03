# One public page and one look (§6.5 custom colour, §6.16 solo page): Implementation Plan

**Decisions (3 Nov 2026):**
- Custom brand colour on Starter and up.
- Solo practices first; team practice pages after.
- Reviews only on the practice address.

## Spec Claude (renderer, router, API)

- [ ] **1. `brandTokens(hex)` in `packages/ui`:** palette tokens worked out from one colour with the AA contrast rules. The profiles renderer and the app import the same function. Tests cover a spread of colours.
- [ ] **2. Data:** `themeKey = 'custom'` plus `PractitionerProfile.brandColor`. The API validates the hex and checks the plan (Starter and up). The public profile response carries the resolved tokens.
- [ ] **3. Solo page served at the practice address:**
  - `exists` returns the resolved `homePage` and `profileHandle`.
  - `tenant-router` serves `/` from the profiles Worker through a service binding: cookies and Authorization stripped, no `Set-Cookie` passed back, a cookie-free cache key, the serving-context header set only by the router.
  - The renderer uses absolute asset and site links, and Book goes to the same host's `/book?therapist=`.
- [ ] **4. Reviews section** in the practice-host context only, from the practice's published reviews.
- [ ] **5. Freshness:** a `BackgroundJob` purges the router's `exists` cache and the cached `/` page when solo status, `homePage` or publish state changes.
- [ ] **6. Booking flow theming:** `/book` reads the practice's look (the owner's profile tokens for a solo practice, the practice brand otherwise) and applies `brandTokens`.

## opencode (after task 1 lands)

- [ ] **7. Editor:** a "Custom" swatch in AppearancePicker with a colour input, showing the adjusted colour when contrast changed it, and an upgrade tag below Starter.
- [ ] **8. Settings:** Practice profile → "Use my profile" also covers the look for solo practices. Team practices get the same palette and custom-colour picker for the practice brand.

## Check

- Lighthouse accessibility ≥ 95 on a solo practice page with a custom colour, on the subdomain and a custom domain.
- Reviews appear only there.
- Booking from the profile and from the practice page shows the same flow with the same look.
