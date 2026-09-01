# Handoff: Unclutter Desk Marketing Homepage & Pricing Page

## Overview
A single-scroll B2B SaaS marketing page for **Unclutter Desk** — a practice-management and white-label telehealth platform for therapists in Nigeria. The page's job is conversion: get a therapist to start a 14-day free trial. It runs from sticky nav → hero → value props → interactive feature showcase → pricing → social proof → final CTA → footer, all on one route with anchor navigation. Pricing lives inline on the homepage (`#pricing`) rather than on a separate route.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the intended look, layout, and behavior. They are **not production code to copy directly**. The task is to **recreate these designs in the target codebase's existing environment** (React/Next.js, Vue, Astro, etc.) using its established component library, routing, and styling conventions. If no environment exists yet, pick the framework best suited to a marketing site (a static-first React/Next or Astro setup is a reasonable default) and implement the designs there.

The prototype is authored as a single component with an inline-styled template plus a small logic class holding content arrays and interaction state. In a real codebase, split it into section components (`Nav`, `Hero`, `ValueCards`, `FeatureTabs`, `Pricing`, `Testimonials`, `FinalCta`, `Footer`) and move the content arrays into a CMS or a typed content module.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, radii, shadows, and interaction states are specified. Recreate pixel-perfectly using the codebase's existing libraries and patterns. Values below are exact.

The design is authored at a fixed desktop width (min 1280px canvas, 1280px max content width, 40px gutters). **Responsive breakpoints were not designed** — see "Responsive behavior" for the intended collapse rules, and confirm with design before shipping mobile.

---

## Screens / Views

There is one page. Sections are documented in DOM order.

### 1. Navigation Bar

- **Purpose:** Persistent wayfinding + the primary trial CTA in reach at all times.
- **Layout:** `position: sticky; top: 0; z-index: 50`, full-bleed, height **80px**. Background `rgba(15,23,42,.9)` with `backdrop-filter: blur(18px)` (include `-webkit-` prefix). Bottom border `1px solid rgba(255,255,255,.07)`. Inner rail: `max-width: 1280px; margin: 0 auto; padding: 0 40px; display:flex; align-items:center; gap:40px`.
- **Components:**
  - **Logo lockup** (`<a href="#top">`, flex, `gap:10px`):
    - Gold pill mark: `height:30px; padding:0 11px; border-radius:999px; background:#E3B341; color:#0F172A; font-size:13px; font-weight:900; letter-spacing:.04em`, text `OS`.
    - Wordmark: `#F8FAFC`, `19px`, `font-weight:600`, `letter-spacing:-.02em`, text `unclutterOS` where the trailing `OS` is `font-weight:800`.
  - **Nav links** (flex, `gap:30px`, `margin-left:12px`): `Features`, `White-Labeling`, `Telehealth`, `Pricing`, `Testimonials`. `#CBD5E1`, `14px`, `font-weight:500`. Hover → `#E3B341`. Each links to the matching anchor id.
  - **Right CTAs** (`margin-left:auto`, flex, `gap:12px`):
    - `Log in` ghost: `height:42px; padding:0 18px; border-radius:14px; background:transparent; border:1px solid rgba(255,255,255,.16); color:#E2E8F0; 14px/600`. Hover: `background rgba(255,255,255,.07); color:#fff`.
    - `Start 14-Day Free Trial` gold: `height:42px; padding:0 20px; border-radius:14px; background:#E3B341; color:#0F172A; 14px/700; box-shadow:0 8px 24px rgba(227,179,65,.28)`. Hover: `background:#F0C558`.

### 2. Hero

