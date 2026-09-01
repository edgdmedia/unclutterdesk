# Handoff: Unclutter Desk — Screens Set 04 & Set 05 (Views 21–29)

## Overview

Unclutter Desk is a B2B practice-management and white-label telehealth platform for
therapists in Nigeria. Therapists run their practice inside the OS (schedule, clients,
clinical notes, telehealth, billing); their clients book and pay through a booking
portal branded to the therapist, not to unclutterOS.

This bundle covers **nine screens across two files**:

**Set 04 — `Unclutter Desk Screens IV.dc.html`**
| View | Screen | Route |
|---|---|---|
| 21 | Client account portal | `/portal` |
| 22 | Session prep | `/session/:id/prep` |
| 23 | Intake & assessment review queue | `/reviews` |
| 24 | Brand & booking page settings | `/settings/brand` |
| 25 | Availability & blocked time | `/settings/availability` |
| 26 | Empty, error & offline states | — (state spec board) |

**Set 05 — `Unclutter Desk Screens V.dc.html`**
| View | Screen | Route |
|---|---|---|
| 27 | My profile | `/profile` |
| 28 | Account & preferences | `/settings/account` |
| 29 | Notifications centre + header dropdown | `/notifications` |

Views 01–06 ship in `design_handoff_unclutterdesk`; views 07–20 in
`design_handoff_unclutterdesk_screens_2_3`. Tokens are identical across all bundles.

## About the Design Files

The `.dc.html` files here are **design references created in HTML** — prototypes
showing intended look and behaviour, not production code to copy. Each opens directly
in a browser (`support.js` must sit beside it) and lays its screens out on one
scrollable canvas, a `<section>` per view.

The task is to **recreate these designs in the target codebase's environment** —
React, Vue, SwiftUI, native, whatever is already in place — using its established
patterns, component library and routing. If no environment exists yet, choose the
framework that fits the project. Do not ship the HTML.

The files use a small template runtime (`<sc-if>`, `<sc-for>`, `{{ value }}` holes and
a `Component` logic class). Treat those as ordinary conditional rendering, list
rendering and component state in your framework.

## Fidelity

**High fidelity.** Colours, type sizes, radii, spacing, shadows and copy are final.
Interactions are wired where they carry meaning (portal tabs, queue selection, palette
picker, day toggles, profile tabs, preference chips, currency select, 2FA and channel
toggles, notification bell + filters, mark-all-read); every other control is styled but
inert and needs real wiring.

## Design Tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| Slate (chrome) | `#0F172A` | Sidebar, dark cards, session-room surfaces |
| Slate hover | `#1E293B` | Sidebar item hover |
| Deep navy (brand) | `#0F3A53` | Primary buttons, active nav, brand surfaces |
| Navy light | `#1B5375` | Gradient partner, avatars |
| Warm gold (accent) | `#E3B341` | Badges, active markers, unread dots, CTA on dark |
| Canvas | `#E7EDF2` | Page background behind screen frames |
| App background | `#F8FAFC` | Screen body |
| Surface | `#FFFFFF` | Cards, headers, panels |
| Muted surface | `#F1F5F9` / `#EEF2F7` | Inputs, tab tracks, chips |
| Border | `#E2E8F0` | All 1px borders |
| Divider | `#F1F5F9` | Row separators |
| Text primary | `#0F172A` | |
| Text body | `#334155` | Paragraph copy |
| Text secondary | `#475569` | Field labels |
| Text muted | `#64748B` | Sub-copy |
| Text faint | `#94A3B8` | Eyebrows, placeholders, meta |
| Success bg / fg | `#ECFDF5` `#DCFCE7` / `#059669` `#15803D` `#065F46` | Verified, paid, ready |
| Warning bg / fg | `#FEF3C7` / `#92400E` | Action needed, pending, moderate |
| Danger bg / fg | `#FEF2F2` `#FEE2E2` / `#DC2626` `#B91C1C` `#7F1D1D` | Risk flags, failed payment |
| Danger border | `#FECACA` | Risk banner inset ring |
| Info bg | `#EFF6FB` | Navy-tinted info panels, selected queue row |
| Session room | `#0B1220` | Telehealth dark canvas |

