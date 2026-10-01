# Handoff: Client Booking Wizard (+ Public Practice Profile)

## Overview
The public, tenant-branded booking flow a client sees at a practice's booking link (e.g. `smith-therapy.unclutterdesk.com/book`). It replaces the old single long booking page with a 4-step wizard plus a confirmation: **Service → Time → Details → Pay → Confirmation**. It is reached from the Public Practice Profile page ("Book Consultation" → `/book`), and the header rating links back to the profile.

Target component names: `BookingWizard.tsx` (route `/book`) and `PublicProfilePage.tsx` (route `/`).

## About the Design Files
The files in this bundle are **design references created in HTML**. They are prototypes that show the intended look and behaviour. They are not production code to copy directly. Recreate them in the target codebase (React + `@unclutterdesk/ui`) using its existing patterns: `Button`, `Card`, `Eyebrow`, `Input`, `SegmentedControl`, and the CSS token files. The HTML uses inline styles only because of the prototyping tool. In production, use the design system components and `var(--*)` tokens.

## Fidelity
**High-fidelity.** Colours, type, spacing, radii, copy and interactions are final. Recreate them pixel-accurately.

---

## Global layout

Root element carries the tenant slots:
```html
<div class="desk-tenant" style="--brand-primary:…; --brand-secondary:…; --brand-on-primary:…">
```
Structure, top to bottom: **Header** (fixed, flex:none) → **scroll area** (flex:1, overflow-y:auto, no horizontal scroll) → **sticky action bar** (mobile/tablet only, flex:none).

| Breakpoint | Content column | Gutters | Step card padding | H1 |
|---|---|---|---|---|
| Phone ≤ 600 (designed at 390) | 100% single column | 16px | 20px | 23px |
| Tablet 601–1023 (designed at 820) | max 640px centred, single column | 32px | 28px | 23px |
| Desktop ≥ 1024 (designed at 1280) | max 1200px; grid `minmax(0,1.55fr) minmax(320px,1fr)`, gap 24 | 32px | 32px | 28px |

Body padding: phone `16px`, tablet `28px 32px 24px`, desktop `28px 32px 40px`. Main column stack gap 18px.

### Header (every step)
- Background: `linear-gradient(120deg, var(--brand-tint), var(--brand-secondary-tint)), #FFFFFF`. Bottom border 1px `#E2E8F0`. Padding 12×16 phone, 16×32 tablet/desktop. Inner max-width 1200, flex row, gap 12.
- **Logo tile** 44×44, radius 14, `--brand-primary` fill, `shadow-sm`, with the tenant logo inside (the prototype shows a Lucide `leaf` at 22px as a placeholder).
- **Initials fallback** (no logo): 44×44, radius 14, white, 1px `#E2E8F0`, initials "ST" at 15px/800, letter-spacing .02em, colour = brand ink (see Brand slots).
- Practice name: 16px/700, -0.01em, single line with ellipsis.
- Rating line (a link to the profile page): filled Lucide `star` 12px in `#24614F`, then "4.9 · 32 reviews" at 12.5px `#64748B`. Show nothing if there are no reviews.
- **Secure booking** pill, right side: 30px high, padding 0 12, radius 999, white, 1px `#E2E8F0`, 12px/600 `#475569`, Lucide `lock` 13px in `#16A34A`.
- Nothing else. No app navigation.

### Progress (steps 1–4; hidden on confirmation)
- 4 equal grid columns, gap 6. Each column is a button: a 4px-high pill bar above a 12px label.
- Bar: `--brand-primary` for done and current steps, `#E2E8F0` for steps ahead (200ms ease-out).
- Label: current step 700 `#0F172A`; done 600 `#475569`; ahead 600 `#94A3B8`.
- Done steps are clickable and jump back to that step. Others use the default cursor.
- Labels: Service, Time, Details, Pay.

### Step card
White, 1px `#E2E8F0`, radius 24, `var(--desk-shadow-sm)`, column gap 22.
Title block (gap 10):
- **Phone/tablet Back control:** 44px tall text button "‹ Back", 13.5px/600 `#64748B`, Lucide `chevron-left` 18px. Shown on steps 2–4.
- `<Eyebrow>`: "Step N of 4" (DS Eyebrow: 9px / 900 / 0.22em uppercase, `#94A3B8`).
- H1 700, -0.025em, line-height 1.15.
- Sub: 14px / 1.55 `#64748B`.

