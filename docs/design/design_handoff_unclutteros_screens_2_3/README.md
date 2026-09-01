# Handoff: Unclutter Desk — Screens Set 02 & Set 03 (Views 07–20)

## Overview

Unclutter Desk is a B2B practice-management and white-label telehealth platform for
therapists in Nigeria. Therapists run their practice inside the OS (schedule,
clients, clinical notes, telehealth, billing); their clients book and pay through a
booking portal branded to the therapist, not to unclutterOS.

This bundle covers **fourteen screens across two files**:

**Set 02 — `Unclutter Desk Screens II.dc.html`**
| View | Screen | Route |
|---|---|---|
| 07 | Telehealth video session room | `/session/:id` |
| 08 | Client clinical file & notes | `/clients/:id` |
| 09 | Team & staff roster | `/settings/team` |
| 10 | Subscription & bank payout settings | `/settings/billing` |
| 11 | Staff email invite claim | `/invite/claim` |
| 12 | First-time therapist onboarding wizard | `/onboarding` |

**Set 03 — `Unclutter Desk Screens III.dc.html`**
| View | Screen | Route |
|---|---|---|
| 13 | Form & assessment templates manager | `/settings/forms` |
| 14 | Drag-and-drop form editor | `/settings/forms/:id` |
| 15 | Public inactive-practice fallback | `/booking/:slug` (paused) |
| 16 | Practitioner & staff login | `/login` |
| 17 | Practice registration | `/register` |
| 18 | Forgot password | `/forgot-password` |
| 19 | Set new password | `/reset-password/:token` |
| 20 | Email verification notice | `/verify-email` |

Sets 01 (dashboard, booking portal, schedule, clients, analytics, booking confirmed),
the desktop prototype and the mobile screens ship in a separate bundle
(`design_handoff_unclutterdesk`).

## About the Design Files

The `.dc.html` files in this bundle are **design references created in HTML** —
prototypes showing the intended look and behaviour, not production code to copy.
Each file opens directly in a browser (`support.js` must sit next to it) and lays out
its screens on a single scrollable canvas, one section per view.

The task is to **recreate these designs in the target codebase's environment** —
React, Vue, SwiftUI, native, whatever is already in place — using its established
patterns, component library and routing. If no environment exists yet, choose the
framework that fits the project and implement there. Do not ship the HTML.

Note the HTML uses a small template runtime (`<sc-if>`, `{{ value }}` holes, a
`Component` logic class). Those are authoring conveniences for the prototype; treat
them as ordinary conditional rendering and component state in your framework.

## Fidelity

**High fidelity.** Colours, type sizes, radii, spacing and shadows in these files are
final and should be matched. Copy is final unless a product owner changes it.
Interactions are demonstrated where they matter (drawer toggle, tabs, modal, plan
selection, wizard steps, category filter, form toggles, auth success states); every
other control is styled but inert and needs real wiring.

## Design Tokens

### Colour

| Token | Hex | Use |
|---|---|---|
| Slate (chrome) | `#0F172A` | Sidebar, auth backdrops, dark cards |
| Deep navy (brand) | `#0F3A53` | Primary buttons, active nav, brand surfaces |
| Navy light | `#1B5375` | Gradient partner to navy, avatars |
| Warm gold (accent) | `#E3B341` | Badges, active markers, secondary CTA, accent rules |
| Canvas | `#E7EDF2` | Page background behind screen frames |
| App background | `#F8FAFC` | Screen body |
| Surface | `#FFFFFF` | Cards, headers, panels |
| Muted surface | `#F1F5F9` / `#EEF2F7` | Inputs, tab tracks, chips |
| Border | `#E2E8F0` | All 1px borders |
| Divider (light) | `#F1F5F9` | Table row separators |
| Text primary | `#0F172A` | |
| Text secondary | `#475569` | Body copy |
| Text muted | `#64748B` | Sub-copy |
| Text faint | `#94A3B8` | Eyebrows, placeholders |
| Success | `#15803D` on `#DCFCE7` | Active toggles, PAID, VERIFIED |
| Warning | `#92400E` on `#FEF3C7` | Assessment pills, pending, paused |
| Danger | `#B91C1C` on `#FEE2E2` | No-show, risk item, retried |
| Danger solid | `#E11D48` | End-call button |
| Live green | `#34D399` | Session live dot, audio bars |
| Purple | `#6D28D9` on `#EDE9FE` | Consent category, admin avatar |