- **Purpose:** State the positioning (own brand, zero fees) and show the product in one glance.
- **Layout:** `background:#0F172A`, `position:relative; overflow:hidden`. Decorative glow: absolutely positioned `top:-160px; left:50%; translateX(-50%); width:1100px; height:520px; background: radial-gradient(ellipse at center, rgba(27,83,117,.55), rgba(15,23,42,0) 68%); pointer-events:none`. Content grid: `max-width:1280px; padding:84px 40px 0; grid-template-columns:520px 1fr; gap:56px; align-items:center`. A 120px spacer closes the section (gives the phone mock room to overhang).
- **Left column** (flex column, `gap:22px`, `align-items:flex-start`):
  - **Eyebrow pill:** `padding:7px 14px; border-radius:999px; background:rgba(227,179,65,.1); border:1px solid rgba(227,179,65,.28)`; 6px gold dot + text `PRACTICE MANAGEMENT & TELEHEALTH FOR THERAPISTS IN NIGERIA` at `10px`, `font-weight:900`, `letter-spacing:.18em`, `#E3B341`.
  - **H1:** `42px / line-height 1.12 / font-weight 700 / letter-spacing -.035em`, `#F8FAFC`, `text-wrap: balance`. Copy: `Your Own Branded Therapy Practice. Zero Platform Fees.` — the second sentence is wrapped in a span colored `#E3B341`.
  - **Sub-copy:** `16px / 1.65`, `#94A3B8`, `max-width:490px`, `text-wrap: pretty`. Copy: `Give your clients a 100% white-label booking experience under your own brand and domain. Manage schedule, clinical SOAP notes, and HD telehealth sessions — with direct Paystack bank payouts.`
  - **CTA row** (flex, `gap:12px`):
    - Primary `Start Free 14-Day Trial`: `height:52px; padding:0 26px; border-radius:16px; background:#0F3A53; border:1px solid #E3B341; color:#E3B341; 15px/700; box-shadow:0 14px 34px rgba(15,58,83,.5)`. Hover: `background:#1B5375`.
    - Secondary `Watch 2-Min Demo`: `height:52px; padding:0 22px; border-radius:16px; background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.14); color:#E2E8F0; 15px/600`, with a 22px gold circle containing a `▶` glyph at `9px` (replace with a Lucide `Play` icon in production). Hover: `background:rgba(255,255,255,.12)`.
  - **Reassurance row:** `12.5px`, `#64748B`, items separated by `•` at `opacity:.4` — `No card required`, `NDPR compliant`, `Paystack verified`.
- **Right column — hero graphic** (`position:relative; height:520px`). Two overlapping mocks:
  - **Browser frame** (`position:absolute; top:24px; left:0; width:720px; border-radius:20px; overflow:hidden; background:#F8FAFC; box-shadow:0 40px 90px rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.1)`):
    - Chrome bar: `height:38px; background:#0F172A`, three 9px dots (`#EF4444`, `#E3B341`, `#22C55E`), URL chip `height:22px; max-width:290px; border-radius:99px; background:rgba(255,255,255,.08); font-size:10.5px; color:#94A3B8` reading `app.drjanesmith.ng/dashboard`.
    - Body `height:420px`, flex row. **Sidebar** `width:150px; background:#0F172A; padding:16px 10px`: mini OS pill + `Practice`; active item `Dashboard` is `height:32px; border-radius:10px; background:linear-gradient(90deg,rgba(15,58,83,.95),rgba(27,83,117,.45)); box-shadow: inset 0 0 0 1px rgba(227,179,65,.3); color:#fff; 11px/600`; inactive items `Calendar`, `Clients`, `Notes`, `Payouts` at `#94A3B8`, `11px`.
    - **Main pane** `padding:18px; gap:14px`: greeting `Good morning, Dr. Jane` (`16px/700`, `letter-spacing:-.02em`) + `6 sessions today` (`11px`, `#64748B`). Three stat cards in a `repeat(3,1fr)` grid, `gap:10px`, each `background:#fff; border:1px solid rgba(15,23,42,.06); border-radius:16px; padding:12px` with an eyebrow (`8.5px/900`, `letter-spacing:.16em`, `#94A3B8`) and a value at `22px; font-weight:300; letter-spacing:-.02em`: `THIS WEEK / ₦412,000`, `SESSIONS / 18`, `NEW INTAKES / 5`.
    - **Today's schedule card:** `border-radius:20px; padding:14px; gap:9px`, eyebrow `TODAY'S SCHEDULE`. Rows: `padding:8px 10px; border-radius:12px; background:#F8FAFC`, 3px×22px navy bar + time (`11px/700`, 52px wide) + name (`11px`, `#334155`, flex:1) + tag pill (`9px/800`, `letter-spacing:.1em`, `padding:3px 8px`, `background:rgba(227,179,65,.16)`, `color:#8A6A16`).
      Data: `09:00 · Adaeze O. — Individual · PAID`; `11:00 · Tunde A. — Follow-up · PAID`; `14:00 · Chidinma E. — Intake · NEW`; `16:00 · Group session — CBT · 4 SEATS`.
  - **Phone frame** (`position:absolute; right:-6px; bottom:-52px; width:214px; border-radius:32px; background:#0F172A; padding:9px; box-shadow:0 40px 80px rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.12)`). Screen: `border-radius:25px; background:#FDFCF8; height:400px`.
    - Title bar: `height:36px; background:#0F3A53; color:#fff; 11px/700` — `Dr. Jane Smith` (demonstrates the white-label surface: no Unclutter Desk branding).
    - Eyebrow `BOOK A SESSION` (`8.5px/900`, `letter-spacing:.2em`, `#94A3B8`); heading `Choose a time that works for you.` (`15px/700`, `letter-spacing:-.02em`, `line-height:1.25`).
    - Day picker: `repeat(4,1fr)` grid, `gap:5px`, cells `height:34px; border-radius:10px; 9px/700`. Labels `M 8, T 9, W 10, T 11, F 12, S 13, M 15, T 16`. Index 2 (`W 10`) is selected: `background:#0F3A53; color:#fff`; others `background:rgba(15,23,42,.05); color:#334155`.
    - Slot list: `height:32px; border-radius:11px`, unselected `border:1px solid rgba(15,23,42,.1); color:#334155`, selected (`11:00 — 11:50`) `background:#0F3A53; color:#fff; font-weight:600`. Slots: `09:00 — 09:50`, `11:00 — 11:50`, `14:00 — 14:50`.
    - Footer CTA: `height:40px; border-radius:14px; background:#E3B341; color:#0F172A; 12px/800` — `Pay ₦25,000 & Confirm`; below it `Secured by Paystack` at `8px`, `#94A3B8`.