**Desktop nav row** (bottom of the card, steps 1–4): 18px top padding, 1px `#F1F5F9` top border. `Button variant="secondary" size="xl"` "Back" (steps 2+) on the left, `Button variant="primary" size="cta"` on the right.

**Footer line** under the card: Unclutter Desk mark 16px at 60% opacity + "Booking powered by Unclutter Desk", 11.5px `#94A3B8`, centred.

### Sticky action bar (phone + tablet, steps 1–4)
- Glass: `rgba(255,255,255,.85)` + `backdrop-filter: blur(18px) saturate(140%)`, 1px `#E2E8F0` top border.
- Padding: phone `12px 16px 20px`; tablet `14px 32px 22px`. Flex row, gap 14.
- Once a service is picked: on the left, a "TOTAL" eyebrow above the amount at 17px/700, tabular numbers.
- Right (flex 1): `Button variant="primary" size="cta" fullWidth` (52px, radius 16).
- CTA labels: step 1 "Continue", step 2 "Continue", step 3 "Continue to payment", step 4 "Pay ₦35,000" / "Hold my time" (transfer) / "Try again · ₦35,000" (after a failure).
- Disabled (opacity .6) until the step is valid: step 1 needs a service; step 2 needs a time.

### Desktop summary card (sticky, top 24px)
White, 1px `#E2E8F0`, radius 24, `shadow-sm`, padding 24, gap 18.
- Eyebrow "Session summary".
- Therapist row: 48px initials avatar (radius 16, `--brand-fill` background, ink text 15/800), "Dr. Sarah Smith" 15/700, "PhD, LCSW · Smith Therapy & Wellness" 12.5 `#64748B`.
- Rows Session / When / Format: 12px `#64748B` label above a 14px value, 12px vertical padding, 1px `#F1F5F9` top border. Before a value exists, show the placeholder in 500 `#94A3B8` ("Choose a session", "Pick a time", "—"). After that, show the value in 600 `#0F172A`.
- Total row: 1px `#E2E8F0` top border, 14px top padding, label 14/600 `#475569`, amount 24/700 -0.02em tabular.
- "Free cancellation up to 24 hours before. Times shown in West Africa Time." 12.5 `#64748B`.

---

## Screens

### Step 1 — Choose a session
Title "Choose a session" · sub "Pick the kind of session you would like with Dr. Sarah Smith."
Service cards (stack gap 12): button, radius 20, padding 18, white, 1px `#E2E8F0`. **Selected:** transparent border plus `box-shadow: 0 0 0 2px var(--brand-primary)`. Hover: `translateY(-1px)`.
- Row: name 16/700 and description 13.5/1.5 `#64748B` (left). On the right, price 16/700 tabular above length 12.5 `#64748B`.
- Format tags: 26px pills, padding 0 11, `#F1F5F9`, 12/600 `#475569`: "Online", "In person".
- Sample data: Initial consultation · 30 min · ₦15,000 · Online. Individual therapy · 50 min · ₦35,000 · Online + In person. Couples therapy · 80 min · ₦50,000 · In person.
- **If the practice has one service**, skip this step and start at step 2. The service row at the top of step 2 then has no "Change" link.