Session-room canvas gradient:
`radial-gradient(120% 120% at 30% 20%, #1E3448 0%, #101A28 60%, #0B1220 100%)`
Brand header gradient: `linear-gradient(135deg, #0F3A53, #1B5375)`
Active sidebar item: `linear-gradient(90deg, rgba(15,58,83,.9), rgba(27,83,117,.55))`
with `inset 0 0 0 1px rgba(227,179,65,.28)` and a 3×20px gold tab at `left:0`.

### Typography

**Outfit** throughout (Google Fonts, weights 300–900), `-webkit-font-smoothing: antialiased`.

| Role | Size / weight / tracking |
|---|---|
| Auth headline | 42px / 700 / -.04em / line-height 1.12 |
| Auth form heading | 29px / 700 / -.03em |
| Wizard step heading | 27px / 700 / -.03em |
| Card / modal heading | 25px / 700 / -.03em |
| Page title (header) | 20px / 700 / -.02em |
| Section heading | 16px / 700 / -.01em |
| Card title | 15.5px / 700 / -.01em |
| Button label | 13–15px / 700 |
| Body | 13–14.5px / 400–500, line-height 1.6 |
| Field label | 11.5px / 700 |
| Eyebrow | 9px / 900 / .22em / uppercase |
| Pill / badge | 9–10px / 900 / .10–.14em / uppercase |
| Stat value | 22–34px / 800 / -.03em to -.04em |

### Radius

Screen frame 24px · cards 24px · auth card 24px · modal 26px · wizard panel 26px ·
inner panels 18–22px · inputs and buttons 13–16px · icon containers 10–17px ·
pills 999px · toggles 999px.

### Shadow

| Use | Value |
|---|---|
| Screen frame | `0 24px 80px rgba(15,23,42,.14)` |
| Session frame | `0 24px 80px rgba(15,23,42,.24)` |
| Card | `0 8px 26px rgba(15,23,42,.05)` |
| Raised card | `0 14px 40px rgba(15,23,42,.07)` |
| Auth card on slate | `0 30px 80px rgba(0,0,0,.4)` |
| Modal | `0 30px 90px rgba(15,23,42,.4)` |
| Navy button | `0 8px 22px rgba(15,58,83,.24)` (large: `0 10px 26px rgba(15,58,83,.26)`) |
| Gold button | `0 10px 26px rgba(227,179,65,.3)` |
| Danger button | `0 10px 26px rgba(225,29,72,.4)` |
| Floating control bar | `0 24px 60px rgba(0,0,0,.5)`, `inset 0 0 0 1px rgba(255,255,255,.1)` |
| Selected card ring | `inset 0 0 0 2px <accent>, 0 12px 34px rgba(15,23,42,.12)` |
| Drawer | `-20px 0 50px rgba(0,0,0,.35)` |

### Spacing

Screen width 1440px. Sidebar 248px (icon rail variant 76px). Header height 70/80/88px.
Content padding 24–26px horizontal, 22–34px vertical. Card padding 22–26px.
Grid and flex gaps 8 / 10 / 12 / 14 / 16 / 20px. Control heights: input 44–52px,
button 40–54px, sidebar item 44px, table row padding 15–16px vertical.

**All sibling groups use flex/grid with `gap`.** No margin-based spacing between
siblings, no inline-flow spacing.

---

## Screens

### View 07 — Telehealth session room (`/session/:id`)

Full-bleed dark room, 1440×860, `#0B1220`. Two columns: stage (flex 1) and a
collapsible notes drawer (396px, `#F8FAFC`).

**Stage header** (66px, gradient fade `rgba(11,18,32,.92)` → transparent): a live pill
(green 7px dot + `LIVE · 00:24:18`, 11.5px/700), client name (15px/600) with
`Individual therapy · 50 min · Session #7` beneath (11.5px, `#64748B`), and at the
right two pills — `END-TO-END ENCRYPTED` (green on `rgba(52,211,153,.12)`, lock icon)
and `HD · 1080p` (gold on `rgba(227,179,65,.14)`).

**Video canvas**: inset 20px sides, 132px bottom clearance for the control bar, radius
22px, the radial gradient above, `inset 0 0 0 1px rgba(255,255,255,.06)`. Centred:
150px circular avatar (`linear-gradient(140deg,#1B5375,#0F3A53)`, gold 48px initials,
`inset 0 0 0 2px rgba(227,179,65,.3)`), name 19px/600, `Client camera feed · speaking`,
then a five-bar green audio meter (4px wide bars, heights 9/20/14/24/11px).
Therapist PiP top-right: 236×150, radius 18px, `linear-gradient(150deg,#243B52,#14202F)`,
60px navy avatar, and a bottom-left "You" chip with a gold mic icon.
Bottom-left of the canvas, a 32px pill: gold dot +
"Session is being documented — notes autosave to Amara's clinical file".

