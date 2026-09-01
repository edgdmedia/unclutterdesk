# Claude Design Prompt — Unclutter Desk Screens Set 06 (Marketing Landing)

Paste this into Claude Design (claude.ai/design) to generate a new spec board
named `Unclutter Desk Marketing Landing.dc.html` with **three views**, matching the
existing Unclutter Desk handoff conventions (`design_handoff_unclutterdesk`,
`design_handoff_unclutterdesk_screens_2_3`).

---

Design the public marketing landing page for Unclutter Desk, a B2B practice-management
and white-label telehealth platform for therapists and clinics in Nigeria. This is
the guest-facing site served at `os.unclutterdesk.com/` — it sits **before** the
login and uses its own marketing chrome (top nav, hero, sections, footer), NOT the
slate app sidebar. Its jobs: explain the product, sell the white-label idea, present
pricing, and convert visitors to the 14-day free trial (`/register`) or login
(`/login`).

Recreate the existing Unclutter Desk design system exactly: Outfit font (weights
300–900), deep navy `#0F3A53` (hover `#0C2E42`), warm gold `#E3B341`, surface
`#F8FAFC`, white cards radius 24px, 9px/900/0.22em uppercase eyebrows (`#94A3B8`),
`#E2E8F0` borders, `#475569`/`#64748B`/`#94A3B8` text hierarchy. **No
photography** — avatars, practice logos and reviewer chips are initials on tinted
tiles. Lucide-style inline SVGs, 2px stroke, round caps.

Views 30 and 31 live on a 1440px-wide canvas, each in its own
`<section data-screen-label="View NN — Title">`. View 32 is a mobile landing
rendered inside a 390px-wide phone frame (46px radius, shadow
`0 24px 70px rgba(15,23,42,.20)`). Each section shows the frame and an interaction
annotation in a 12px `#64748B` caption above it. Use the same `<sc-for>`,
`<sc-if>`, `{{ value }}` and `Component` logic-class conventions as the other
Unclutter Desk `.dc.html` boards so it renders with `support.js`.

## View 30 — Marketing Landing (Desktop)

### Nav (sticky, glass)
`position:sticky; top:0; z-index:50; background:rgba(255,255,255,.85);
backdrop-filter:blur(18px) saturate(140%); border-bottom:1px solid #E2E8F0`.
Height 76px, padding 0 40px, `display:flex; align-items:center; gap:28px`.

- Brand lockup: 30px mark (radius 9px, navy `#0F3A53`, gold letter `U` 15px/800),
  wordmark "unclutter" 17px/600/−0.02em `#0F172A`, then a gold pill "OS"
  (18px tall, padding 0 8px, radius 999px, `#E3B341`, 9px/800/0.08em `#0F172A`).
- Nav links (`margin-left:auto`, gap 28px, 14px/600 `#64748B`, hover `#0F172A`):
  **Features**, **How it works**, **Pricing**, **FAQ**.
- Right cluster: ghost **Log in** (44px, radius 14px, `1px solid #CBD5E1`,
  `#0F3A53` 14px/700) and primary **Start free trial** (44px, padding 0 22px,
  radius 14px, navy `#0F3A53`, white 14px/700, shadow `0 6px 18px rgba(15,58,83,.22)`).

### Hero
Background `#F8FAFC`, padding `72px 40px 0`, centered column
(`max-width:760px; margin:0 auto; text-align:center`).

- Gold pill chip: 28px, radius 999px, `#FBF1DA`, `#8A6512` 11px/800/0.08em —
  "WHITE-LABEL PRACTICE OS FOR THERAPISTS & CLINICS".
- H1 (30px/800/−0.035em `#0F172A`, can scale to 46px at 800): **Run your therapy
  practice on your own brand.**
- Sub (16.5px `#64748B`, max-width 600px): "Unclutter Desk gives Nigerian therapists
  and clinics a white-label booking page, telehealth, clinical notes and Paystack
  payouts — live in minutes, no code."
- CTA row (gap 12px, centered): primary **Start your free 14-day trial** (52px,
  padding 0 28px, radius 16px, navy, white 15px/700, shadow
  `0 10px 26px rgba(15,58,83,.26)`, arrow icon) and ghost **See it in action**
  (52px, radius 16px, white, `1px solid #CBD5E1`, `#0F3A53`, play icon).
- Trust line (12.5px `#94A3B8`): "No credit card required · Cancel anytime ·
  Made for Nigeria (NGN, Paystack)."