### Step 2 — Pick a time
Title "Pick a time" · sub "Each time is either online or in person, as set by the practice."
1. **Service row** (phone/tablet, or single-service): radius 18, padding 12×14, `#F8FAFC`, 1px `#E2E8F0`. Name 14/700. "50 min · ₦35,000" 12.5 `#64748B`. "Change" 13/700 in brand ink, 44px target.
2. **Week header:** range label "1 Oct – 7 Oct" 14/700, plus 44×44 prev/next buttons (radius 14, 1px `#E2E8F0`, Lucide chevrons 16). Prev is disabled at week 1 and next at week 4 (opacity .35). The window covers 4 weeks from today.
3. **Date strip:** grid of 7 columns, gap 5 (phone) / 8 (wider). Cell 68px tall, radius 16, 1px `#E2E8F0`, white. Weekday 11/600 at 80% opacity, date 17/700 tabular, and a 5px dot in `--brand-dot` when the day has times. **Selected:** `--brand-primary` fill, `--brand-on-primary` text and dot. **No times:** 40% opacity, `not-allowed`, no dot, can't be selected.
4. **Format filter** (only when the service offers both formats and the day has times): segmented control on `#F1F5F9`, 4px inset, radius 14. Segments are 40px, radius 11, 13/700. Active segment: white + `0 1px 2px rgba(15,23,42,.08)`, `#0F172A`. Inactive: `#64748B`. Options: All / Online / In person.
5. **Times:** caption "Tue, 6 Oct · West Africa Time" 12.5 `#64748B`. Grid `repeat(auto-fill, minmax(104px | 132px, 1fr))`, gap 8. **Time button:** pill (radius 999), 52px tall, 1px `#CBD5E1`, white. Time 14/700 tabular above the format 11/600 at 78% opacity. **Selected:** `--brand-primary` fill, `--brand-on-primary` text, transparent border. The practice sets the format of each time; the client doesn't pick it separately.
6. **Address** (once an in-person time is picked): radius 18, padding 14×16, `--brand-fill` background. Lucide `map-pin` 18 in ink, "In person at the practice" 14/700, "14 Admiralty Way, Lekki Phase 1, Lagos · Free parking on site" 13 `#475569`.

### Step 3 — Your details
Title "Your details". Sub: "Sign in or create an account to book your session." When signed in, the sub reads "You are signed in, so we can go straight on."
- **Signed in:** card radius 18, padding 14×16, `#F8FAFC`, 1px border. 44px initials avatar ("AO"), "Booking as Ada Okafor" 14.5/700, "email · phone" 12.5 `#64748B`. "Not you?" 13/700 ink signs the client out.
- **Signed out:** segmented control "Create account | Sign in" (same spec as the filter). Below it, a reassurance line with a Lucide `shield` 16 in `#16A34A`: "One Unclutter Desk account works with every practice. Each practice sees only its own records with you." (13/1.5 `#475569`).
  - Create account fields: First name + Last name (2-column grid, gap 12), Email, Phone, Password.
  - Sign in fields: Email, Password.
- **Inputs:** label 12.5/600 `#475569` with 6px gap above a 48px input, padding 0 14, radius 14, 1px `#E2E8F0`, `#F8FAFC`, text 14.5. **Focus:** background `#FFFFFF`, border `#94A3B8`, `0 0 0 3px var(--brand-ring)`.
- Optional note (textarea, 3 rows): "Anything the therapist should know before the first session?" with "Optional" in `#94A3B8`. Placeholder "Shared only with Dr. Smith."

### Step 4 — Review and pay
Title "Review and pay" · sub "Check the details of your session before you confirm."
- **Summary table:** radius 20, 1px `#E2E8F0`. Rows have padding 13×16, a 1px `#F1F5F9` divider, an 84px label column in `#64748B`, and values right-aligned in 600. Rows:
  - Session: "Individual therapy · 50 min"
  - When: "Tue, 6 Oct · 11:30 AM WAT"
  - Format
  - Therapist
  - Price
  - Discount row (when applied, `#16A34A`): "Discount · CALM10 / −₦3,500"
  - Total row: `#F8FAFC`, 15/700
- **Discount:** collapsed by default as the link button "+ Have a discount code?" (13.5/700 ink, 44px). When open, it shows a 48px input in JetBrains Mono (uppercase, .04em) next to `Button secondary xl` "Apply" (which reads "Remove" once applied). Applied: "You save ₦3,500. New total ₦31,500." 12.5 `#16A34A`. Invalid: input border `#E11D48` and "That code isn't valid for this session. Check the spelling or try another." 12.5 `#E11D48`.
- **Payment choice** (eyebrow "How you'd like to pay"): two radio cards, radius 18, padding 16, 1px `#E2E8F0`. Selected: `0 0 0 2px var(--brand-primary)`. The 20px radio ring has a 10px inner dot in brand primary.
  - "Pay online": "Card or bank, through Paystack. Payments processed securely by Paystack."
  - "Bank transfer": "Your time is held for 48 hours while you transfer." **Only render this option when the practice has enabled bank transfer.**
