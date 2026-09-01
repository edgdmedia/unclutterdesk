# Claude Design Prompt — Unclutter Desk Screens Set 04 (Views 21–22)

Paste this into Claude Design (claude.ai/design) to generate a new spec board
named `Unclutter Desk Screens IV.dc.html` with **two views**, matching the existing
Unclutter Desk handoff conventions (`design_handoff_unclutterdesk_screens_2_3`).

---

Design two new screens for Unclutter Desk, a B2B practice-management and
white-label telehealth platform for therapists in Nigeria. Recreate the
existing Unclutter Desk design system exactly: Outfit font, slate sidebar
`#0F172A`, deep navy `#0F3A53`, warm gold `#E3B341`, surface `#F8FAFC`,
white cards radius 24px, 9px/900/.22em uppercase eyebrows, `#E2E8F0` borders,
`#475569`/`#64748B`/`#94A3B8` text hierarchy. No photography — avatars are
initials on tinted tiles. Lucide-style inline SVGs, 2px stroke, round caps.

Both screens live on a 1440px-wide canvas, each in its own
`<section data-screen-label="View NN — Title">`. Each section shows the frame
(the real app page) and, where useful, an interaction annotation in a
12px `#64748B` caption above it.

## Shared shell (both views)

- Slate `#0F172A` sidebar, width 248px, padding 20px 14px.
  - Brand lockup at top (30px mark, wordmark "unclutter" 17px/600, gold
    `OS` pill 18px/800).
  - Group label `SETTINGS` — 9px/900/.2em, `#475569`, padding 2px 12px 8px.
  - Six settings items, each 44px, radius 14px, 13.5px/600, gap 11px, with
    Lucide icons:
    1. **Practice profile** (id icon)
    2. **Brand & booking page** (palette icon)
    3. **Team & staff** (users icon, gold count badge)
    4. **Subscription & payouts** (credit-card icon)
    5. **Forms & assessments** (file-text icon, gold count badge)
    6. **Notifications** (bell icon)
  - Rest state: `#94A3B8` text, transparent bg; hover `#1E293B` bg /
    `#E2E8F0` text. Active item: `#FFFFFF` text,
    `linear-gradient(90deg, rgba(15,58,83,.9), rgba(27,83,117,.55))`,
    `inset 0 0 0 1px rgba(227,179,65,.28)` shadow, a 3px×20px gold tab
    (`#E3B341`, radius 0 3px 3px 0) flush at left, icon stroked gold.
  - Footer pinned with `margin-top:auto`, `1px solid rgba(255,255,255,.07)`
    rule: 32px `#1B5375` avatar chip `JS`, "Dr. Jane Smith" 12.5px/600
    `#E2E8F0`, role 10px `#64748B`.
- Content column: `flex:1; min-width:0`, header 88px white with
  `border-bottom:1px solid #E2E8F0`, padding 0 26px, an eyebrow above a
  20px/700 title, and a right action cluster at `margin-left:auto`.
- Body: `#F8FAFC`, padding 24px 26px 30px.

## View 21 — Practice profile (`/settings/profile`)

Header: eyebrow `PRACTICE`, title **Practice profile**, sub
"Public contact details shown to clients on your booking page." Right:
navy **Save changes** button (44px, radius 14px, 14px/700, upload icon? no —
save icon) and a ghost **Reset** button.

Body: two-column grid `grid-template-columns: minmax(0,1fr) 372px; gap:20px`.

**Left column — Identity** (white card, radius 24px, 1px `#E2E8F0` border,
padding 24px 26px, shadow `0 1px 3px rgba(15,23,42,.06)`):
- Eyebrow `PRACTICE IDENTITY` + title **About your practice** (17px/700).
- Logo row: 76px logo tile (radius 24px, `#F8FAFC`, 1px `#E2E8F0`), filename
  `jane-smith-logo.svg` 13px/700 over "SVG or PNG · max 2 MB · replace"
  11px `#94A3B8`, right-aligned **Upload** chip and **Remove** ghost.
- Two-up grid of labelled inputs (11.5px/700 `#475569` labels, 46px inputs,
  radius 14px, `#F8FAFC`, 1px `#E2E8F0`, 14px text, focus: white bg /
  `#94A3B8` border): **Practice name** (`Dr. Jane Smith Therapy`),
  **Short name** (`Dr. Jane Smith`, for the browser tab).
- **Bio / tagline** full-width textarea (4 rows, resize:none): "A calm,
  evidence-based therapy practice in Lagos helping you feel steady again."