### Product mockup (hero visual)
Below the copy, a scaled-down recreation of the **White-Label Client Booking
Portal** (reference View 2 of `Unclutter Desk Screens.dc.html`) in a browser frame:
1180px→980px wide, radius 24px, `overflow:hidden`,
`box-shadow:0 24px 80px rgba(15,23,42,.14)`, background `#fff`.

- Browser chrome: 44px `#F1F5F9`, `border-bottom:1px solid #E2E8F0`, three 11px
  dots (`#FB7185`/`#FCD34D`/`#6EE7B7`), centered URL pill (26px, radius 999px,
  white, `1px solid #E2E8F0`, 11.5px `#64748B`, a 11px green lock icon)
  reading `booking.smiththerapy.ng`.
- Brand header: `linear-gradient(120deg, {{ primaryTint }}, {{ secondaryTint }})`,
  82px white logo tile (radius 26px, gold `JS` 26px/800), eyebrow 11px/900/0.2em
  `{{ primary }}` **DR. JANE SMITH THERAPY**, an 11px/800 gold-pill category chip
  `CLINICAL PSYCHOLOGY`, H1 30px/800 "Book a session with Dr. Jane Smith", and the
  three trust chips (4.9★ · 214 reviews / Lagos, Nigeria · Online & in-person /
  Licensed · 12 years practising).
- Booking body `#FCFDFE`: the numbered **Choose a service** step with two service
  cards (white, radius 20px, `2px solid {{ primary }}` on the selected card,
  name 15px/700 + detail 12.5px `#64748B` + price 24px/800) — "Individual Therapy
  ₦35,000/session" and "Couples Therapy ₦45,000/session"; the **Pick a date &
  time** step with a mini calendar grid (7 columns, 35 cells) and a right rail of
  4 pill time slots (42px, radius 999px, selected slot `{{ primary }}` bg white
  text); and the **Your details** step with two 46px inputs ("Adaeze Okonkwo",
  "adaeze@email.com").
- Caption beneath the frame, 12px `#64748B`: "The client-facing booking page —
  entirely in your brand. No Unclutter Desk chrome."

### Social proof strip
`padding:40px; background:#fff; border-top:1px solid #E2E8F0;
border-bottom:1px solid #E2E8F0`. Eyebrow 9px/900/0.22em `#94A3B8` centered:
"TRUSTED BY PRACTICES ACROSS NIGERIA". A row of 6 practice tiles (radius 16px,
`#F8FAFC`, `1px solid #E2E8F0`, padding 10px 18px, gap 12px, `margin:16px auto 0;
justify-content:center; flex-wrap:wrap`): 32px initials tile (radius 10px,
navy/gold alternates, white 12px/800) + name 13.5px/600 `#475569` — "Adeyemi
Counselling", "Lagos Mind Clinic", "Dr. Bello & Associates", "The Lantern
Centre", "Ogechi Wellness", "Harmony Psych".

### Features
`padding:80px 40px; background:#F8FAFC; text-align:center`. Eyebrow "THE PLATFORM",
title 34px/800/−0.035em **Everything your practice needs, nothing it doesn't**,
sub 15px `#64748B` "Built for the way Nigerian therapists actually work."
Then a 3×2 grid (`max-width:1200px; margin:40px auto 0; gap:20px`), six white
cards (radius 24px, `1px solid #E2E8F0`, padding 28px, text-left,
`transition:box-shadow .2s, transform .2s`, hover `0 12px 34px rgba(15,23,42,.09)`
+ `translateY(-2px)`):
- 44px icon tile (radius 14px, `#EFF6FB` with navy icon) + eyebrow + title
  17px/700 + body 13.5px `#64748B`:
  1. **WHITE-LABEL BOOKING PAGE** · "Your clients book on a page in your name and
     colours — no Unclutter Desk branding on it, ever."
  2. **TELEHEALTH ROOMS** · "One-tap Jitsi video with live SOAP notes in the same
     room, so you document as you go."
  3. **CLINICAL SOAP NOTES** · "Structured, compliant notes with templates —
     per client, per session, all in one file."
  4. **INTAKE & ASSESSMENTS** · "Drag-and-drop PHQ-9, GAD-7 and custom forms that
     clients fill before they arrive."
  5. **PAYSTACK PAYOUTS** · "Collect card, transfer and USSD payments. Settlements
     go straight to your bank subaccount."
  6. **CALENDAR & REMINDERS** · "Recurring availability, buffer gaps, and
     automated SMS/email reminders that cut no-shows."

