# Design brief: therapysts.com

Use this as the prompt for Claude Design (or any designer). It describes what exists, what must not change, and what to design.

## Decisions this brief is built on (3 Nov 2026)

- **One platform, one design language.** The dashboard (`therapysts.app`, today `app.unclutterdesk.com`) is the product; therapysts.com is its public face. They must feel like the same place: same type, colour foundation, iconography, components and tone. The public side is more expressive and editorial; the dashboard is denser and calmer. Neither looks like a different company.
- **Extend the Unclutter Desk Design System into the Therapysts design system** rather than starting a new one. Same foundations, two surfaces: **Product** (the dashboard and admin) and **Public** (therapysts.com home, profile pages, booking pages). The dashboard then gets a rebrand pass, not a rewrite.
- **Profile designs come in two independent parts:** **layouts** (structure: header style, photo treatment and placement, section arrangement, typography pairing, density) and **colour palettes** (colour tokens only). A therapist picks one of each, so any palette works on any layout. Today's five "themes" (Calm, Warm, Clinical, Earth, Night) become palettes.
- **Messaging:** the product is the practice dashboard (bookings, clients, notes, payments, video). The free profile is the way in. The public site sells the profile to get therapists in, then shows clearly what the dashboard adds. Profile pages themselves don't sell anything to clients.

## The prompt

> Extend the attached **Unclutter Desk Design System** into the **Therapysts** design system, then design the public site **therapysts.com**. Therapysts is a practice-management platform for therapists, counsellors and psychologists, starting in Nigeria and growing across Africa. Its dashboard (the main product: bookings, clients, notes, payments, video sessions) already uses the Unclutter Desk Design System. therapysts.com is its public face: free, professional profile pages for therapists, which are how most therapists will first meet the product. The current public pages work but look like wireframes. Make them look like something a therapist is proud to share and a client trusts at first glance, and make the public site and the dashboard feel like one platform: same foundations, with the public side more expressive and the dashboard denser and calmer.
>
> **Messaging.** The real product is the dashboard; the free profile is the entry point. The home page leads with "a free, professional profile in minutes", then shows what the dashboard adds when the therapist is ready (online booking, client records, payments, video sessions). Keep that progression clear. Profile pages are for clients and never advertise the product beyond a small footer link.
>
> **Profile designs: layouts and colour palettes are separate.** Design **3–4 layouts** that differ in structure, not just colour: for example a classic single column with a large portrait, an editorial layout with a wide banner and pull-quote headline, a compact card-style layout, and a split layout with a sticky contact panel on desktop. Separately, define **5 colour palettes** (Calm, Warm, Clinical, Earth, Night; Night is dark). Every palette must work on every layout. Show each layout in at least two palettes, and one layout in all five.
>
> **Who sees it**
> - **Clients** (most visitors), usually on a mid-range Android phone over mobile data, often arriving from WhatsApp or Instagram. They are deciding, in under a minute, whether this person is right for them and safe to contact. Many are anxious. The page must feel calm, credible and human, never clinical or salesy.
> - **Therapists**, who share the link and judge the platform by how their page looks.
>
> **Pages to design** (mobile first at 360 px, then 768 and 1280 px):
> 1. **Profile page** `/{handle}`: the main page. Ten sections in a fixed order (below), in each layout.
> 2. **Home** `/`: invites therapists to create a free profile, then shows what the dashboard adds. It becomes a searchable directory later, so leave room for a search bar.
> 3. **Clinic page** `/{clinic}`: a clinic's public page listing its therapists, each linking to their profile. The same team appears on the clinic's own address at `/team`.
> 4. **Not found** (404) and **profile no longer available** (410).
> 5. **Report this profile**: a short form (reason: impersonation, misleading, unsafe, other; optional details; optional name and email), with a thank-you state.
> 6. **Link preview image** (1200 × 630) per layout: what shows when the link is shared on WhatsApp, X, LinkedIn. Photo, name, kind, headline, city, in the profile's palette.
> 7. **The dashboard's profile editor screens**, so the hand-off from public to product is visible: the layout picker and palette picker (with live preview), and the share page (link, QR code, PDF one-pager, email signature). Use the existing dashboard components, restyled to the extended system.
>
> **Profile sections, in this order** (empty optional sections are hidden):
> 1. Identity: photo, name, kind (e.g. Counsellor, Clinical Psychologist), headline, city and country, pronouns
> 2. About
> 3. Qualifications & training: free text plus a timeline of training and roles
> 4. Specialties: up to 3 primary, then others
> 5. Approach & modalities
> 6. Who I work with: populations; faith integration (optional)
> 7. Languages
> 8. Experience: years, sessions or hours
> 9. Where I practise / sessions & fees: one block per practice (name, online or in person, locations, fees)
> 10. Book / contact: one primary button (Book a session, or an external booking link, or contact), optional public email and social links
>
> Footer: "Create your free therapist profile", "Report this profile", Terms.
>
> Layouts and palettes change look only, never content or section order. Propose the token table for each palette, and for each layout its structure, type pairing and photo treatment.
>
> **Hard rules** (these are engineering constraints; designs that break them can't ship)
> - **No JavaScript needed** to read the page. It's server-rendered; any interaction must work without JS.
> - **Plain text only** from the therapist: no rich text, no embedded video, no custom HTML. Line breaks are kept.
> - **No reviews, ratings or testimonials** anywhere (professional ethics rule).
> - **No third-party scripts, fonts or embeds** loaded from other sites. Fonts must be self-hosted (pick open-licence fonts); images come only from our own media domain.
> - **WCAG 2.1 AA**: 4.5:1 text contrast in every theme, visible focus, 44 px touch targets, works at 320 px wide, respects reduced motion. Lighthouse accessibility ≥ 95.
> - **Fast on slow networks**: one photo, a small CSS file, no hero video, no large decorative images. Aim under 100 KB before the photo.
> - The **profile photo may be missing**: design a good no-photo state (initials or a theme pattern).
> - Long and short content both have to look right: a two-line About and a 3,000-character one; one specialty and twelve.
>
> **Brand**: "Therapysts" is the platform; on a profile page the therapist is the star, and platform branding stays small (footer and a light top bar). On the home page the platform leads. Tone: warm, plain, respectful. Use Nigerian names and photos of Black African professionals in examples.
>
> **Deliver**: the extended design system (foundations shared by both surfaces, plus the Public surface's additions); the pages above at three widths; every layout in at least two palettes and one in all five; the palette token table; and component states (button, specialty chips, timeline item, practice block, empty photo, team card).

## Notes for whoever implements it

- The renderer is `apps/profiles` (Astro, server-rendered on Cloudflare Workers). Today's theme tokens live in `packages/ui/src/brand/profileThemes.ts` and have a contrast test; palettes must pass it on every layout.
- Splitting layouts from palettes needs a spec change (§6.5) and a new `layoutKey` on `PractitionerProfile` beside `themeKey` (which becomes the palette). Spec Claude makes that change when the design is approved.
- The CSP blocks inline scripts and any outside origin, so the design can't rely on them.
- Spec references: §6.4 (sections), §6.5 (themes), §6.11 (public page), §6.3 (preview images), §4.3 (security).
</content>
</invoke>