### 3. Key Value Proposition Cards

- **Purpose:** Three-beat summary of the differentiators.
- **Layout:** `background:#F8FAFC; padding:96px 40px 40px`; inner `max-width:1280px`, `grid-template-columns:repeat(3,1fr); gap:24px`. Section carries `id="features"`; card 1 carries `id="white-labeling"`, card 2 `id="telehealth"` (nav anchors).
- **Card:** `background:#fff; border:1px solid rgba(15,23,42,.06); border-radius:24px; padding:32px; gap:14px; box-shadow:0 12px 34px rgba(15,23,42,.05)`. Hover: `transform: translateY(-4px); box-shadow:0 22px 50px rgba(15,23,42,.1)`, transition `.3s ease-out` on transform and box-shadow.
- **Icon tile:** `52×52; border-radius:16px`, 24px Lucide-style stroke icon at `stroke-width:2`, rounded caps.
  - Card 1 tile `rgba(227,179,65,.16)`, icon stroke `#8A6A16` (browser/window glyph).
  - Card 2 tile `rgba(15,58,83,.1)`, icon stroke `#0F3A53` (video glyph).
  - Card 3 tile `rgba(34,197,94,.13)`, icon stroke `#15803D` (card/payment glyph).
- **Title:** `19px/700`, `letter-spacing:-.02em`. **Body:** `14.5px/1.6`, `#64748B`, `text-wrap: pretty`.
- **Content:**
  1. `100% White-Label Portal` — “Your brand, your domain. Clients never see unclutterOS.”
  2. `HD Telehealth & Live SOAP Notes` — “End-to-end encrypted WebRTC rooms with side-by-side SOAP note autosaving and PHQ-9 scoring.”
  3. `Direct Paystack Bank Payouts` — “0% platform commission on client booking payouts. Money goes straight to your GTBank/Access account.”

### 4. Interactive Feature Showcase (tabs)