Palette picker (View 24) swaps two values across the live preview:
navy `#0F3A53` / gold `#E3B341` · forest `#243D35` / sage `#A8C5BA` ·
plum `#3B2450` / lilac `#D8B4FE`.

Active sidebar item: `linear-gradient(90deg, rgba(15,58,83,.9), rgba(27,83,117,.55))`
with `inset 0 0 0 1px rgba(227,179,65,.28)` and a 3×20px gold tab at `left:0`.

### Typography

**Outfit** throughout (Google Fonts, weights 300–900), `-webkit-font-smoothing: antialiased`.

| Role | Spec |
|---|---|
| Eyebrow | 9px / 900 / `.20–.22em` uppercase / `#94A3B8` (gold `#E3B341` on dark) |
| Small eyebrow (panel head) | 9.5px / 900 / `.16em` |
| Page title | 20px / 700 / `-.02em` |
| Screen hero name | 22–28px / 700 / `-.02 to -.03em` |
| Card title | 15–16px / 700 / `-.01em` |
| Body | 13–13.5px / 400–600 / line-height 1.5–1.65 |
| Field label | 11.5px / 700 / `#475569` |
| Input value | 14px / 600 |
| Meta / sub-copy | 11.5–12.5px / `#64748B` or `#94A3B8` |
| Stat value | 19–44px / 800 / `-.03 to -.045em` |
| Pill / badge | 9–10.5px / 800–900 / `.06–.12em` uppercase |

### Radius

Screen frame 24px · cards 24px · inner panels 20px · list rows 16–18px · dropdown 22px ·
inputs & selects 14px (small 12–13px) · buttons 13–16px · icon tiles 10–14px ·
avatar tiles 20–26px · pills & toggles 999px.

### Shadow

| Use | Value |
|---|---|
| Screen frame | `0 24px 80px rgba(15,23,42,.14)` |
| Card | `0 8px 26px rgba(15,23,42,.05)` |
| Card (notification row) | `0 8px 26px rgba(15,23,42,.04)` |
| Navy CTA | `0 8px 22px rgba(15,58,83,.24)` (large: `0 10px 26px rgba(15,58,83,.26)`) |
| Navy gradient card | `0 14px 40px rgba(15,58,83,.22)` |
| Notification dropdown | `0 24px 80px rgba(15,23,42,.24)` |
| Browser-chrome preview | `0 14px 40px rgba(15,23,42,.09)` |
| Selected chip | `0 6px 16px rgba(15,58,83,.22)` |
| Active tab pill | `0 4px 12px rgba(15,23,42,.08)` |
| Inset hairline | `inset 0 0 0 1px #E2E8F0` |
| Selected row ring | `inset 0 0 0 1.5px #0F3A53` |
| Toggle knob | `0 2px 5px rgba(15,23,42,.2)` |

### Spacing

Screen width 1440px; heights 880–1010px per view. Sidebar 248px (icon rail variant
76px). Header 70 / 78 / 88px. Body padding 24–26px. Card padding 22–26px.
Right column 320 / 340 / 352 / 400px. Card gap 16px, column gap 20px, field gap 14px,
list gap 10–12px. Control heights: button 44–46px (large CTA 52px), input/select 48px
(compact 42–46px), tab pill 40px, chip 42px, toggle 28–30px (small 22px).

---

## Screens

### View 21 — Client account portal (`/portal`)

1440×940, `#F6F8FA`. Client-facing and branded to the therapist — no unclutterOS
chrome. **Header 72px** `#0F3A53`: 34px gold initials tile, practice name
(16.5px/600 white), right side `Help` + 34px translucent avatar and first name.

Body scrolls, max-width 1080px centred, 30px/34px padding, 22px gaps:

1. Eyebrow `YOUR SESSIONS` + `Hello, Amara` (28px/700).
2. **Next-session hero** — 24px radius, `linear-gradient(135deg,#0F3A53,#1B5375)`,
   26/28px padding. 86px date tile (`FRI` gold 9.5px / `14` 30px/800 / `AUG` 10.5px)
   on `rgba(255,255,255,.1)` with an inset hairline; eyebrow `YOUR NEXT SESSION` gold,
   `10:00 — 10:50, video session` 22px/700 white, meta 13.5px `#CBD5E1`; right:
   ghost **Reschedule** (48px, `rgba(255,255,255,.22)` border) and gold **Join session**
   (48px, `#E3B341` on `#0F172A`, video icon).