**Floating control bar**: absolutely positioned, `bottom:28px`, horizontally centred,
`rgba(23,33,48,.72)` + `backdrop-filter: blur(18px)`, radius 22px, padding 12px 14px,
gap 10px. Five 74px-wide stacks (52px rounded-16px icon tile over a 10px/700/.08em
caption): MUTE, CAMERA, SHARE, CHAT (gold count badge "2"), NOTES. Idle tile
`rgba(255,255,255,.1)`, hover `rgba(255,255,255,.18)`; the NOTES tile is gold with
slate icon while the drawer is open. Then a 1px×44px divider and the **End session**
button: 52px, padding 0 22px, `#E11D48`, white 14.5px/700, `white-space: nowrap`,
phone-off icon, hover `#BE123C`.

**Notes drawer**: white header with eyebrow `LIVE DOCUMENTATION`, title `SOAP Notes`
(17px/700) and a chevron collapse button; below it two score tiles side by side —
PHQ-9 `14 Moderate` on `#FEF3C7` with `inset 0 0 0 1px rgba(227,179,65,.4)`, GAD-7
`9 Mild` on `#F1F5F9`. Body scrolls: four white cards (radius 18px, 1px border), each
headed by a 24px rounded-8px letter chip — S/O/A navy with gold letter, P gold with
slate letter — and a label (12.5px/700/.02em), then an autosizing borderless
`textarea` (13px, line-height 1.55) holding the note text. Footer: "Autosaved 12s ago",
a **Templates** ghost button and a **Sign & lock** navy button.

Interaction: NOTES tile and the drawer chevron both toggle `drawerOpen` (default true).
When closed the stage takes the full width.

### View 08 — Client clinical file (`/clients/:id`)

76px slate icon rail (logo, four 46×44 icon tiles, active tile carries the navy
gradient + gold left tab and gold icon, avatar pinned bottom), then the main column.

**Header** (70px): breadcrumb `Clients › Amara Okoye`, right-aligned **Export file**
ghost button and **Start session** navy button.

**Summary card**: 76px rounded-22px avatar (navy gradient, gold `AO`), name 22px/700
with an `ACTIVE` green pill, email and phone (13px, line-height 1.6), then a
four-column stat grid — TOTAL SESSIONS `7`, CLIENT SINCE `Mar 2026`, NEXT SESSION
`Fri, 10:00` on `#F8FAFC`, and EMERGENCY CONTACT (`Chidi Okoye · Brother · 0803 552 8814`)
on `#FEF3C7`. Each tile: radius 16px, `inset 0 0 0 1px` border, 9px/900/.16em label.

**Tabs**: a 5px-padded `#EEF2F7` track, three 40px pill buttons. Active = white
background, `#0F172A` text, `0 2px 8px rgba(15,23,42,.1)`; inactive = transparent,
`#64748B`. Default `Session history`.

*Session history* — a timeline: 96px right-aligned date column (13px/700 date, 11.5px
time), a 16px rail with an 11px dot (gold + `0 0 0 4px rgba(227,179,65,.2)` for the
latest, `#CBD5E1` for past, `#FCA5A5` for the no-show) and a 2px `#E2E8F0` connector,
then the entry: title 14.5px/700 with status pills (`COMPLETED`, `NOTE SIGNED`,
`NO SHOW`) and a 13px summary capped at 720px.

*SOAP notes* — a two-column split. Left card: header (`Session #7 note`, `31 July 2026 ·
signed by Dr. Jane Smith`), an **Export PDF** ghost button with a red file icon and a
gold **Save note** button, then the four S/O/A/P blocks (same chips as View 07, 18px
radius, 1px border). Right column 300px: *Note history* list (selected item on
`#EFF6FB` with `inset 0 0 0 1px rgba(15,58,83,.14)`) and a slate *PHQ-9 trend* card
with seven bars (`rgba(255,255,255,.16)`, latest gold) and `18 at intake → 14 today`.

*Intake answers* — header with a `PHQ-9 · 18 MODERATELY SEVERE` amber pill, then a
two-column grid of Q&A tiles (`#F8FAFC`, radius 18px, question 12.5px/700 `#475569`,
answer 13.5px `#0F172A`). The self-harm item uses `#FEF2F7`/`#FECACA`/`#B91C1C`.

