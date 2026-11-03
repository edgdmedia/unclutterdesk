# Open topics: design, custom domains, clinic pages, domain sales

Raised 3 Nov 2026. Each topic ends with the decisions needed. Once decided, the answers move into the spec and this page is deleted.

## 1. Design of therapysts.com

Today's pages are functional wireframes. The brief for a proper design is in `docs/design/therapysts-com-design-brief.md`.

It can be done from this session: Claude Code can start a **Design** canvas (Claude Design) directly, with the brief as the prompt, and the result comes back as artboards to review. Design comes before Phase 1 sign-off, because the signup flow and share kit build on the profile page's look.

**Decided (Olalekan, 3 Nov):** the dashboard and therapysts.com must read as one platform. Profile designs split into layouts (structure) and colour palettes, chosen separately. Messaging: the dashboard is the product, the profile is the entry point. All of this is in the brief.

**Recommended:** extend the Unclutter Desk Design System into the Therapysts design system (shared foundations, a Product surface and a Public surface), rather than build a new one and redo the dashboard. **Waiting for Olalekan's go-ahead.**

**Spec changes when the design is approved:** §6.5 becomes layouts plus palettes; add `layoutKey` to `PractitionerProfile` (`themeKey` becomes the palette); the PDF and preview images take both.

## 2. Custom domains and clinic pages

### What already works or is specified

- **A solo therapist on Pro with a custom domain** (`drjane.com`): the custom domain is the practice address, and §6.16 already makes a solo practice's address show the owner's profile at `/`. So "my profile on my own domain" is covered once §6.16 is built; nothing new is needed.
- Custom domains use Cloudflare for SaaS (one CNAME, automatic certificate). The `/api` proxy (Phase 1 item 1) makes sign-in and booking work on them.

### Gaps

**a) A therapist without a practice plan (profile only) who wants a custom domain.** Today a custom domain belongs to a practice on Pro. Options:
1. Custom domain stays Pro only (simplest; a profile-only therapist upgrades).
2. A small paid add-on "custom domain for your profile", without the rest of Pro.

**b) A clinic that wants its therapists' profiles under its own name.** The request: `clinic.therapysts.com/therapist-name`. Options:

| Option | Address | Notes |
|---|---|---|
| **A. Team pages on the clinic's own practice address** (recommended) | `{clinic}.therapysts.app/team` and `/team/{handle}`, and the same on the clinic's custom domain | Reuses the §6.16 renderer and the proxied-page rules. Each page's canonical points to `therapysts.com/{handle}`, so search engines see one profile, not duplicates. Only therapists who list that clinic as a place appear, and each therapist can opt out. |
| B. Clinic page on the profiles site | `therapysts.com/{clinic-slug}` listing the team, linking to each `therapysts.com/{handle}` | Cheap: handles and practice slugs already share one namespace (Phase 1 acceptance), so no collisions. Good for the directory later. No nesting. |
| C. Clinic subdomains on the profiles domain | `{clinic}.therapysts.com/{handle}` | Needs a wildcard certificate and route on therapysts.com, and gives each clinic a third address beside its practice address and custom domain. Not recommended. |

A and B can both exist: A for the clinic's own site, B as its public listing on Therapysts.

**Decided (Olalekan, 3 Nov):** (b) both A and B, as recommended. A comes straight after §6.16 (it reuses it); B comes with the directory (Phase 4) or earlier if it's cheap.

**Decided (Olalekan, 3 Nov):** (a) option 1: a profile-only therapist upgrades to Pro for a custom domain; no add-on.

**Team pages:** only Clinic practices can have more than one therapist (`staffInviteRoles` includes `THERAPIST` on Clinic only), so team pages are Clinic-only in practice. Groups that don't run their practice on the dashboard, such as NGOs, university or church counselling units, workplace wellbeing (EAP) providers, training institutes listing trainees and supervisors, and associations, are a different feature: **organisation pages**, where therapists link themselves to an organisation. Proposed for Phase 4 with the directory; not decided.

## 3. Selling domains

What Cloudflare offers today (checked 3 Nov 2026):
- The **Registrar API** (beta since April 2026) can search, price-check and register domains from code. But it registers into **our** Cloudflare account, using the account's registrant contact. The therapist wouldn't own the domain in their own account, which causes trouble at transfer, renewal and if they leave.
- Cloudflare has announced a **registrar-as-a-service (reseller) platform** for website builders and hosting providers. I found no sign it's available yet.
- Cloudflare doesn't sell `.ng` or `.com.ng`, which many Nigerian therapists will want. Those come from NiRA-accredited registrars.

Options:
1. **Not now (recommended for Phase 1–2).** Keep "bring your own domain" with a guided setup: which registrars to use (including a `.ng` one), and a one-line CNAME instruction with a live check.
2. **Bundle a domain with an annual Pro plan** once Cloudflare's reseller platform opens, with the therapist as the registrant. Revisit when it launches.
3. **A separate reseller business** (e.g. under edgdmedia.com) through a registrar reseller programme (including a `.ng` registrar). That's a separate company decision: ICANN/NiRA obligations, support, billing and renewals. Therapysts would then link to it rather than build registration in.

**Decide:** 1 now, and whether to revisit 2 or 3 later.

## 4. Smaller changes

To be listed.
</content>
</invoke>