3. **Action-needed strip** — `#FEF3C7`, 20px radius, white 38px file icon tile,
   "One form to complete before Friday" / "PHQ-9 Clinical Scale · takes about 3 minutes",
   slate **Complete form** button right.
4. **Tabs** — `Upcoming` / `Past sessions` / `Payments` in a 5px `#EEF2F7` track;
   active pill white with `0 2px 8px rgba(15,23,42,.1)`.
5. Tab panels: upcoming session rows (54px date tile, price/receipt meta, Cancel link +
   Reschedule button), past-session list, and a payments table with columns
   `DATE · SESSION · STATUS · RECEIPT`.

### View 22 — Session prep (`/session/:id/prep`)

1440×880. **76px slate icon rail** (mark, three 46×44 icon tiles, active tile navy
gradient with gold glyph and a 3×20 gold tab, avatar pinned bottom). **Header 70px**:
`← Back to schedule` left, amber pill `Starts in 4 minutes` right (999px, `#FEF3C7`,
7px gold dot).

Left column:
- **Client hero card** — 72px navy-gradient avatar with gold initials, eyebrow
  `10:00 — 10:50 · SESSION #8`, name 24px/700, meta line, 52px navy **Join room** CTA.
- **Where you left off** — session #7 note; two 16px-radius `#F8FAFC` tiles with inset
  hairline, `S`/`P` letter chips (navy-on-gold and gold-on-slate) and SUBJECTIVE / PLAN
  extracts; below, an `#EFF6FB` strip recalling the homework set last week.
- **Submitted before this session** — green `RECEIVED 2H AGO` pill; 180px amber score
  tile (`PHQ-9 TODAY`, `11` 32px/800, `Moderate`, delta note) beside an item breakdown
  list with 26×24 score chips coloured by band (red 3, amber 2, green 0).

Right column 340px:
- **Device check** — slate `#0F172A` card, gold eyebrow, three status rows with 30px
  tinted tiles (camera, microphone, connection 18 Mbps), then a 96px self-preview panel
  `linear-gradient(150deg,#243B52,#14202F)` with a 44px round avatar, plus microcopy.
- **Client status** — green dot, "Amara is in the waiting room", join time, ghost
  **Send her a message**.
- **After this** — next appointment tile (44px date block, name, "First session · intake received").

### View 23 — Intake & assessment review queue (`/reviews`)

1440×900. Standard 248px slate sidebar with `Reviews` active carrying a rose `#E11D48`
count badge (3).

**Queue column 400px**, white, right border. Head: eyebrow `NEEDS YOUR REVIEW`,
`3 submissions` 19px/700, three filter pills (`UNREAD` active navy, `FLAGGED`, `ALL`).
List of 18px-radius cards, 14px padding: 36px initials tile (tinted by state), name +
"Submitted N ago", optional red `FLAGGED` pill, one-line summary. Selected card
`#EFF6FB` with `inset 0 0 0 1.5px #0F3A53`; unselected white with a 1px inset border.
Footer note: "Reviewed submissions move to the client's clinical file automatically."

**Detail pane**: header 78px with eyebrow + client name, ghost **Open client file** and
navy **Mark reviewed**. Content:
- **Risk banner** (only when the submission is flagged) — `#FEF2F2` with
  `inset 0 0 0 1.5px #FECACA`, 40px `#B91C1C` alert tile, title 16px/700, explanation
  13.5px `#7F1D1D` quoting the item and answer, then **Call client now** (`#B91C1C`)
  and **Log a safety note** (white on `#FECACA` border).
- **Score row** — 240px tinted score card (label, value 44px/800, band, note; background
  and label colour follow the band: red / amber / green) beside a white **Item breakdown**
  card: five rows of item text, a 76×6 track with a coloured fill, and the score.
- **Written answers** — two `#F8FAFC` tiles in a 2-col grid with question label and answer.
- **Add a note for the file** — textarea, min-height 76px, `#F8FAFC`.

Selecting a queue card swaps eyebrow, name, risk banner, score card and both answers.