- **Transfer details** (when transfer is selected): `#F8FAFC` panel, radius 20, padding 16. Intro: "We'll hold your time for 48 hours. Transfer ₦35,000 using the reference below and the practice will confirm once it arrives." Rows: Bank, Account name, Account number (JetBrains Mono, **Copy**), Reference `UDK-4C81-2026` (JetBrains Mono, **Copy**). The Copy button is 36px, radius 10, 1px `#CBD5E1`. Its label changes to "Copied" for 1600ms (no toast).
- Cancellation line with Lucide `clock` 15: "Free cancellation up to 24 hours before." 13 `#475569`.

### Step 5 — Confirmation
No progress bar, no sticky bar.
- Centred icon circle, 60px: paid uses `#F0FDF4` with a `check` in `#16A34A`; transfer uses `#FFF7ED` with a `clock` in `#C2410C`.
- Title: "You're booked" (the only exclamation-free celebratory line). Transfer title: "Your time is held".
- Sub (paid): "A confirmation has been sent to your email. We look forward to seeing you." Sub (transfer): "Transfer ₦35,000 before the hold ends. The practice will confirm your session once the payment arrives."
- **Transfer only:** a `#FFF7ED` panel with the "TIME HELD FOR" eyebrow in `#C2410C` and a live countdown `47:59:12` (JetBrains Mono 18/700). Below it, a 6px progress bar showing the remaining share of 48h, then the bank rows again with Copy buttons.
- Details table: When / Format / With. Footer row on `#F8FAFC` with `Button secondary lg` "Add to calendar" (offer .ics and Google). For online sessions, add "Your video link will be emailed and shown in your account."
- **What's next:** eyebrow, then "Please complete two short forms before your first session. You can also do them later from the emailed link or your account." Two rows (radius 18, 1px border, 40px `--brand-fill` icon tile with Lucide `file-text`): "About you · Intake · about 8 min" and "Confidentiality agreement · Consent · about 2 min", each with a `Button secondary lg` "Start". The forms are filled in after booking, never during it.

---

## States
| State | Where | Treatment |
|---|---|---|
| Loading | Steps 1–2 | 3 skeleton cards (radius 20, `#F1F5F9` bars) pulsing opacity 1 → .55 over 1.4s ease-out. No spinners. |
| No services | Step 1 | Dashed `#CBD5E1` box, radius 20. Calendar icon tile, "No sessions open for booking", explanatory line, practice email link. Sticky bar hidden. |
| No times this week | Step 2 | Dashed box: "No times this week", "The next free time is on Tue, 13 Oct.", and a secondary button "Go to Tue, 13 Oct →" that jumps the week and day. |
| No times in 4 weeks | Step 2 | Dashed box: "No free times in the next 4 weeks", a short explanation, an email input and "Notify me". |
| Slot just taken | Step 2 | Banner `#FFF1F2` / icon `#E11D48`: "That time was just booked" / "Here are the nearest free times. Nothing has been charged." The time selection is cleared. |
| Payment failed | Step 4 | Same banner: "Your payment didn't go through" / "No money was taken. Try again, or choose bank transfer if the practice offers it." CTA becomes "Try again · ₦35,000". |
| Discount invalid / applied | Step 4 | See Step 4. |
| Signed-in client | Step 3 | See Step 3. |

## Interactions & behaviour
- Easing is ease-out everywhere. Colour/background 140–200ms; hover lift 160ms. No bounces.
- Primary button hover: `filter: brightness(1.08)`. Press: `translateY(1px)`. Disabled: opacity .6.
- Changing the service clears the time and resets the filter. Changing the day clears the time.
- Back keeps all earlier choices.
- Every touch target is at least 44px. There is no horizontal page scroll; the date strip pages a week at a time.
- Times are shown in the practice's local time (West Africa Time, WAT).
- Re-check slot availability on "Continue" from step 2 and again on pay. If the slot is gone, return to step 2 with the "slot just taken" banner.
- Paystack: open inline checkout on "Pay ₦X". Success goes to step 5; failure or close returns to step 4 with the failed banner.

