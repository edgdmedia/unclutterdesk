# Unclutter Desk — Design System

Practice management and white-label client booking for therapists.
Formerly **UnclutterOS**; renamed, repalletted, and cut loose from the shared
Unclutter token file.

---

## What Unclutter Desk is

A B2B SaaS platform with two faces:

1. **The therapist workspace** — an internal practice-management app behind a
   login: dashboard, schedule, clients, brand settings, analytics.
2. **The white-label client booking portal** — a public page served on the
   therapist's own domain, styled entirely in the therapist's brand colors and
   logo, with no Desk chrome beyond a small "Booking powered by Unclutter Desk"
   footer line.

The central product idea, and the thing this system is built to support, is that
**a single pair of tenant color tokens drives the entire public-facing
experience.** The therapist picks a primary and a secondary in Brand Settings,
and every branded element of the booking portal, the confirmation screen, and
their own workspace accents updates from those two values.

There is also a React Native companion app (Today, Schedule, Clients, Brand)
plus a mobile web view of the client booking flow.

**Currency:** ₦ (Nigerian Naira, U+20A6), comma-grouped, no decimals.

---

## Self-contained by design

This system has **no `@import` from, dependency on, or override against**
`colors_and_type.css` or any other Unclutter app's tokens, and **no `data-app`
scoping mechanism**. Every token is declared on `:root` in `tokens/`.

Hand this folder to a developer with zero knowledge of Journal, Finance,
Estate, Consult or Learning and it is complete: tokens, fonts, components,
screens.

Two things are deliberately shared with the wider Unclutter family, because
Desk should still read as part of it: the **Outfit** typeface, and the
**"unclutter" wordmark lockup** style. Nothing else.

> Anything under `_ds/` belongs to a separate, unrelated design system bound to
> this project by the editor. Nothing here references it.

### Sources

- Previous system: `unclutteros.css` — a sub-brand token layer that extended
  `colors_and_type.css` under `[data-app="os"]`. Superseded by this folder.
- Screen specification: the UnclutterOS handoff bundle (`UnclutterOS
  Screens.dc.html`, `UnclutterOS Prototype.dc.html`, `UnclutterOS Mobile.dc.html`),
  which is the source of every layout, size and copy string reproduced in
  `ui_kits/`.
- Logo: the previous `unclutteros-mark.svg` / `unclutteros-lockup.svg`,
  recolored and rebadged — same leaf linework.

---

## What changed, and what did not

**Changed**

| | Before | Now |
|---|---|---|
| Product name | UnclutterOS | Unclutter Desk |
| Badge | Gold `OS` pill | Mint `DESK` pill |
| Primary | Navy `#0F3A53` | Pine `#24614F` |
| Accent | Gold `#E3B341` throughout | Clay `#8A5A3C` secondary; one rare brass |
| Booking URL | `unclutteros.com/booking/:slug` | `unclutterdesk.com/booking/:slug` |
| CNAME target | `cname.unclutteros.com` | `cname.unclutterdesk.com` |
| Booking ref | `UOS-4C81-2026` | `UDK-4C81-2026` |
| Footer line | "Booking powered by UnclutterOS" | "Booking powered by Unclutter Desk" |
| Assets | `unclutteros-*.svg` | `unclutterdesk-*.svg` |
| Tokens | `--os-*` under `[data-app="os"]` | `--desk-*` on `:root` |
| Success status | `#10B981` | `#16A34A` |
| Pending status | `#D97706` | `#C2410C` |

**Not changed** — this was a structural-independence and palette correction, not
a redesign: the type scale, spacing / radius / shadow values, component layouts,
screen structure, the five Brand Settings preset pairs, the slate sidebar, the
white-label architecture, motion behaviour, and every interaction rule.

---

## Content fundamentals

Desk speaks differently from Journal. Journal is a calm friend; Desk is a
**competent colleague** — plain, specific, and never chirpy. It is a tool a
clinician uses between sessions, so it states facts and gets out of the way.