### View 24 — Brand & booking page settings (`/settings/brand`)

1440×940. Settings sidebar (`SETTINGS` group, five items, `Brand & booking page` active).
Header 88px: eyebrow `Settings`, title, sub-copy, right side "Last published 2 days ago",
ghost **View live page**, navy **Publish changes**.

Left column:
- **Identity** — dashed-border upload row with a 66px logo tile rendered in the current
  palette, "Practice logo / SVG or PNG, up to 2MB. Falls back to your initials." and
  **Upload logo**; then practice name input and a booking-link field showing
  `unclutterdesk.com/booking/` + bold slug; then a welcome-message textarea.
- **Palette** — three 18px-radius swatch cards (large primary block + 44px accent square,
  name, descriptor). Selected: `inset 0 0 0 2px #0F3A53, 0 10px 28px rgba(15,23,42,.1)`;
  unselected `inset 0 0 0 1px #E2E8F0`. Below, read-only Primary and Accent hex fields
  with 28px swatches.
- **What clients see** — three toggle rows separated by `#F1F5F9` hairlines: show photo
  and bio (on), show session price up front (on), hide the unclutterOS badge (off,
  "Pro and Group Clinic only"). Toggle 40×22, on `#15803D`, off `#E2E8F0`, 16px knob.

**Live preview column 400px**, sticky: eyebrow `LIVE PREVIEW` + amber `UNPUBLISHED` pill;
a 22px-radius browser card (34px `#F1F5F9` chrome bar with three 8px dots and the URL),
a brand-primary header block (42px accent logo tile, `BOOK A SESSION WITH` eyebrow in
accent, practitioner name, welcome copy at 72% white), then the booking body: step 1
row with price, three 58px day tiles (selected one filled with the primary, its label in
accent), two time slots, an accent **Continue to payment** bar, and a
"Powered by unclutterOS" footer at 50% opacity. Every primary/accent surface here reads
from the chosen palette.

### View 25 — Availability & blocked time (`/settings/availability`)

1440×900. Settings sidebar with `Availability` active. Header 88px; the sub-line is
computed: `N working days · M bookable slots a week`. Navy **Save availability**.

**Weekly hours card** — seven day rows, 16px radius, 14/16px padding. Each row: a
150px toggle+label group (40×22 switch, on `#15803D` knob at `left:21px`, off `#E2E8F0`
knob at `left:3px`; label 14px/700 `#0F172A` when on, `#94A3B8` when off) and, when on,
time-window inputs (92×42, `to` separators, a 22px `+` chip to add a second window) with
a right-aligned slot count. When off the row background drops to transparent and shows
`Unavailable` in `#94A3B8`. Defaults: Mon–Fri on (Mon 09:00–13:00 + 14:00–17:00,
Fri 09:00–15:00), Sat/Sun off. Slot weights: Mon 7, Tue/Wed/Thu 8, Fri 6, Sat/Sun 4.

**Blocked time card** — header with a dashed **Block time off** button; rows with 36px
tinted icon tiles: "Annual leave · 24 — 31 August · all day" (amber) and
"Supervision · Every other Wednesday · 15:00 — 16:00" (navy), each with a `···` menu.