### How it works
`padding:80px 40px; background:#fff`. Eyebrow "GET LIVE IN MINUTES", title
34px/800 **From signup to first booking in 2 minutes**. Three numbered steps in a
row (`gap:20px; max-width:1200px; margin:40px auto 0`), each a white card
(radius 24px, `1px solid #E2E8F0`, padding 28px, a 40px gold number tile
`#FBF1DA`/`#8A6512` 14px/800):
  1. **Create your practice** — "Add your name, pick two brand colours and get
     your own booking link."
  2. **Share your link** — "Clients book on your domain, with your logo and
     colours, and pay online."
  3. **Run sessions & get paid** — "Telehealth, SOAP notes and Paystack payouts —
     straight to your bank."

### White-label section (dark)
`padding:80px 40px; background:#0F172A; border-radius:40px; margin:0 40px 80px`.
Two-column grid `minmax(0,1fr) 460px; gap:48px; align-items:center`.

- Left: eyebrow gold "TRULY WHITE-LABEL" (9px/900/0.22em `#E3B341`), title 34px/800
  `#F8FAFC` **Your brand everywhere your clients are.**, body 15px `#94A3B8`
  "Pick two colours in Brand Settings and the entire client experience — booking
  page, confirmation screen, client portal — updates live. Your clients never see
  'Unclutter Desk'." Then a mini card (white, radius 20px, padding 18px, 13.5px
  `#0F172A`) with a green VERIFIED pill: "Point your CNAME at
  `cname.unclutterdesk.com` to run the whole thing on
  `booking.yourpractice.com`."
- Right: **five preset swatch cards**, each showing a recolored mini booking
  header (a 56px logo tile + 2 fake bars, gradient `{{ primaryTint }} →
  {{ secondaryTint }}`) plus the two hex chips (11px mono uppercase, radius 8px,
  `#F1F5F9`/`#334155`). Presets (from the design system):
  Unclutter Desk navy `#0F3A53`/`#E3B341`, Signal blue `#007BFF`/`#6F42C1`,
  Calm teal `#0E7490`/`#F59E0B`, Deep violet `#7C3AED`/`#EC4899`,
  Forest `#15803D`/`#B45309`.

## View 31 — Pricing, FAQ & Footer (Desktop)

### Pricing
`padding:80px 40px; background:#F8FAFC; text-align:center`. Eyebrow "PRICING",
title 34px/800 **Simple plans in Naira.**, sub 15px `#64748B` "Start free. Upgrade
when you grow. No hidden fees."

Three cards in a row (`max-width:1200px; margin:44px auto 0; gap:20px;
align-items:stretch`), each `padding:32px; border-radius:24px;
display:flex; flex-direction:column`, feature list at `flex:1`:

1. **Starter** — `₦0`/month · "For your first months as a solo practitioner."
   White card, `1px solid #E2E8F0`, `#0F172A` 20px/800 price + 12px `#94A3B8`
   "5% per booking". Features (14px `#475569`, gold/emerald check icons):
   "1 practitioner profile", "Up to 20 bookings / month", "Instant Jitsi WebRTC
   video", "Intake & assessment forms", "Email support". Ghost CTA **Start free
   trial** (48px, radius 14px, white, `1px solid #CBD5E1`, `#0F3A53` 14px/700).
2. **Pro Solo** — `₦25,000`/month · "For full-time practitioners." **Highlighted:**
   dark card `#0F172A`, `2px solid #E3B341` border, a gold 24px pill "MOST
   POPULAR" (`#E3B341`/`#0F172A` 10px/800/0.08em) at top-right; price 20px/800
   `#F8FAFC`, 12px `#94A3B8` "0% platform fee". Features 14px `#E2E8F0`:
   "Unlimited sessions & bookings", "1 receptionist / staff login", "Custom domain
   (CNAME)", "Daily.co BYOK cloud recording", "SMS & email reminders",
   "Priority support". Primary CTA **Start free trial** (48px, radius 14px,
   gold `#E3B341`, `#0F172A` 14px/700, shadow `0 6px 18px rgba(227,179,65,.35)`).
3. **Group Clinic** — `₦75,000`/month · "For clinics and group practices." White
   card, `1px solid #E2E8F0`, price 20px/800 + 12px "0% platform fee". Features:
   "Up to 25 therapist profiles", "Group clinic RBAC roles", "Supervisor case
   reviews", "Shared client pool & calendar", "Dedicated onboarding", "API
   access". Ghost CTA **Talk to sales** (48px, radius 14px, white,
   `1px solid #CBD5E1`, `#0F3A53`).

Under the grid, 12.5px `#94A3B8`: "Prices in Nigerian Naira (NGN). Start your
free 14-day trial — no card required. Cancel anytime."