- **Purpose:** Depth on three product pillars without three pages.
- **Layout:** `background:#F8FAFC; padding:72px 40px 96px`, centered column, `gap:28px`.
  - Eyebrow `EVERYTHING THE PRACTICE RUNS ON` (`10px/900`, `letter-spacing:.22em`, `#94A3B8`).
  - H2 `One workspace, from first enquiry to final note.` — `34px/700`, `letter-spacing:-.035em`, centered.
  - **Tab bar:** flex, `gap:8px; padding:6px; border-radius:20px; background:#fff; border:1px solid rgba(15,23,42,.06); box-shadow:0 10px 28px rgba(15,23,42,.05)`. Tab button: `height:44px; padding:0 20px; border-radius:15px; 13.5px/600`. Active `background:#0F172A; color:#fff`; inactive `background:transparent; color:#64748B`.
  - **Panel:** `background:#fff; border:1px solid rgba(15,23,42,.06); border-radius:32px; padding:40px; grid-template-columns:400px 1fr; gap:48px; align-items:center; min-height:400px; box-shadow:0 20px 60px rgba(15,23,42,.07)`.
    - Left: eyebrow (`10px/900`, `letter-spacing:.2em`, `#E3B341`), title (`26px/700`, `letter-spacing:-.03em`, `line-height:1.2`), body (`15px/1.65`, `#64748B`), then a checklist — 18px circle `rgba(15,58,83,.1)` with `#0F3A53` check + `14px` `#334155` label, `gap:10px`.
    - Right: dark preview `background:#0F172A; border-radius:24px; padding:22px; min-height:320px`. Header = 8px gold dot + panel label (`10px/900`, `letter-spacing:.18em`, `#94A3B8`). Rows: `padding:13px 16px; border-radius:16px`, title `13px/600` (flex:1), meta `11.5px` `#94A3B8`, pill `9px/800; letter-spacing:.1em; padding:4px 9px; border-radius:99px`.
- **Row tone tokens** (pick per row):

  | tone | row bg | row border | title color | pill bg | pill fg |
  |---|---|---|---|---|---|
  | gold | `rgba(227,179,65,.1)` | `rgba(227,179,65,.28)` | `#F8FAFC` | `#E3B341` | `#0F172A` |
  | navy | `rgba(27,83,117,.28)` | `rgba(27,83,117,.5)` | `#E2E8F0` | `rgba(255,255,255,.14)` | `#CBD5E1` |
  | muted | `rgba(255,255,255,.04)` | `rgba(255,255,255,.08)` | `#94A3B8` | `rgba(255,255,255,.08)` | `#94A3B8` |

- **Tab content:**

  **Tab 1 — `Client Scheduling & Availability`** (eyebrow `SCHEDULING`)
  - Title: *Availability you set once, bookings that fill themselves.*
  - Body: *Publish recurring weekly availability, buffer times and session lengths. Clients pick a slot on your own domain, pay through Paystack, and the session lands in your calendar with reminders already queued.*
  - Bullets: Recurring rules & blackout dates · Automatic WhatsApp + email reminders · Reschedule and cancellation policies
  - Panel label `MONDAY 14 SEPTEMBER`. Rows: `09:00 — Adaeze O.` / Individual · 50 min / `PAID` (gold); `11:00 — Tunde A.` / Follow-up · 50 min / `PAID` (gold); `13:00 — Blocked` / Lunch / `HOLD` (muted); `14:00 — Chidinma E.` / Intake · 80 min / `NEW` (navy); `16:00 — Open slot` / Bookable / `FREE` (muted).

  **Tab 2 — `Universal Intake & PHQ-9`** (eyebrow `ASSESSMENTS`)
  - Title: *Build intake forms and scored assessments without code.*
  - Body: *Drag fields into a universal intake, attach validated instruments like PHQ-9 or GAD-7, and let the platform score and trend them across sessions. Results attach to the client record automatically.*
  - Bullets: Conditional logic & required consent · Auto-scored PHQ-9, GAD-7, DASS-21 · Score trends plotted in the client file
  - Panel label `INTAKE BUILDER — PHQ-9`. Rows: Little interest or pleasure / Score 0–3 / `2` (navy); Feeling down or hopeless / Score 0–3 / `3` (navy); Trouble sleeping / Score 0–3 / `1` (muted); Consent to teletherapy / Required checkbox / `REQ` (gold); Total severity / Moderate depression / `14` (gold).

  **Tab 3 — `Group Practice RBAC`** (eyebrow `TEAMS`)
  - Title: *Run a clinic with the right access for every role.*
  - Body: *Add therapists, receptionists and supervisors with scoped permissions. Front desk books and bills; clinicians own their notes; the clinic owner sees revenue across every practitioner.*
  - Bullets: Per-role permission matrix · Clinical notes locked to the treating therapist · Clinic-wide revenue and utilisation reports
  - Panel label `STAFF ROSTER — 6 MEMBERS`. Rows: Dr. Jane Smith / Clinical Psychologist / `OWNER` (gold); Dr. Emeka N. / Psychotherapist / `THERAPIST` (navy); Amara U. / Front desk / `RECEPTION` (muted); Dr. Bola A. / Supervisor / `SUPERVISOR` (navy); Ifeoma K. / Billing / `FINANCE` (muted).