**Left column — Contact & location** (same card):
- Eyebrow `CONTACT & LOCATION` + title **How clients reach you** (17px/700).
- Inputs (same style): **Public email** (`hello@smiththerapy.ng`),
  **Phone** (`+234 801 234 5678`), **City** (`Lagos`), **Address**
  (`14 Admiralty Way, Lekki Phase 1`), **Practice category**
  (select with the options Clinical psychology / Counselling / Psychiatry /
  Family & couples therapy, value Clinical psychology).

**Right column — Practitioner profile** (white card, radius 24px, padding
22px, `align-items:start`):
- Eyebrow `PUBLIC PROFILE` + title **You** (17px/700).
- 76px avatar tile (radius 24px, navy gradient, gold `JS`), a 24px `#10B981`
  online dot ringed `3px solid #fff` at bottom-right.
- Name **Dr. Jane Smith** 15px/700, "Clinical Psychologist · MSc"
  12.5px `#64748B`.
- **Job title** input (`Clinical psychologist`), **Credentials** input
  (`MSc Clinical Psychology, Licensed by NCP`).
- A 6px amber note card (`#FEF3C7` bg, `#92400E` text, radius 14px, info
  icon): "Your photo and credentials appear on your booking page. Keep them
  current so clients recognise you."
- Ghost **Change photo** button.

Footer note under the grid, 12.5px `#94A3B8`: "Changes go live on your
booking page immediately after saving."

## View 22 — Notifications (`/settings/notifications`)

Header: eyebrow `NOTIFICATIONS`, title **Notifications**, sub
"Booking, session and account updates." Right: ghost **Mark all as read**
(40px, radius 14px) and a navy **Notification settings** button.

Body: two-column grid `grid-template-columns: minmax(0,1fr) 372px; gap:20px`.

**Left column — Inbox** (white card, radius 24px, 1px border, `overflow:hidden`):
- Grouped by date; each group starts with a 9px/900/.16em uppercase label
  `TODAY` / `YESTERDAY` / `EARLIER` in `#94A3B8`, padding 16px 24px 8px.
- Rows: padding 14px 24px, `border-bottom:1px solid #F1F5F9`, gap 12px.
  Unread rows carry a 6px `#E3B341` dot at left of the icon; unread row bg
  `#F8FAFC`. 40px icon tiles (radius 12px): navy/gold mix per type.
  - **Booking confirmed** — "Adaeze Okonkwo booked Individual Therapy for
    Fri, 14:00." · "9:24 AM" (12px `#94A3B8`, right-aligned).
  - **Payment received** — "₦30,000 from Adaeze Okonkwo settled to your
    subaccount." · "9:24 AM".
  - **Intake submitted** — "Adaeze Okonkwo submitted the Pre-Session Client
    Intake. PHQ-9: 14 — flagged for review." · "9:26 AM".
  - **Session in 30 minutes** — "Your session with Tunde Bello starts at
    15:30. Join the telehealth room." · "3:00 PM".
  - **Settlement** — "Your August payouts of ₦412,000 were sent to GTBank
    ****4192." · "Yesterday".
- Hover: `#FCFDFE` bg. Each row ends with a chevron affordance.

**Right column — Preferences** (white card, radius 24px, padding 22px):
- Eyebrow `PREFERENCES` + title **What you hear about** (17px/700).
- Toggle rows (16px apart, separated by `1px solid #F1F5F9`, padding 13px 0):
  title 13.5px/700, sub 11.5px `#94A3B8`, a 40×22px pill toggle
  (`#15803D` on / `#E2E8F0` off, 16px white knob, ~160ms ease-out).
  - **Bookings** · "New bookings and cancellations" — ON
  - **Payments** · "Settlements, payouts and failed charges" — ON
  - **Client intake** · "Submitted intake and flagged responses" — ON
  - **Session reminders** · "15 and 30 minutes before a session" — ON
  - **Product & news** · "Feature updates and tips" — OFF
- Below the list, a ghost **Email me a weekly summary** button with a 12px
  `#94A3B8` caption "Sent every Monday at 8 AM WAT."

## Interaction notes (add as `<sc-if>`-style annotations or captions)

- View 21: **Save changes** and **Reset** are wired; **Upload/Remove** open
  a file picker annotation; inputs are editable.
- View 22: toggles flip independently; **Mark all as read** clears the gold
  dots; **Notification settings** scrolls to Preferences.
- Everything else is styled but inert.

## State

- View 21: `draft` object of the profile fields; `saved` boolean.
- View 22: `read: {id[]}`, `prefs: { bookings, payments, intake, reminders, product }`.

Use the same `<sc-if>`, `{{ value }}` and `Component` logic class conventions
as the other Unclutter Desk `.dc.html` spec boards so it renders with `support.js`.