## State management
```ts
step: 1|2|3|4|5
serviceId: string | null
weekIndex: 0..3; date: ISO; slotId: string | null
formatFilter: 'All'|'Online'|'In person'
authMode: 'create'|'signin'; session: Client | null
note: string
discount: { code, status: 'idle'|'applied'|'invalid', saving }
payMethod: 'online'|'transfer'; paymentStatus: 'idle'|'pending'|'failed'|'paid'
holdExpiresAt: ISO   // transfer, 48h from hold
```
Data: practice (name, logo, brand colours, rating, address, bankTransferEnabled, bank details, cancellation policy), services, availability for 28 days (each slot has a time and a format), client session, discount validation endpoint, booking reference (`UDK-XXXX-YYYY`).

## Design tokens
**Brand slots** (per tenant): `--brand-primary`, `--brand-secondary`, `--brand-on-primary`. Derived via `.desk-tenant`: `--brand-ring` (20%), `--brand-tint` (8%), `--brand-fill` (9%), `--brand-dot` (40%), `--brand-secondary-tint` (10%).
**Brand ink**: brand colour used as *text* (links, "Change", initials). For dark brands it equals primary. For light brands (lilac), compute a darkened ink so it keeps 4.5:1 on white. Compute `--brand-on-primary` automatically: `#FFFFFF` on dark primaries, a dark tint on light ones.

| Tenant tested | primary | secondary | on-primary | ink |
|---|---|---|---|---|
| Pine (Desk default, matches profile) | `#24614F` | `#8A5A3C` | `#FFFFFF` | `#24614F` |
| Deep teal (brief default) | `#0F3A53` | `#E3B341` | `#FFFFFF` | `#0F3A53` |
| Pale lilac (light test) | `#CDBDF2` | `#F2B8A0` | `#241B45` | `#5B45A0` |

**Product palette:** page `#F8FAFC`, card `#FFFFFF`, border `#E2E8F0`, strong border `#CBD5E1`, muted `#F1F5F9`. Text `#0F172A`, body `#475569`, secondary `#64748B`, subtle `#94A3B8`. Success `#16A34A` / `#F0FDF4`, pending `#C2410C` / `#FFF7ED`, danger `#E11D48` / `#FFF1F2`.
**Type:** Outfit only (variable). JetBrains Mono only for codes (transfer reference, account number, discount code). Use tabular numbers for prices, dates and times.
**Radius:** 24 card · 20 nested/table/service · 18 row/notice · 16 date cell / CTA · 14 input/control · 12 tile · 10 small button · 999 pill.
**Control heights:** 36 copy · 40 segment · 44 secondary/back/icon · 48 input / xl button · 52 CTA / time button.
**Shadows:** `--desk-shadow-sm` on cards. The selected ring is `0 0 0 2px var(--brand-primary)`. The focus ring is `0 0 0 3px var(--brand-ring)`.

## Assets
- `assets/unclutterdesk-mark.svg`: the "Booking powered by" footer mark (16px, 60% opacity). It comes from the Unclutter Desk design system.
- Icons: **Lucide** (`lucide-react`), stroke 2. Icons used: leaf (logo placeholder), star, lock, chevron-left/right, arrow-right, map-pin, shield, plus, circle-alert, clock, check, file-text, calendar.
- No photography in the booking flow. The tenant logo is uploaded by the practice.

## Files
- `Unclutter Desk Booking Wizard.dc.html`: the full board. It has every step at 390 / 1280, step 2 at 820, the lilac brand, both header variants, all states and the build notes. Every frame is interactive.
- `BookingWizard.dc.html`: the single component behind every frame. Props: `step`, `mode` (mobile/tablet/desktop), `brand`, `logo`, `state`, `signedIn`, `pay`, `singleService`, `time`. The logic class holds the step logic, sample data and copy.
- `Unclutter Desk Public Practice Profile.dc.html`: the entry page. "Book Consultation" routes to `/book`.
- `screenshots/`: a PNG of every frame on the board, named by frame id. `1a–1e` are phone steps (2x), `2a–2e` desktop steps, `3a` tablet, `4a–4d` lilac brand, `5a–5c` header variants and `6a–6l` states.
- `support.js` and `_ds/…`: the prototype runtime and design-system tokens/bundle needed to open the HTML locally.