### 5. Pricing

- **Purpose:** Three selectable plans with Pro Solo pre-selected and visually dominant.
- **Layout:** `id="pricing"`, `background:#fff`, hairline top and bottom borders `1px solid rgba(15,23,42,.06)`, `padding:96px 40px`. Centered header stack: eyebrow `PRICING`; H2 `Simple, transparent pricing. No hidden fees.` (`34px/700`, `letter-spacing:-.035em`); sub `Every plan keeps 0% of your session revenue. Cancel any time.` (`15px`, `#64748B`, `margin-bottom:26px`). Grid `repeat(3,1fr); gap:24px; align-items:start`. Footnote under the grid: `All prices in Nigerian Naira. Paystack handles billing; payouts settle to your bank in 24 hours.` (`12.5px`, `#94A3B8`, `padding-top:20px`).
- **Card shell:** `border-radius:24px; padding:34px 30px; gap:18px; cursor:pointer; transition: transform .25s ease-out, box-shadow .25s ease-out`. Structure: name row (+ MOST POPULAR badge) → price row → blurb (`min-height:44px`) → CTA button → hairline rule → feature list.
  - Name: `10px/900`, `letter-spacing:.2em`. Price: `40px; font-weight:300; letter-spacing:-.04em`, with `/month` at `14px` in the muted color. Blurb `14px/1.55`. CTA button `height:48px; border-radius:16px; 14.5px/700`. Feature row: 17px circle tick (`9.5px` glyph, `margin-top:2px`) + `13.5px/1.45` label, `gap:10px`, list `gap:11px`.
- **Card states:**

  | | Light default | Light selected | Dark (Pro Solo) |
  |---|---|---|---|
  | card bg | `#fff` | `#fff` | `#0F172A` |
  | border | `rgba(15,23,42,.08)` | `rgba(15,58,83,.35)` | `#E3B341` |
  | shadow | `0 10px 30px rgba(15,23,42,.05)` | `0 20px 50px rgba(15,23,42,.12)` | `0 30px 70px rgba(15,23,42,.28), 0 0 0 4px rgba(227,179,65,.16)` |
  | transform | none | `translateY(-6px)` | `translateY(-14px)` |
  | name color | `#94A3B8` | `#94A3B8` | `#E3B341` |
  | price color | `#0F172A` | `#0F172A` | `#F8FAFC` |
  | muted text | `#64748B` | `#64748B` | `#94A3B8` |
  | feature text | `#334155` | `#334155` | `#CBD5E1` |
  | rule | `rgba(15,23,42,.07)` | same | `rgba(255,255,255,.1)` |
  | tick bg / fg | `rgba(15,58,83,.1)` / `#0F3A53` | same | `rgba(227,179,65,.18)` / `#E3B341` |
  | button | `#fff` bg, `#0F172A` text, `rgba(15,23,42,.14)` border | `#0F3A53` bg, `#fff` text | `#E3B341` bg, `#0F172A` text |

  The dark card also shows a `MOST POPULAR` badge: `9px/900; letter-spacing:.12em; padding:4px 10px; border-radius:99px; background:#E3B341; color:#0F172A`.

- **Plans:**

  | | Starter | Pro Solo *(dark, default-selected)* | Group Clinic |
  |---|---|---|---|
  | Price | ₦0 /month | ₦25,000 /month | ₦75,000 /month |
  | Blurb | For a solo practitioner testing the waters. | For an established private practice ready to own its brand. | For multi-therapist clinics that need oversight. |
  | CTA | Start free | Start 14-day trial | Talk to sales |
  | Features | 1 practitioner · 20 bookings per month · Basic Jitsi telehealth · unclutterOS badge on portal · Email support | Unlimited sessions · Custom domain (CNAME) · 1 receptionist login · Daily.co cloud recording · 0% payout fee | Up to 25 therapists · Multi-role RBAC · Clinic-wide revenue analytics · Priority support · Dedicated onboarding |