### View 09 — Team & staff roster (`/settings/team`)

Settings sidebar (`SETTINGS` group label, five items, Team & staff active with a gold
count `5`). Header 88px: eyebrow, title, `5 of 10 seats used on Group Clinic`, and a
navy **Invite staff member** button (user-plus icon).

**Table**: white card, radius 24px, `overflow: hidden`. Grid template
`2.2fr 1.4fr 1fr 1fr .5fr`, gap 16px, header row on `#F8FAFC` with 9.5px/900/.16em
labels (MEMBER, EMAIL, ROLE, STATUS, ·). Five rows, 16px 24px padding, separated by
`1px #F1F5F9`:

| Member | Email | Role pill | Status |
|---|---|---|---|
| Dr. Jane Smith — Clinical psychologist · You | jane@ | `OWNER` slate bg / gold text | Active |
| Tolu Adeyemi — Practice manager | tolu@ | `ADMIN` `#EFF6FB`/navy | Active |
| Nkem Eze — Counselling psychologist | nkem@ | `THERAPIST` `#F1F5F9` | Active |
| Blessing Musa — Front desk | blessing@ | `RECEPTIONIST` `#F1F5F9` | Active |
| Segun Oyelaran + `INVITE PENDING` — Invited 2 days ago | segun@ (faint) | `THERAPIST` outline | Inactive |

Avatar: 40px, radius 13px, initials 13.5px/700 — owner navy gradient with gold text,
others tinted (`#EDE9FE`/`#DCFCE7`/`#FEF3C7`/`#F1F5F9`). Status toggle: 40×22px pill,
`#15803D` on / `#E2E8F0` off, 16px white knob at 3px from the active edge, label
`Active`/`Inactive` in the matching colour. Row end: a `···` overflow affordance.

**Invite modal**: full-frame scrim `rgba(15,23,42,.5)` + `blur(3px)`, centred 490px
white card, radius 26px, padding 28px 30px 26px. Eyebrow `TEAM`, title
`Invite a staff member` 21px/700, sub "They'll get an email link to set their own
password.", a 34px close button. Fields: **Work email** input (placeholder
`name@smiththerapy.ng`) and a **Role** select with three options —
`Therapist — sees only their own clients`, `Receptionist — books and reschedules, no
notes`, `Admin — full practice access, no billing`. Info panel on `#EFF6FB` with an
info icon: "Therapists can only open the clinical files of clients assigned to them.
You can change this later." Footer: **Cancel** (flex 1) and **Send invite** (flex 1.4,
navy). Open by default in the spec board; ships closed.

### View 10 — Subscription & payouts (`/settings/billing`)

Header 88px with `Next charge ₦25,000 on 1 September 2026` and a green
`Payouts active` pill.

**Plans**: three-column grid, radius 24px, padding 24px, selectable.
- *Starter* — white, `FREE` grey pill, `₦0/month`, 1 practitioner · 20 sessions a month ·
  Booking page with unclutterOS badge · (faint) No telehealth room.
- *Pro* — slate `#0F172A`, `₦25,000/month`, badge top-right reading `CURRENT PLAN`
  when selected and `MOST POPULAR` otherwise (gold pill, absolutely positioned
  `top:24px; right:24px`). Features in `#CBD5E1`.
- *Group Clinic* — white, `₦75,000/month`, up to 10 practitioners · roles &
  receptionists · clinic-wide analytics · priority support, plus a full-width gold
  **Upgrade plan** button.

Selected ring: `inset 0 0 0 2px` (gold for Pro, navy for the white cards) +
`0 12px 34px rgba(15,23,42,.12)`; unselected `inset 0 0 0 1px #E2E8F0, 0 6px 20px
rgba(15,23,42,.05)`. Pro selected by default.

**Payout account** (456px card): title with a green `VERIFIED` check pill, sub "Client
payments settle here via your Paystack subaccount.", then a navy `#0F3A53` card —
`GTBANK` gold eyebrow, `SUBACCOUNT ACCT_9f2k`, `•••• •••• 4192` at 22px/700/.12em,
`Smith Therapy Ltd · Lagos`. Below, two read-only inputs (Bank name `Guaranty Trust
Bank`, Account number `0123 4192`) and two buttons: **Change account** (ghost) and
**View settlements** (navy).