- **Person.** Second person to the therapist ("your booking page", "your
  practice"). Third person about clients ("Adaeze Okonkwo", "128 active
  clients") — never "your clients' journeys".
- **Casing.** Sentence case for headings and body. **ALL CAPS with 0.22em
  tracking** for eyebrows and badges, and nothing else.
- **Length.** One line. Helper text is one sentence, and it states a
  consequence rather than an encouragement.
- **No emoji.** Journal's 🌿 does not appear here.
- **No exclamation marks**, no "Great job", no streaks or gamification.

### Copy patterns

- **Eyebrows** name the card's content flatly: `REVENUE THIS MONTH`,
  `UPCOMING`, `PRACTICE STATUS`, `BRAND STYLING`, `SESSION SUMMARY`.
- **Headings** are nouns, not invitations: "Client sessions today",
  "Your booking page", "Revenue by month", "Where bookings come from".
- **Buttons** are verb + object: "Copy Booking Link", "Start session",
  "Save brand settings", "Set availability", "Confirm & Book Session".
- **Helper text states the consequence.** Active: *"Your booking page is live
  and accepting new client bookings."* Inactive: *"Your booking page is hidden.
  Existing sessions are unaffected."* The second sentence is the reassurance —
  keep it.
- **Constraints are stated before they're broken**: *"JPG or PNG · max 2 MB"*,
  *"SVG or PNG · max 2 MB · replace"*.
- **Feedback replaces the label rather than raising a toast.** "Copy Booking
  Link" → "Link copied" for 1600ms, then back.
- **Middot separates facts**, never a comma: *"August 2026 · vs ₦380,500 in
  July"*, *"Individual Therapy · Telehealth"*, *"11:30 AM WAT · 50 min"*.

### Client-facing copy (the booking portal)

Warmer, because this is a stranger deciding whether to trust a therapist —
but still unfussy.

- *"Book a session with Dr. Jane Smith"*
- *"Anything you'd like Dr. Smith to know before your first session."*
- *"Encrypted and confidential. Shared only with Dr. Smith."*
- *"Your session is booked"* — not "Booking confirmed!"
- *"A confirmation has been sent to your email, along with a secure telehealth
  link you can open five minutes before the session."*
- *"Free cancellation up to 24 hours before."*

---

## Visual foundations

### Color

Three families and nothing else. Full hex tables are in `tokens/colors.css`;
the specimen cards under `guidelines/` show every ramp.

- **Pine** `#24614F` — the brand. Derived from Unclutter's sage `#4A7C6F`: same
  hue neighbourhood (~164°), pushed from 25% → 40% saturation and 39% → 24%
  lightness. Deep pine, not pastel sage; 7.35:1 on white, so it works as body
  text and as a solid button fill with white text alike.
- **Clay** `#8A5A3C` — the secondary. Warm and low-chroma, far enough from pine
  in hue and temperature that category coding (Individual vs Couples) reads at a
  glance. Echoes Unclutter's brown `#764330` without importing it.
- **Slate** `#0F172A → #F8FAFC` — all product chrome. Never tenant-themed.

**Brass** `#B08320` is the one gold-family tone that survives, reserved for a
single rare decorative flourish. It is not available to badges, the active-nav
marker, star ratings, or any status.

### Backgrounds and surfaces

- App background `#F8FAFC`; a fainter `#FCFDFE` for table headers and the
  booking body; `#F1F5F9` for muted control fills.
- Cards are **pure white with a hairline `#E2E8F0` border** and `shadow-sm`.
  Not tinted, not gradient.
- **No photography anywhere.** Avatars are initials in a rounded square.
- **Gradients appear in exactly three places**, all tenant-driven: the booking
  portal's brand header (`120deg, primary+8%, secondary+10%`), the confirmation
  screen's top wash, and the mobile brand card. Workspace chrome has one more —
  the active sidebar item's pine gradient. Nowhere else.
- Glass — `rgba(255,255,255,.85)` + `blur(18px) saturate(140%)` — is used only
  for the mobile bottom nav and sticky action bars.
- Decorative illustration: none. No ghost icons, no patterns, no textures.

### Type

**Outfit**, 300–900, bundled at `fonts/`. **JetBrains Mono** is a utility for
hex codes, CNAME hosts and booking references — nothing else.

The **9px / 900 / 0.22em uppercase eyebrow** is the system's signature and sits
above nearly every card and section. Numeric columns take
`font-variant-numeric: tabular-nums`. The full scale is in
`tokens/typography.css` and `guidelines/type-*.html`.

### Radius, spacing, elevation

One radius per role — 24 card · 22 panel · 20 nested/KPI · 18 list row ·
14 control · 12 chip · 10 small · 999 pill. Control heights 32 / 40 / 44 / 48,
plus 52 for the booking CTA. Shadows run xs → modal on a neutral slate tint;
only three carry brand color (`--desk-shadow-button`, `--desk-shadow-tenant`,
`--desk-shadow-nav-active`), and only their hue changed with the repalette.

### Motion and interactive states

All easing is **ease-out**. No bounces, no spring.

- Colour and background 140–200ms · hover lift 160ms · toggle 200ms · bar
  height 300ms.
- **Hover (cards):** `translateY(-1px)` + `0 8px 24px rgba(15,23,42,.08)`.
- **Hover (primary buttons):** `filter: brightness(1.08)` — this is what makes
  hover work for an arbitrary tenant color without a second stored token.
- **Hover (secondary):** background → `#F1F5F9`.
- **Hover (sidebar items):** background and text only. No transform, no scale.
- **Press:** `translateY(1px)`.
- **Focus:** `box-shadow: 0 0 0 3px var(--brand-ring)`; inputs also switch
  background `#F8FAFC → #FFFFFF` and border `#E2E8F0 → #94A3B8`.
- **Disabled:** `opacity: 0.6`.

### Layout rules

- The workspace is authored for **≥1440px** and has no mobile breakpoint; the
  companion app covers small screens.
- The sidebar is fixed at 248px and the header at 80px; only the main region
  scrolls.
- The booking portal is authored at 1180px desktop and 390px mobile — build it
  responsive between those two, since clients arrive on whatever device they
  have.
- In the Brand Settings preview pane the portal is **scaled**, not reflowed.

---

## White-label architecture

```css
--brand-primary / --brand-primary-hover / --brand-primary-soft / --brand-on-primary
--brand-secondary / --brand-secondary-hover / --brand-secondary-soft / --brand-on-secondary
```

Two hexes are stored per tenant; six tints derive via `color-mix` —
`--brand-ring` (20%), `--brand-tint` (8%), `--brand-fill` (9%), `--brand-dot`
(40%), `--brand-bar` (18%), `--brand-secondary-tint` (10%).

Override on any ancestor, and add the `.desk-tenant` class to the same element
so the derived tints re-resolve:

```html
<div class="desk-tenant" style="--brand-primary:#007BFF; --brand-secondary:#6F42C1">
```

**The sidebar shell stays slate in every tenancy.** Tenant color enters the
workspace only through the active nav item's gradient and accent elements; it
never becomes the sidebar background. That rule is what keeps the product
legible as one product across hundreds of tenant palettes.

Defaults fall back to the Desk house palette, so a therapist who never opens
Brand Settings still gets a finished page.

---

## Iconography

**Lucide**, and only Lucide. Stroke-based, `stroke-width: 2`, round caps and
joins, 24×24 viewBox, no fill. In production use `lucide-react`.

- Sizes: 14–15px inline · 18px desktop nav · 20px mobile nav · 16px in
  icon buttons.
- Colour: `--desk-pine-600` (or `--brand-primary` where the element is
  tenant-themed), `--desk-text`, or `--desk-text-muted`.
- **No icon font, no emoji as functional icons, no unicode glyph icons.**
- The one exception is the star in the booking portal's rating line, drawn as a
  filled Lucide star in `--desk-pine-500` — it used to be gold.
- The kits carry inline copies of the glyphs they use in
  `ui_kits/workspace/icons.jsx`; that file is prototype convenience, not part
  of the design system's public surface.

**Logo.** `assets/unclutterdesk-mark.svg` (square tile, leaf linework, DESK
badge) and `assets/unclutterdesk-lockup.svg` (mark + "unclutter" wordmark +
outlined DESK badge). Used at 30px in the sidebar and 16px at 60% opacity in
the "powered by" footers. Recolor by editing the SVG fills, not with CSS
filters.

---

## Index

| Path | Contents |
|---|---|
| `styles.css` | Global entry point — `@import` lines only. Link this one file. |
| `tokens/fonts.css` | `@font-face` for Outfit and JetBrains Mono |
| `tokens/colors.css` | Pine, clay, brass, slate, status, semantic aliases |
| `tokens/brand-slots.css` | White-label tenant slots, derived tints, presets |
| `tokens/typography.css` | Type scale, tracking, `.d-*` type utilities |
| `tokens/spacing.css` | Spacing, radius, control heights, layout constants |
| `tokens/elevation.css` | Shadows, glass, focus ring, motion, z-index |
| `tokens/base.css` | Minimal resets |
| `assets/` | Mark and lockup SVGs |
| `fonts/` | Outfit and JetBrains Mono variable fonts |
| `guidelines/` | 18 foundation specimen cards (colour, type, spacing, brand) |
| `components/core/` | Button, IconButton, Card, Eyebrow, Badge, StatusPill, AvatarChip |
| `components/forms/` | Input, Textarea, SegmentedControl, Toggle, ColorField + PresetSwatches |
| `components/navigation/` | NavItem, Sidebar, AppHeader, BottomNav |
| `components/data/` | StatTile, BarChart, ProgressRow |
| `components/brand/` | Logo |
| `ui_kits/workspace/` | Therapist workspace — Dashboard, Schedule, Clients, Brand Settings, Analytics |
| `ui_kits/booking/` | Public booking portal + confirmation, tenant-themed |
| `ui_kits/mobile/` | Five companion-app screens at 390 × 844 |
| `SKILL.md` | Agent skill definition |

### Intentional additions

The previous system shipped tokens and screens but no component library. The
primitives in `components/` were factored **out of** the screens rather than
invented: every one has a direct counterpart in the handoff spec. Two are
conveniences worth naming:

- **`Eyebrow`** — the 9px/900/0.22em label was a repeated inline style, not a
  component. It appears on almost every card, so it earns a name.
- **`PresetSwatches`** (exported from `ColorField.jsx`) — the five preset pairs
  were hard-coded markup in Brand Settings. Exporting `BRAND_PRESETS` keeps the
  values in one place.

### Not yet designed

State that exists in the product but has no visual treatment: loading and
skeleton states, empty states (no clients, no sessions today, no revenue
history), form validation errors, payment failure, and CNAME-unverified. Ask
before inventing them.