### 6. Testimonials & Social Proof

- **Purpose:** Local credibility from Nigerian practitioners.
- **Layout:** `id="testimonials"`, `background:#F8FAFC; padding:96px 40px`, inner `max-width:1000px`, centered column, `gap:32px`. Eyebrow `TRUSTED BY NIGERIAN PRACTITIONERS`.
- **Quote card:** `background:#fff; border:1px solid rgba(15,23,42,.06); border-radius:32px; padding:48px 56px; min-height:250px; box-shadow:0 20px 60px rgba(15,23,42,.06); gap:26px`. Opening `“` glyph at `34px`, `#E3B341`, `font-weight:700`. Quote text `22px/1.55; font-weight:500; letter-spacing:-.02em; color:#0F172A; text-wrap:pretty`.
- **Attribution row** (`margin-top:auto`, `gap:14px`): 46px circular avatar `background:#0F3A53; color:#E3B341; 14px/700` showing initials; name `14.5px/700`; role `12.5px`, `#64748B`. Right side: prev/next buttons, `40×40; border-radius:99px; border:1px solid rgba(15,23,42,.1); background:#fff`, hover `#F1F5F9`, glyphs `←` / `→`.
- **Dots:** 7px tall pills, `gap:7px`; active is `26px` wide and `#E3B341`, inactive `7px` and `rgba(15,23,42,.15)`. Clicking a dot jumps to that quote.
- **Trust badge row** (optional, see tweaks): `gap:40px; opacity:.55`, items `13px/700`, `#475569` — `NPA Registered`, `NDPR Compliant`, `Paystack Verified`, `256-bit Encryption`.
- **Quotes:**
  1. “Unclutter Desk allowed me to launch my private practice in 10 minutes. My clients book directly on my custom domain and payments land in my account instantly.” — **Dr. Jane Smith**, Clinical Psychologist, Lagos (`JS`)
  2. “We moved a five-therapist clinic off spreadsheets in a weekend. Role permissions mean my front desk books without ever seeing a clinical note.” — **Dr. Emeka Nwosu**, Clinic Director, Abuja (`EN`)
  3. “Session notes finish themselves while I'm still in the call, and PHQ-9 scores trend automatically. I get an hour of my evening back.” — **Adaeze Okafor**, Psychotherapist, Port Harcourt (`AO`)

### 7. Final CTA Banner

- **Layout:** section `padding:0 40px 96px; background:#F8FAFC`. Banner: `max-width:1280px; border-radius:32px; background: linear-gradient(120deg,#0F3A53,#1B5375); padding:72px 56px; display:flex; align-items:center; gap:40px; box-shadow:0 30px 70px rgba(15,58,83,.28)`.
- **Copy:** H2 `Ready to scale your therapy practice?` — `36px/700`, `letter-spacing:-.035em`, `#fff`. Sub `Launch your branded booking portal today. Free for 14 days, no card required.` — `16px`, `rgba(255,255,255,.68)`, `max-width:520px`.
- **Button:** `margin-left:auto; height:56px; padding:0 32px; border-radius:18px; background:#E3B341; color:#0F172A; 16px/700; box-shadow:0 16px 40px rgba(227,179,65,.32)` — `Create Your Practice Now`. Hover `#F0C558`.

### 8. Footer

- **Layout:** `background:#0F172A; padding:56px 40px 40px`, inner `max-width:1280px`, column `gap:36px`. Logo lockup at 28px pill / 17px wordmark. Link row separated by `border-top:1px solid rgba(255,255,255,.08); padding-top:24px`, flex, `gap:32px`.
- **Links:** `Terms`, `Privacy (NDPR Compliance)`, `Contact`, `Support` — `13.5px`, `#94A3B8`, hover `#E3B341`. Copyright pushed right (`margin-left:auto`): `Copyright 2026 Unclutter Desk Inc.` — `13px`, `#475569`.

---

## Interactions & Behavior