Right column 340px:
- Slate **THIS GIVES YOU** card — live slot count 38px/800 + "bookable slots a week";
  below the rule, either the revenue line ("At ₦35,000 a session, a half-full week is
  about ₦N a month", computed as `round(slots/2) × 35,000`, `en-NG` grouped) or, at zero
  slots, "No bookable slots — clients can't book until you turn a day on."
- **Booking rules** — session length, gap between sessions, shortest notice selects, plus
  a "Let clients reschedule / Up to 24 hours before" toggle.
- Amber note: six sessions already booked in the edited windows.

### View 26 — Empty, error & offline states

1440-wide board, 30px padding, 2-col grid, 20px gap. Each state sits in a white 22px
card with a `#F8FAFC` label bar (9.5px/900/.16em eyebrow).

| Card | Content |
|---|---|
| EMPTY — CLIENTS | 70px `#EFF6FB` user-plus tile, "No clients yet", explanation, **Add a client** + primary action |
| EMPTY — SCHEDULE | 70px `#FEF3C7` calendar tile, empty-week copy and CTA |
| EMPTY — ANALYTICS | ghost bar chart at 35% opacity, "not enough data yet" copy |
| 404 — PAGE NOT FOUND | `404` 64px/800, "This page has moved on", **Go back** + **Take me to my dashboard** |
| SESSION — CONNECTION LOST | full-width `#0B1220` card: 74px rose wifi-off tile, "Reconnecting to the session…" 24px/700 white, reassurance copy (client still sees the room; notes saved to 10:24), a 280×5 progress track at 62% filled gold, **Switch to audio only** (ghost) and **Leave session** (`#E11D48`) |

### View 27 — My profile (`/profile`)

1440×940. Sidebar carries two groups: `ACCOUNT` (My profile — active, Account &
preferences, Notifications) and `PRACTICE` (Brand & booking page, Availability, Team &
staff). Header 88px: "My profile" / "What clients see when they book with you",
"Saved 4 minutes ago", ghost **Preview public profile**, navy **Save changes**.

Left column:
- **Identity card** — 92px navy tile with gold initials (26px radius), name 22px/700,
  "Clinical Psychologist · Owner · joined March 2024", **Change photo** + muted
  **Remove** (hover `#DC2626`); right, a green `#ECFDF5` pill "Accepting new clients".
- **Tabs** `Details` / `Credentials` in the standard `#EEF2F7` track.
- **Details** — Personal details card: full name, display title, professional role, phone
  in a 2-col grid; bio textarea (min-height 96px) with a counter line
  "Shown on your booking page. 232 of 600 characters." Then Specialties & languages:
  removable 34px pills (`Anxiety`, `Burnout`, `Trauma (EMDR)`, `Life transitions`, `Grief`;
  languages English, Yoruba) each with a `×`, plus a dashed `+ Add` pill that turns navy
  on hover.
- **Credentials** — three rows (42px white award tile, name, issuing body + date, status
  pill): PhD Clinical Psychology and NAP Licence #NG-4417 `VERIFIED` (green), EMDR Level II
  `IN REVIEW` (amber); then a dashed **+ Add a credential** row. Below, Insurance &
  indemnity: provider and cover-expiry fields.

Right column 352px:
- **Profile strength** — 82%, 8px track filled navy, four checklist rows (20px tinted
  mark chips; done rows green `✓` with `#334155` text, pending row grey `–` with `#94A3B8`).
- **Public profile** — navy gradient card, gold eyebrow, `unclutterdesk.com/dr-smith`,
  "214 visits in the last 30 days, 19 of them booked", ghost **Copy link**.
- **Session types you offer** — three `#F8FAFC` rows: Individual 50 min ₦35,000,
  Couples 80 min ₦55,000, First consultation 20 min **Free** (green).

### View 28 — Account & preferences (`/settings/account`)

1440×1010. Same two-group sidebar with `Account & preferences` active. Header 88px:
"Sign-in, security, and how dates and money are shown to you",
"Changes apply to your account only", navy **Save preferences**.

Left column:
- **Sign-in** — three 20px rows on `#F8FAFC` with 1px borders: email
  (`jane@drjanesmith.com` + green `VERIFIED` pill + **Change**), password
  ("Last changed 3 months ago" + **Change password**), two-factor authentication
  ("Authenticator app · required for clinical records") with a live 52×30 toggle
  (track navy on / `#CBD5E1` off, 24px knob, `transform` transition 180ms).
- **Region & language** — 2-col grid of selects: Language (English (Nigeria) / UK / US /
  Français), Country (Nigeria, Ghana, Kenya, United Kingdom, United States), Time zone
  (GMT+1 Lagos, GMT+0 London, GMT+3 Nairobi), Currency (NGN ₦ / GHS ₵ / GBP £ / USD $).
  Below, an `#F1F5F9` info strip: clients are always billed in the booking-page currency;
  this setting only converts what the practitioner sees in reports.
- **Date, time & numbers** — chip groups, 42px, selected navy with
  `0 6px 16px rgba(15,58,83,.22)`, unselected white on `#E2E8F0`:
  Date format `DD/MM/YYYY` · `MM/DD/YYYY` · `YYYY-MM-DD` · `14 Aug 2026`;
  Time format `24-hour` / `12-hour`; Week starts on `Monday` / `Sunday`;
  Number format `1,234.56` / `1.234,56`.
- **Danger zone** — "Clinical records are retained for 7 years regardless.",
  **Export my data** and a red-outlined **Deactivate account**.

Right column 352px:
- **Preview** navy-gradient card, gold `PREVIEW` eyebrow, three stacked rows separated by
  12%-white rules: Next session (`{date} · {time}` in the chosen formats), This month's
  revenue (₦412,000 / ₵5,940 / £3,180 / $4,020 by currency), Week view starts.
  Values 19px/700 white, labels 11px `#94A3B8`.
- **Notification channels** — four 48×28 toggles: Email ("Bookings, payments, forms"),
  Push ("Browser and mobile app"), SMS ("Charged per message", off), Weekly digest
  ("Sundays, 18:00"). Note: "Full controls in Notifications settings."
- **Active sessions** — MacBook Pro · Lagos (green dot, "This device · active now") and
  iPhone 14 · Lagos (grey dot, "Last active 6 hours ago") with a red **Sign out** link.

### View 29 — Notifications (`/notifications`)

1440×1000. Main app sidebar (Dashboard, Schedule, Clients, Billing, **Notifications**
active with a gold unread-count badge, Settings).

**Header 88px** (`position:relative; z-index:5`): title block left; right, a 260px search
field (inert), the **bell** (46px, 14px radius, `#E2E8F0` border, background `#F1F5F9`
when open) with a `#DC2626` count badge at `top/right:-4px` ringed 2px white, and a 46px
navy avatar.

**Dropdown** — anchored `top:56px; right:0`, 412px wide, 22px radius, white,
`0 24px 80px rgba(15,23,42,.24)`, toggled by the bell. Head: "Notifications", amber
"N new" pill, **Mark all read** link. Body max-height 352px, scrolls: rows of 36px tinted
icon tile, `**Actor** body copy` at 13.5px, timestamp 11.5px, and an 8px gold dot when
unread; unread rows sit on `#FFFDF6`, read rows white, hover `#F8FAFC`. Footer: centred
**View all notifications**.

**Page body** — filter tabs `All · Unread · Bookings · Billing · Clinical · Team` in the
standard track, **Mark all as read** link and a ghost **Notification settings** button.
Below, groups (`TODAY`, `EARLIER THIS WEEK`) of 20px-radius rows: 42px tinted icon tile,
title + body, `time · category` meta, a per-row action button and the unread dot.
Unread cards are white; read cards `#FBFCFD`. When a filter matches nothing, a dashed
empty card appears: "Nothing here / You're caught up on this filter."

Icon tones: navy `#EEF2F7`/`#0F3A53` (bookings, forms, messages), amber
`#FEF3C7`/`#92400E` (reschedule request), red `#FEF2F2`/`#DC2626` (payment failure, risk
flag), green `#ECFDF5`/`#059669` (team joined, payout sent).

Right column 320px:
- **Needs a decision** — amber tile "2 reschedule requests / Oldest is 19 hours old" and
  red tile "1 failed payment / Retry runs automatically in 2 days".
- **Quiet hours** — "No push or SMS between 21:00 and 07:00. Urgent flags still come
  through." with 21:00 / to / 07:00 fields.

Seed notification data (id, group, unread, category, actor, body, time, action):

1. Today · unread · Bookings — Amara Okafor booked an individual session for Friday 14 Aug, 10:00 · 12 minutes ago · View booking
2. Today · unread · Bookings — Tunde Bello requested to move Thursday's session to next week · 1 hour ago · Respond
3. Today · unread · Billing — Payment failed: Chidera Nwosu's card was declined for invoice INV-0241 · 3 hours ago · Retry
4. Today · read · Forms — PHQ-9 submitted by Amara Okafor. Score 14 — moderate · 5 hours ago · Review
5. Earlier · unread · Clinical — Risk flag raised on Ifeoma Eze's intake form. Item 9 answered above threshold · Yesterday, 18:40 · Open file
6. Earlier · read · Team — Dr. Kola Adeyemi accepted your invitation and joined the practice · Yesterday, 09:12 · View roster
7. Earlier · read · Billing — Payout sent: ₦412,000 arrived in your GTBank account · Tuesday, 08:00 · See statement
8. Earlier · read · Messages — Amara Okafor replied to your session note request · Monday, 16:22 · Open

---

## Interactions & Behaviour

Demonstrated in the prototypes:

- **Portal tabs** (21) — Upcoming / Past sessions / Payments swap the panel below.
- **Queue selection** (23) — picking a submission swaps the whole detail pane, including
  whether the risk banner renders and the score card's colour band.
- **Palette picker** (24) — selecting a pairing restyles every primary/accent surface in
  the live preview immediately; publishing is a separate explicit action, so the preview
  carries an `UNPUBLISHED` badge until then.
- **Day toggles** (25) — flipping a day hides/shows its time windows, recolours the row,
  and recomputes both the header summary and the slot count and revenue projection;
  at zero slots the projection is replaced by the "clients can't book" line.
- **Profile tabs** (27) — Details / Credentials.
- **Preference chips and currency select** (28) — every change re-renders the preview card
  (date, time, revenue, week start). 2FA and the four channel toggles animate their knob
  with a 180ms transform transition.
- **Bell** (29) — toggles the dropdown; **Mark all read** (in either the dropdown or the
  page) clears every unread flag, which drops the badge count, the gold dots and the
  unread row tint. Filter tabs narrow the list and can produce the empty state.

Not built, needs product decisions: real-time push delivery, notification pagination,
per-notification dismissal, timezone-aware relative timestamps, currency conversion
rates, credential verification workflow, and photo upload/crop.

## State

Set 04 (`Component` in Screens IV):

```
ptab    : 'upcoming' | 'past' | 'billing'      // View 21
queue   : 0 | 1 | 2                            // View 23 selected submission
palette : 'navy' | 'forest' | 'plum'           // View 24
days    : { mon..sun: boolean }                // View 25
```

Set 05 (`Component` in Screens V):

```
profTab  : 'Details' | 'Credentials'
dateFmt  : 'DD/MM/YYYY' | 'MM/DD/YYYY' | 'YYYY-MM-DD' | '14 Aug 2026'
timeFmt  : '24-hour' | '12-hour'
week     : 'Monday' | 'Sunday'
numFmt   : '1,234.56' | '1.234,56'
currency : 'NGN' | 'GHS' | 'GBP' | 'USD'
tfa      : boolean
channels : { email, push, sms, digest: boolean }
bellOpen : boolean
notifTab : 'All' | 'Unread' | 'Bookings' | 'Billing' | 'Clinical' | 'Team'
read     : { [notificationId]: true }
```

Data the real implementation needs: client sessions, invoices and outstanding forms (21);
appointment, last session note, latest assessment and device/waiting-room status (22);
submission queue with scores, item breakdowns and risk flags (23); practice brand record
and booking-page config (24); availability windows, blocked time and booking rules (25);
practitioner profile, credentials and account preferences (27–28); a notification feed
with read state and per-user channel preferences (29).

## Assets

- `assets/unclutterdesk-mark.svg` — product mark, used at 14–34px with a 5–10px radius.
- `assets/unclutterdesk-lockup.svg` — full lockup (not used in these views, included for reference).
- `tokens/colors_and_type.css`, `tokens/unclutterdesk.css` — token stylesheets referenced by
  the prototypes.
- **Outfit** from Google Fonts, weights 300–900.
- Icons are inline SVG in the Lucide style: 24×24 viewBox, `stroke-width` 2 (1.8 for
  large empty-state glyphs, 2.2–2.6 for small or emphatic ones), round caps and joins.
  Use Lucide in the real implementation.
- Client photos are initials tiles throughout — no photography.

## Files

```
design_handoff_unclutterdesk_screens_4_5/
├── README.md
├── Unclutter Desk Screens IV.dc.html     ← views 21–26
├── Unclutter Desk Screens V.dc.html      ← views 27–29
├── support.js                          ← template runtime (must sit beside the HTML)
├── assets/
│   ├── unclutterdesk-mark.svg
│   └── unclutterdesk-lockup.svg
└── tokens/
    ├── colors_and_type.css
    └── unclutterdesk.css
```

Open either `.dc.html` directly in a browser to see all its screens on one canvas.