**Invoice history**: grid `1.1fr 1.4fr .9fr .9fr .7fr`. Rows — 1 Aug 2026 Pro monthly
₦25,000 PAID; 1 Jul 2026 PAID; 1 Jun 2026 `RETRIED` (red pill); 1 May 2026
`Starter → Pro upgrade` PAID. Each row ends with a right-aligned **Download** link
(12.5px/700 navy).

### View 11 — Staff invite claim (`/invite/claim`)

1440×900 split. **Left 520px slate panel**, padding 48px 44px, with a
`radial-gradient(circle, rgba(227,179,65,.16), transparent 68%)` bloom bottom-right.
Top: 40px gold `ST` clinic monogram + `Smith Therapy Ltd` / `Lagos, Nigeria`. Centre:
gold eyebrow `YOU'VE BEEN INVITED`, headline 38px/700/-.035em
"You've been invited to join Smith Therapy Ltd", sub-copy naming the inviter and the
role in gold, then three gold-check bullets (own booking link, telehealth room with
live SOAP notes, only assigned clients). Footer: mark + "Powered by unclutterOS ·
invite expires in 5 days".

**Right panel**: centred 520px white card, radius 26px. Title `Set up your account`,
sub "Takes about a minute." Avatar uploader: dashed `#CBD5E1` 20px-radius row, 66px
icon tile, "Profile photo", "JPG or PNG, up to 2MB. Clients see this on your booking
page.", **Choose file** button. Then Full name / Title (two-up), a locked Email row
(`#F1F5F9` with a `LOCKED` chip), Create password / Confirm password (two-up), a 5px
strength bar at 72% green with the label `Strong`, a 52px navy **Join Smith Therapy
Ltd** button, and 11.5px terms microcopy.

### View 12 — Onboarding wizard (`/onboarding`)

1440×900. Header 76px: mark + wordmark, `Step N of 3`, `Finish later` link.

**Progress**: 820px row — three 40px rounded-14px markers with 12px/700 captions,
joined by 3px bars. Marker states: upcoming `#EEF2F7`/`#94A3B8`, active `#0F3A53`/white,
complete gold/slate; the connector turns gold once passed; caption `#0F172A` when
active or complete.

*Step 1 — Practice brand.* 920px panel, radius 26px. Eyebrow `STEP ONE`, heading
"Let's make it yours." 27px/700, sub "Your clients only ever see your name and colours.
unclutterOS stays out of the way." Left: Practice name (`Smith Therapy`), booking link
row (`unclutterdesk.com/booking/` faint + `dr-smith` bold + green `AVAILABLE` pill),
Brand colour `#0F3A53` and Accent `#E3B341` swatch rows. Right 328px: a live booking-page
preview — 96px navy gradient header (`BOOK A SESSION` gold eyebrow + practice name),
skeleton lines, two buttons and a gold CTA bar. Footer: "You can change all of this
later in Brand settings." + **Continue**.

*Step 2 — Availability & rates.* Day chips (52×44, navy = working, `#F1F5F9` = off;
Mon–Fri on), Day starts `09:00` / Day ends `17:00`, Session length select (50/30/80
minutes), Rate per session `₦35,000`. Right 328px summary: `THIS GIVES YOU`,
`40` bookable slots a week, "At ₦35,000 a session, a half-full week is about ₦700,000
a month.", and an amber note about breaks and blocked time. **Back** + **Continue**.

*Step 3 — Share booking link.* Heading "You're open for bookings." A slate link bar
(gold eyebrow `YOUR BOOKING LINK`, url 18px/600 white) with a gold **Copy link**
button. Below: a 340px browser-chrome preview of the live booking page (three date
tiles with Tue selected, two time slots, gold `Continue to payment` bar) beside three
status rows — two green checks (`Brand saved`, `40 slots a week open`) and one amber
card "One thing left — connect your bank" with a `Connect payout account` link.
**Back** + gold **Go to my dashboard**.

### View 13 — Form & assessment templates (`/settings/forms`)

Settings sidebar with `Forms & assessments` active (gold count `6`). Header 88px:
title `Form & assessment templates`, sub "Sent automatically before sessions, or
shared as a link", navy **Create custom form** button (plus icon).

**Category tabs**: same `#EEF2F7` track as View 08 but 38px tall with 11px/900/.12em
uppercase labels — ALL, INTAKE, ASSESSMENT, FEEDBACK, CONSENT. Active = `#0F3A53`
background, white text, `0 4px 12px rgba(15,58,83,.24)`.