- **Anchor nav:** `html { scroll-behavior: smooth }`; nav links target `#features`, `#white-labeling`, `#telehealth`, `#pricing`, `#testimonials`; logo targets `#top`.
- **Feature tabs:** click sets the active index (`tab`, default `0`). The whole panel — eyebrow, title, body, bullets, dark preview rows — swaps from one content object. No transition is specified; a 150ms opacity cross-fade would be acceptable.
- **Pricing selection:** clicking anywhere on a card sets `plan` (default `1`, Pro Solo). Selection changes border, shadow, lift, and CTA fill on light cards. The dark card's treatment is intrinsic to the plan, not to selection — it always renders dark, gold-ringed, and lifted 14px.
- **Testimonial carousel:** auto-advances every **7000ms** via an interval started on mount and cleared on unmount. Prev/next buttons and dots set the index directly. Note: in the prototype, manual navigation does not reset the auto-advance timer — resetting it on interaction is the better production behavior.
- **Hover states:** value cards lift 4px (`transition: transform .3s ease-out, box-shadow .3s ease-out`); nav links and footer links shift to gold; buttons brighten as tabulated above. All easing is `ease-out` — no bounces (design-system rule).
- **Loading / error / validation:** none — the page has no forms. CTAs should route to signup/login; `Talk to sales` should route to a contact route or open a scheduling modal.
- **Responsive behavior (not designed — implement to this intent):** below ~1100px, hero collapses to one column with the graphic under the copy; value cards and pricing go 1-column (keep Pro Solo first or preserve order with the popular card still emphasized); tab bar becomes horizontally scrollable or a stacked accordion; feature panel goes one column; final CTA stacks with the button full-width. Confirm with design before shipping.
- **Accessibility notes for implementation:** the tab bar should be real ARIA tabs (`role="tablist"`/`tab`/`tabpanel`, arrow-key navigation); pricing cards should be radio-group semantics or contain a real focusable control rather than a click handler on the div; the carousel needs `aria-live="polite"` and a pause-on-hover/focus affordance for the auto-advance; decorative glyphs (`▶`, `“`, `←`, `→`, `✓`) need `aria-hidden` with accessible labels on the controls.

## State Management

Three pieces of local UI state, all component-local — no data fetching, no global store.

| State | Type | Default | Set by | Drives |
|---|---|---|---|---|
| `tab` | `0 \| 1 \| 2` | `0` | Tab button click | Feature showcase panel content and active tab styling |
| `quote` | `0 \| 1 \| 2` | `0` | 7s interval, prev/next buttons, dots | Testimonial card content and dot styling |
| `plan` | `0 \| 1 \| 2` | `1` | Pricing card click | Light-card selected styling |

Content (tabs, quotes, plans, mock dashboard rows) is static and defined as module-level constants; in production, move it to a content module or CMS. Two configurable props exist on the prototype root — `accentColor` (default `#E3B341`, wired through a `--accent` CSS variable on the root element) and `showTrustBadges` (default `true`, toggles the trust-badge row). Treat `accentColor` as a theming hook, not a user-facing feature.

## Design Tokens

**Colors**

| Token | Value | Use |
|---|---|---|
| Slate chrome | `#0F172A` | Nav, hero bg, dark cards, footer, primary text |
| Deep navy | `#0F3A53` | Primary buttons, selected states, avatars, accent bars |
| Navy light | `#1B5375` | Gradient end, navy hover |
| Warm gold | `#E3B341` | Accent: CTAs, badges, rings, eyebrows |
| Gold hover | `#F0C558` | Gold button hover |
| Gold deep | `#8A6A16` | Gold-on-light text/icons (contrast-safe) |
| App background | `#F8FAFC` | Page background, light text on dark |
| Surface | `#FFFFFF` | Cards, pricing section |
| Phone screen | `#FDFCF8` | Warm off-white (design-system app bg) |
| Text primary | `#0F172A` | Headings on light |
| Text secondary | `#334155` | Feature/list copy |
| Text muted | `#64748B` | Body copy on light |
| Text subtle | `#94A3B8` | Eyebrows, meta, body on dark |
| Text faint | `#475569` | Footer copyright, trust badges |
| Border hairline | `rgba(15,23,42,.06)` | Card and section borders |
| Border on dark | `rgba(255,255,255,.08–.16)` | Dark-surface borders |
| Success | `#22C55E` / `#15803D` | Payment icon, browser dot |
| Danger | `#EF4444` | Browser dot only |