### FAQ
`padding:0 40px 80px; background:#F8FAFC`. Eyebrow "FAQ", title 34px/800 **Good
to know.** Accordion cards (`max-width:760px; margin:32px auto 0; gap:12px`), each
white, radius 20px, `1px solid #E2E8F0`, overflow hidden, with a 14px/700
`#0F172A` question row + chevron, and an answer panel 13.5px `#64748B`:

1. **Do I need to build a website first?** — "No. Your booking page goes live in
   the two-minute onboarding. Point your domain at it later if you want."
2. **Can clients pay me online?** — "Yes — Paystack cards, transfers and USSD.
   Money settles to your own bank subaccount."
3. **Is it really white-label?** — "Completely. Client-facing pages carry only
   your name, logo and colours. We're just the engine behind a small footer
   line you can read but never need to explain."
4. **Can I use my own domain?** — "On Pro Solo and above, set a CNAME and run
   everything on `booking.yourpractice.com`."
5. **What happens after the 14-day trial?** — "You keep everything you've set
   up. Continue on Starter for free or pick a plan — no card required to start."
6. **Do you support clinics with many therapists?** — "Yes — the Group Clinic
   plan gives you up to 25 therapist profiles, roles and supervisor review."

### Final CTA
`padding:0 40px 80px; background:#F8FAFC`. A 1240px navy gradient panel
(`linear-gradient(120deg, #0F3A53, #1B5375)`, radius 32px, padding 64px,
text-center, shadow `0 24px 80px rgba(15,23,42,.18)`): gold eyebrow
"NO CREDIT CARD REQUIRED", title 34px/800 `#F8FAFC` **Your practice, live in
minutes.**, sub 15px `#CBD5E1` "Join Nigerian therapists building calm, organized
practices on their own brand." CTA gold **Start your free 14-day trial** (52px,
radius 16px, `#E3B341`, `#0F172A` 15px/800).

### Footer
`background:#0F172A; padding:48px 40px 32px`. Four-column grid: brand column
(lockup + 13px `#64748B` "The operating system for Nigerian therapy practices." +
social circles Instagram/X/WhatsApp 34px, radius 999px, `#1E293B`, white icons),
then three link columns 13.5px `#CBD5E1` (title 11px/800/0.12em uppercase
`#94A3B8`): **Product** (Features, Pricing, Booking page, Security), **Company**
(About, Careers, Contact, Partner with us), **Legal** (Terms, Privacy, Data
protection, NDPR compliance). Bottom bar (`border-top:1px solid rgba(255,255,255,.08)`,
12px `#64748B`): "© 2026 Unclutter Desk · Lagos, Nigeria · Made with care in WAT".

## View 32 — Marketing Landing (Mobile)

Same design, inside a 390px phone frame. Breakpoints: nav collapses to a
34px hamburger (menu opens a white sheet, radius 0 0 24px 24px,
`box-shadow:0 24px 70px rgba(15,23,42,.20)`, with the nav links stacked 44px rows
and full-width **Start free trial**); hero copy scales to 28px/800, CTAs stack
full-width 54px; booking mockup renders as a cropped header card (brand header +
one service card) so the idea still reads; feature grid becomes single column;
how-it-works steps stack with vertical gold connector; white-label section
becomes single column; pricing stacks with Pro Solo second and full-width CTAs;
FAQ accordions and footer stack into single columns.

## Interaction notes (add as `<sc-if>`-style annotations or captions)

- View 30: nav links and hero **See it in action** scroll to anchors; **Start free
  trial** → `/register`; **Log in** → `/login`; the white-label swatch cards swap
  `{{ primary }}`/`{{ secondary }}` on click and recolor all four mock headers;
  booking mockup slots are selectable.
- View 31: **Start free trial** → `/register`; **Talk to sales** opens a
  `mailto:hello@unclutterdesk.com` annotation; FAQ accordions expand/collapse
  independently (chevron rotates); pricing cards are clickable and show a "CURRENT
  PLAN" annotation when selected.
- View 32: hamburger toggles the nav sheet; everything else mirrors View 30/31.

## State

- View 30: `activeSwatch`, `mobileNavOpen` (mobile), `selectedSlot`.
- View 31: `faqOpen: Set<string>`, `selectedPlan`, `currentPlan`.
- View 32: `mobileNavOpen`, `faqOpen`.

Use the same `<sc-if>`, `{{ value }}` and `Component` logic class conventions as
the other Unclutter Desk `.dc.html` spec boards so it renders with `support.js`.