**Grid**: three columns, gap 16px, cards radius 24px padding 22px, flex column gap 14px.
Each card: 40px tinted icon tile + title (15.5px/700) + category pill (+ a second
qualifier pill), a 13px description, a stat row (`9 questions`, `0–3 Likert`,
`128 responses` — value bold slate, label `#475569`), then a footer separated by
`1px #F1F5F9` holding an **Edit schema** button and an Active/Inactive toggle (same
40×22 switch as View 09).

- *Pre-Session Client Intake* — navy doc icon, `INTAKE` + `DEFAULT`, 12 questions,
  128 responses. Active.
- *PHQ-9 Depression Scale* — amber chart icon, `ASSESSMENT` + `SCORED`, 9 questions,
  0–3 Likert. Highlighted with `inset 0 0 0 2px #E3B341` and a navy Edit schema button.
  Active.
- *GAD-7 Anxiety Scale* — amber activity icon, `ASSESSMENT` + `SCORED`, 7 questions.
  Active.
- *Informed Consent & Medical History* — purple shield icon, `CONSENT` + `SIGNATURE`,
  8 questions, 1 signature. Active.
- *Post-Session Feedback* — green message icon, `FEEDBACK`, 4 questions, 1–5 scale.
  Inactive by default.
- A dashed **Create a custom form** tile closes the grid.

Interaction: tabs filter which cards render (`ALL` shows every card; the dashed tile
always shows). Each toggle flips that template's own state.

### View 14 — Form editor (`/settings/forms/:id`)

1440×900, `#F1F5F9`, three panes under a 78px header.

**Header**: `← Back to forms` link, divider, a 300px form-title input
(`PHQ-9 Clinical Scale`, 16px/700), a category select (ASSESSMENT / INTAKE / FEEDBACK /
CONSENT, 11px/900/.12em), a gold-dot status `Draft — 3 unsaved changes`, then
**Preview as client** (ghost) and **Save form template** (navy).

**Palette** (250px, white, right border): eyebrow `COMPONENTS`, hint "Drag a block onto
the canvas.", then seven draggable rows (`cursor: grab`, radius 15px, `#F8FAFC`, 1px
border, 30px white icon tile) — Short text, Long text area, Single choice, Multiple
choice, **Likert scale 1–5** (shown selected: `#EFF6FB` with `inset 0 0 0 1.5px #0F3A53`
and a navy tile with gold icon), Digital signature, File upload (`Max 2MB` sub-label).
Bottom: an amber note, "Scored scales keep their 0–3 values. Adding an option won't
break existing responses."

**Canvas** (flex 1, scrolls): heading `Questions` + `9 items · 0–3 Likert · auto-scored
out of 27`, then question cards (radius 20px, 12px gap). Each card has a 20px drag
column (six-dot grip `#CBD5E1`, index number below), a type pill, a right-aligned
`Required` toggle (38×21) and, on the selected card, a delete tile that turns red on
hover. Card 1 is expanded and selected (`inset 0 0 0 2px #0F3A53`): title input plus
four option rows (22px value chip `0`–`3` + a 40px option input) and a dashed
**Add option** button. Cards 2 and 3 are collapsed (title input only; card 2 notes
"Uses the shared 0–3 option set"). Card 9 is the risk item — `RISK ITEM` red pill,
`#FEF2F2` input on `#FECACA`, and the note "Any answer above 0 flags this response for
your review." A 70px dashed **Drop a component here** target closes the list.

**Live preview** (392px, white, left border): header `LIVE PREVIEW` / "What the client
sees" with a green `IN SYNC` pill, then on `#F8FAFC` a client card — navy gradient
header (`BEFORE YOUR SESSION`, form title, `Dr. Jane Smith · about 3 minutes`), the
two-week prompt, Q1 as four radio rows (option 2 selected: `#EFF6FB`,
`inset 0 0 0 1.5px #0F3A53`), Q2 and Q3 as 0–3 segmented rows (Q2 value 2 selected,
navy), a gold **Submit answers** bar and the reassurance line "Your answers go straight
to Dr. Jane Smith and no one else."

### View 15 — Inactive practice fallback (`/booking/:slug`)