**Typography** — `Outfit` (Google Fonts, weights 300–900), fallback `system-ui, sans-serif`.

| Role | Size / weight / tracking |
|---|---|
| H1 hero | 42px / 700 / -.035em / lh 1.12 |
| H2 section | 34–36px / 700 / -.035em |
| Panel title | 26px / 700 / -.03em / lh 1.2 |
| Quote | 22px / 500 / -.02em / lh 1.55 |
| Card title | 19px / 700 / -.02em |
| Price | 40px / 300 / -.04em |
| Stat value | 22px / 300 / -.02em |
| Body large | 16px / 400 / lh 1.65 |
| Body | 14.5–15px / 400 / lh 1.6 |
| Feature item | 13.5–14px / 400 / lh 1.45 |
| Meta / footnote | 11–12.5px / 400 |
| Eyebrow | 10px / 900 / .18–.22em / uppercase |
| Micro eyebrow | 8.5–9px / 900 / .12–.2em / uppercase |

**Spacing** — 4px base. Section padding `96px` vertical, `40px` gutter. Grid gap `24px`. Card padding `32px` (value), `34px 30px` (pricing), `40px` (feature panel), `48px 56px` (quote). Stack gaps `9–32px`.

**Radius** — pill `999px`; buttons `14px` (nav), `16px` (hero/pricing), `18px` (final CTA); cards `24px`; large panels `32px`; icon tiles `16px`; small rows `10–16px`; phone shell `32px` / screen `25px`; browser frame `20px`.

**Shadows**

| Name | Value |
|---|---|
| Card rest | `0 12px 34px rgba(15,23,42,.05)` |
| Card hover | `0 22px 50px rgba(15,23,42,.1)` |
| Panel | `0 20px 60px rgba(15,23,42,.07)` |
| Pricing selected | `0 20px 50px rgba(15,23,42,.12)` |
| Pricing dark | `0 30px 70px rgba(15,23,42,.28)` + ring `0 0 0 4px rgba(227,179,65,.16)` |
| Gold button | `0 8px 24px rgba(227,179,65,.28)` (nav) / `0 16px 40px rgba(227,179,65,.32)` (final CTA) |
| Navy button | `0 14px 34px rgba(15,58,83,.5)` |
| Browser mock | `0 40px 90px rgba(0,0,0,.5)` |
| Phone mock | `0 40px 80px rgba(0,0,0,.55)` |
| CTA banner | `0 30px 70px rgba(15,58,83,.28)` |

## Assets

- **Fonts:** Outfit from Google Fonts (weights 300, 400, 500, 600, 700, 800, 900).
- **Icons:** three inline stroke SVGs in the value cards (window, video, payment card) drawn in Lucide's style — 24px, `stroke-width:2`, rounded caps/joins. **Replace with the real Lucide icons** (`AppWindow`/`Layout`, `Video`, `CreditCard`) from `lucide-react`; the design system mandates Lucide and forbids a custom icon font.
- **Glyph placeholders:** `▶` (demo button), `“`, `←`, `→`, `✓` are text glyphs in the prototype — swap for Lucide `Play`, `ChevronLeft`, `ChevronRight`, `Check` and a typographic quote mark.
- **No photography or illustration.** The hero product mocks are pure HTML/CSS — rebuild them as components, or replace with real product screenshots if the app ships before this page.
- **Logo:** the `OS` gold pill + wordmark is type-only, no image asset. The Unclutter lotus mark (`assets/logo-full.svg` in the design system) is *not* used on this page.
- **Design system:** this page is built against the bound Unclutter Design System (`_ds/unclutter-design-system-.../colors_and_type.css`, `unclutterdesk.css`). Use the codebase's existing token layer where it overlaps rather than re-declaring these hex values.

## Files

| File | What it is |
|---|---|
| `Unclutter Desk Marketing Site.dc.html` | The full design — template markup plus a logic class holding the tab/quote/plan state and all content arrays. This is the source of truth for every value in this README. |
| `support.js` | Runtime that renders the prototype file in a browser. Not part of the design; do not port. |

Open `Unclutter Desk Marketing Site.dc.html` directly in a browser to interact with the prototype (tabs, pricing selection, carousel). Note the design system CSS is referenced at a project-relative `_ds/…` path that is not included in this bundle — the page still renders, since all styling is inline.