1440×760 on `#EFF3F7` with a faint navy radial bloom top-centre. Centred 560px white
card, radius 24px, padding 38px 40px 32px, text-centre. Practice header: 52px navy
`DS` monogram + left-aligned `Dr. Jane Smith Therapy` / `Lagos, Nigeria`. Status block:
`#F8FAFC` panel, 1px border, radius 22px, padding 30px 26px — a 64px amber rounded-20px
badge with a pause-in-circle icon, heading `Bookings temporarily paused` 25px/700, and
the sub-copy (max 420px, `text-wrap: pretty`): "Dr. Jane Smith is not currently
accepting new online bookings. Existing booked sessions remain scheduled and active."
Actions: full-width navy **Contact practice** (mail icon) and a `Return to homepage`
text link. Footer above a `#F1F5F9` rule: 18px mark at 60% opacity + "Powered by
unclutterOS".

### Views 16–17 — AuthShell (login, registration)

A shared split shell: **left 600px slate `#0F172A` panel**, right white form panel.

The panel borrows the Unclutter suite's auth motif (see
`ui_kits/*/auth-login.html` in the design system): two overlapping 300–320px circles
outlined `1.5px #E3B341` at .22 and .14 opacity, one large solid gold circle at
.05–.07 opacity bleeding off a corner, a 12px gold dot at .45, all behind
`position: relative; z-index: 2` content. Logo lockup sits top-left (32px mark +
`unclutter` 18px/600 + gold `OS` pill). The copy block is bottom-aligned above the
footer and opens with a 36×3px gold rule.

Panel text: headline 42px/700/-.04em white; tagline 15.5px `#94A3B8`, line-height 1.7;
footer 12px `#64748B`.

**Login** — headline "Practice management for modern therapists", tagline "Log in to
manage your bookings, clinical SOAP notes, telehealth rooms, and practice branding.",
two gold stats (`1,240+ practices in Nigeria`, `0% platform fee on payouts`) split by a
1px rule, footer "© 2026 unclutterOS Inc.".
Form (404px): `Welcome back` 29px/700, "Enter your credentials to access your practice
workspace."; **Email address** field (52px, mail icon, `#F8FAFC`, 1px `#E2E8F0`, radius
14px); **Password** with a right-aligned `Forgot password?` link in the label row, lock
icon and an eye toggle; a checked "Keep me signed in on this device" row; the 54px navy
**Sign in to practice** button with a right arrow; footer "Don't have a practice
account yet? **Create a practice**".

**Registration** — headline "Start your free 14-day trial", tagline "Build your
white-label booking portal, manage clients, write clinical SOAP notes, and hold
telehealth sessions.", three gold-check bullets, footer "No credit card required.
Cancel anytime."
Form: `Create your practice`, "Setup your practice portal in under 2 minutes.", four
icon fields — Practice / clinic name (`Dr. Jane Smith Therapy`), Your full name
(`Dr. Jane Smith`), Work email address (`jane@smiththerapy.ng`), Password
(`At least 8 characters`) — the 54px navy **Create practice workspace** button, terms
microcopy, and "Already have an account? **Log in**".

### Views 18–20 — Centred auth cards

1440×700 on slate `#0F172A`, the same circle motif scaled up behind a centred 480px
white card (radius 24px, padding 36px 38px 30px, `0 30px 80px rgba(0,0,0,.4)`). Every
card opens with the mark + `unclutterOS` wordmark and closes with a `#F1F5F9` rule.

**18 — Forgot password.** `Reset your password` 25px/700, "Enter your email and we'll
send you a password reset link.", email field, 54px navy **Send reset link**, footer
`← Back to log in`.
Sent state replaces the form with a `#F0FDF4`/`#BBF7D0` panel: 56px `#DCFCE7` check
badge, `Reset email sent` 19px/700, "Check your inbox for instructions. The link is
good for one hour.", and a **Send it again** ghost button.

**19 — Set new password.** `Set new password`, "Create a strong password for your
practice account.", two lock-icon password fields, a 78% green strength bar labelled
`Strong`, 54px navy **Update password**.
Success state: 60px solid `#15803D` check badge, `Password updated` 20px/700,
"Redirecting you to log in…".

**20 — Email verification.** Gold circles swapped for `#34D399` at the same opacities.
64px `#DCFCE7` mail-check badge, `Check your inbox` 25px/700, "We've sent a verification
link to your email address. Click the link in the email to activate your practice
account.", a read-only email chip (50px, `#F8FAFC`, mail icon,
`dr.jane@smiththerapy.com`), the 54px navy **Proceed to dashboard** button with a right
arrow, and the footer "Nothing arrived? **Resend the link** or check your spam folder."

---

## Interactions & Behaviour

Demonstrated in the prototypes:

| Screen | Behaviour |
|---|---|
| 07 | NOTES control and the drawer chevron toggle the notes drawer (open by default); the tile turns gold while open |
| 08 | Three-way tab switch, default `Session history` |
| 09 | **Invite staff member** opens the modal; close, Cancel and Send invite dismiss it |
| 10 | Clicking a plan card selects it (ring + Pro badge label swaps between `CURRENT PLAN` and `MOST POPULAR`) |
| 12 | Continue / Back move between the three steps and drive the progress bar; `Go to my dashboard` returns to step 1 |
| 13 | Category tabs filter the grid; each card's toggle flips independently |
| 18 | **Send reset link** → sent state; **Send it again** → back to the form |
| 19 | **Update password** → success state |

Everything else is styled but inert and needs wiring: search, overflow menus, drag
and drop in the editor, file pickers, PDF export, copy-to-clipboard, all form submits.

Real-implementation notes:
- **Drag and drop (View 14)** — reorder question cards, and drop palette items onto the
  canvas or the dashed target. The prototype shows the resting, hover-target and
  selected states only. Persist order on the schema; renumber indices after each move.
- **Live preview (View 14)** must re-render from the same schema object the canvas
  edits, debounced; the `IN SYNC` pill reflects that state.
- **Autosave (View 07)** — SOAP fields save on a short debounce; surface the relative
  timestamp in the footer. `Sign & lock` makes the note immutable and appends the
  signer and timestamp.
- **Risk flagging (View 14, item 9)** — any PHQ-9 item-9 answer above 0 must flag the
  submitted response for practitioner review.
- **Toggles** animate the knob with a ~160ms ease-out translate; buttons use
  `filter: brightness(1.08–1.1)` on hover and ghost buttons swap to `#F1F5F9`.
- **Session timer** counts up from connection; the live dot pulses.

## State

Per screen, the state the prototypes carry (names as used in the logic classes):

- `drawer: boolean` — session notes drawer (View 07)
- `tab: 'history' | 'notes' | 'intake'` — client file (View 08)
- `invite: boolean` — invite modal (View 09)
- `plan: 'starter' | 'pro' | 'clinic'` — billing (View 10)
- `step: 1 | 2 | 3` — onboarding wizard (View 12)
- `cat: 'all' | 'intake' | 'assessment' | 'feedback' | 'consent'` — template filter (View 13)
- `on: { intake, phq, gad, consent, feed }` — per-template active flags (View 13)
- `fp: 'form' | 'sent'` — forgot password (View 18)
- `np: 'form' | 'done'` — set new password (View 19)

Data the real screens need: session + participant + connection state and a SOAP note
draft (07); client record, session list, note list, intake submission, score history
(08); staff list with roles, status and pending invites, plus seat count (09);
subscription, plan catalogue, Paystack subaccount, invoices (10); invite token and
its clinic/role payload (11); practice profile, availability rules, rate, slug
availability (12); form template list with counts and response totals (13); a single
form schema with ordered questions, types, options and required flags (14); practice
public profile and its active flag (15); the usual auth session, registration,
reset-token and verification-status calls (16–20).

## Assets

- `assets/unclutterdesk-mark.svg` — product mark, used at 18–34px with a 6–10px radius.
- `assets/unclutterdesk-lockup.svg` — horizontal lockup (not used in these views;
  included for completeness).
- Icons are inline Lucide-style SVGs: 2px stroke, `round` caps and joins,
  `currentColor`. Use the real [Lucide](https://lucide.dev) set in implementation —
  mail, lock, eye, video, mic, monitor-up, message-square, file-text, phone-off,
  users, user-plus, calendar, bar-chart, shield-check, activity, grip-vertical,
  trash, chevron-right, arrow-left, arrow-right, check, plus, pause-circle,
  mail-check, upload, download, credit-card, info.
- No photography anywhere; avatars are initials on tinted tiles.
- **Outfit** from Google Fonts, weights 300–900.

## Files

```
Unclutter Desk Screens II.dc.html    Views 07–12
Unclutter Desk Screens III.dc.html   Views 13–20
support.js                        runtime the two HTML files need to open in a browser
assets/unclutterdesk-mark.svg
assets/unclutterdesk-lockup.svg
tokens/colors_and_type.css        Unclutter design-system tokens
tokens/unclutterdesk.css            OS-layer tokens (slate/navy/gold chrome)
```

Open either `.dc.html` directly in a browser with `support.js` beside it. Each screen
is labelled with its view number and route in the canvas.
