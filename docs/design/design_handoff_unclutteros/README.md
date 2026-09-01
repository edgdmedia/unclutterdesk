# Handoff: Unclutter Desk — Practice Management & White-Label Telehealth

## Overview

Unclutter Desk is a B2B SaaS platform with two distinct faces:

1. **The therapist workspace** — an internal practice-management app (dashboard, schedule, clients, brand settings, analytics) behind a login.
2. **The white-label client booking portal** — a public page served on the therapist's own domain, styled entirely in the therapist's brand colors and logo, with no Unclutter Desk chrome beyond a small "Booking powered by Unclutter Desk" footer line.

The central product idea, and the thing the design is built to demonstrate, is that **a single pair of tenant color tokens drives the entire public-facing experience**. The therapist picks a primary and secondary color in Brand Settings, and every branded element of the booking portal, confirmation screen, and their own workspace accents update from those two values.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior. They are **not production code to copy directly**.

They are authored as "Design Components": a single `.dc.html` file per artifact containing a declarative template and a small logic class, rendered by the bundled `support.js` runtime. That runtime is a prototyping tool, not a production dependency. Do not ship it.

The task is to **recreate these designs in the target codebase's existing environment** using its established patterns and libraries. Per the Unclutter design system, the intended stack is **React + Vite + Tailwind CSS**, with shared components in `@unclutter/ui` and services in `@unclutter/shared`, against a NestJS + Prisma + PostgreSQL API. If those packages exist, build on them rather than reimplementing primitives. If no environment exists yet, React + Tailwind is the right choice for consistency with the rest of the Unclutter suite.

Open any `.dc.html` file directly in a browser to view and interact with it.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, radii, shadows, and copy. Recreate the UI pixel-accurately using the codebase's existing libraries. Every hex value, font size, and radius quoted below is taken from the design files and is intentional.

Two caveats:
- **No photography.** Avatars are initials-in-a-rounded-square placeholders (`JS`, `AO`, `TB`). Real implementations should render an uploaded photo when present and fall back to initials.
- **Charts are CSS `div` bars**, not a charting library. Use the codebase's chart library; match the visual treatment described under Analytics.

---

## Design System Foundation

This design is bound to the **Unclutter Design System**, specifically its **Unclutter Desk sub-brand token layer** (`tokens/unclutterdesk.css` in this bundle). Import it and apply `data-app="os"` on a wrapping element to activate the OS semantic token remapping.

The critical structural idea in that file is the **white-label slot**:

```css
--brand-primary:       var(--os-navy);   /* per-tenant override */
--brand-primary-hover: var(--os-navy-700);
--brand-primary-soft:  var(--os-navy-100);
--brand-on-primary:    #FFFFFF;
--brand-secondary:     var(--os-gold);
--brand-on-secondary:  #0F172A;
--brand-ring:          color-mix(in srgb, var(--brand-primary) 25%, transparent);
```

Set these per tenant — on `<html data-tenant="…">` or inline as `style="--brand-primary:#7C3AED"` — and every component reads them. **The sidebar shell stays slate in every tenancy.** Tenant color enters the workspace only through the active nav item's gradient and accent elements; it never becomes the sidebar background.

### Colors

**Product chrome (fixed, never tenant-themed)**

| Token | Hex | Use |
|---|---|---|
| `--os-sidebar` | `#0F172A` | Sidebar background, dark hero cards |
| `--os-sidebar-hover` | `#1E293B` | Sidebar item hover |
| `--os-navy` | `#0F3A53` | Unclutter Desk primary, link color |
| `--os-navy-700` | `#0C2E42` | Primary hover |
| `--os-navy-500` | `#1B5375` | Avatar chip in sidebar footer |
| `--os-gold` | `#E3B341` | OS badge, active-nav edge marker + icon, star rating |
| `--os-gold-100` | `#FBF1DA` | WHITE-LABEL badge background (text `#8A6512`) |
| `--os-surface` | `#F8FAFC` | App background, muted fills |
| `--os-card` | `#FFFFFF` | Card background |
| `--os-border` | `#E2E8F0` | Standard border, dividers |
| `--os-border-strong` | `#CBD5E1` | Secondary button border, dashed uploader |
| `--os-text` | `#0F172A` | Primary text |
| `--os-text-muted` | `#64748B` | Secondary text |
| `--os-text-subtle` | `#94A3B8` | Eyebrow labels, placeholders, tertiary text |

`#FCFDFE` is used as a very faint alternate surface (table headers, booking body background). `#F1F5F9` is the muted control fill (segmented controls, search fields, read-only inputs). `#EEF2F6` is the canvas backdrop behind screen frames — presentation only, not part of the app.

**Status**

| State | Text | Background | Border |
|---|---|---|---|
| Active / success | `#059669` (dot `#10B981`) | `#ECFDF5` | `#A7F3D0` |
| Pending / intake | `#B45309` (dot `#D97706`) | `#FFFBEB` | `#FDE68A` |
| Inactive / paused | `#64748B` | `#F1F5F9` | `#E2E8F0` |
| Danger | `#E11D48` | `#FFF1F2` | `#FECDD3` |

**Tenant brand (demo values)**

Primary `#007BFF`, secondary `#6F42C1`. The preset swatch pairs offered in Brand Settings:

| Name | Primary | Secondary |
|---|---|---|
| Unclutter Desk navy | `#0F3A53` | `#E3B341` |
| Signal blue (default) | `#007BFF` | `#6F42C1` |
| Calm teal | `#0E7490` | `#F59E0B` |
| Deep violet | `#7C3AED` | `#EC4899` |
| Forest | `#15803D` | `#B45309` |

**Derived tenant values.** The design derives tints by appending 8-bit alpha to the primary hex. Reproduce with `color-mix` or an alpha channel:

| Derived | Formula | Use |
|---|---|---|
| soft | `primary + 18` (≈9%) | Avatar chips, icon containers, hover fills |
| ring | `primary + 33` (≈20%) | Focus rings, colored shadows under primary buttons |
| tint | `primary + 14` (≈8%) | Booking portal header gradient start |
| secondary soft | `secondary + 1A` (≈10%) | Credentials badge background |
| calendar dot | `primary + 66` (40%) | Availability dot on selectable dates |
| chart bar (inactive) | `primary + 2E`–`+30` (≈18%) | Non-current months in revenue charts |

### Typography

**Outfit** throughout (Google Fonts, weights 300–900). Fallback `system-ui, sans-serif`.

| Role | Size | Weight | Letter-spacing | Color |
|---|---|---|---|---|
| Page display (booking H1) | 30px | 800 | −0.035em | `#0F172A` |
| Stat hero (₦450,000) | 40px | 800 | −0.04em | `#0F172A` |
| Screen title (header bar) | 20px | 700 | −0.02em | `#0F172A` |
| Page title (in-body) | 24px | 800 | −0.035em | `#0F172A` |
| Card title | 17px | 700 | −0.02em | `#0F172A` |
| Stat value (tiles/KPIs) | 22–26px | 800 | −0.03em | `#0F172A` |
| Row title (client name) | 14–15.5px | 700 | −0.01em | `#0F172A` |
| Body | 13–14px | 400–500 | — | `#475569` / `#64748B` |
| Meta / caption | 11–12.5px | 400–600 | — | `#64748B` / `#94A3B8` |
| **Eyebrow label** | **9px** | **900** | **0.22em**, uppercase | `#94A3B8` |
| Badge / pill | 10–11px | 700–800 | 0.05–0.08em | varies |
| Nav item | 13.5px | 600 | — | `#94A3B8`, active `#FFFFFF` |
| Mono (hex codes, CNAME) | 12–12.5px | 600 | — | `#0F172A` |

The 9px/900/0.22em uppercase eyebrow is the design's most distinctive type signature and appears above nearly every card and section. Use it consistently.

Numeric columns should use `font-variant-numeric: tabular-nums`.

### Spacing, Radius, Elevation

**Radius:** cards 24px (`--os-radius-card`); nested/secondary cards 20–22px; list rows and inputs 14–18px; small controls 10–12px; pills and dots 999px; phone frames 46px; avatar chips 12–15px.

**Control heights:** sm 32px, md 40px, lg 44–48px. Booking portal primary CTA is 52px, mobile 54px.

**Padding:** app header 0 26px (80px tall); workspace body 24px 26px 30px; standard card 20–26px; list row 13–16px; table row 14px 22px.

**Gaps:** card grid 20px; KPI grid 14px; list rows 8–10px; inline control clusters 8–10px.

**Shadows:**

| Level | Value |
|---|---|
| xs | `0 1px 2px rgba(15,23,42,.05)` |
| sm (cards) | `0 1px 3px rgba(15,23,42,.06)` |
| md | `0 4px 16px rgba(15,23,42,.07)` |
| lg (raised card) | `0 12px 34px rgba(15,23,42,.09)` |
| card hover | `0 8px 24px rgba(15,23,42,.08)` + `translateY(-1px)` |
| screen frame | `0 24px 80px rgba(15,23,42,.14)` |
| phone frame | `0 24px 70px rgba(15,23,42,.20)` |
| primary button | `0 6px 18px rgba(15,58,83,.22)` |
| tenant CTA | `0 10px 26px var(--brand-ring)` |
| active nav item | `inset 0 0 0 1px rgba(227,179,65,.28), 0 8px 24px rgba(15,58,83,.5)` |

**Glass (mobile bottom nav, sticky bars):** `background: rgba(255,255,255,.85); backdrop-filter: blur(18px) saturate(140%); border-top: 1px solid #E2E8F0; border-radius: 24px 24px 0 0`.

---

## Screens

### Shared: Desktop app shell

Full-height flex row. Minimum viewport width **1440px** — the workspace layouts are authored for it and do not currently have a responsive collapse.

**Sidebar** — 248px fixed, `#0F172A`, padding 20px 14px, flex column, gap 3px.
- Brand lockup at top: 30px mark (radius 9px), wordmark "unclutter" 17px/600/−0.02em `#F8FAFC`, then a gold pill reading "OS" (18px tall, padding 0 8px, radius 999px, `#E3B341` on `#0F172A`, 9px/800/0.08em). Padding 4px 8px 22px.
- Five nav items: **Dashboard, Schedule, Clients, Brand Settings, Analytics**. Each 44px tall, padding 0 12px, radius 14px, 13.5px/600, icon 18px stroke-2 rounded caps, gap 11px.
  - Rest: `#94A3B8`, transparent background.
  - Hover: background `#1E293B`, text `#E2E8F0`. No movement, no scale.
  - **Active**: text `#FFFFFF`; background `linear-gradient(90deg, rgba(15,58,83,.9), rgba(27,83,117,.55))`; `box-shadow: inset 0 0 0 1px rgba(227,179,65,.28), 0 8px 24px rgba(15,58,83,.5)`; a 3px × 20px gold bar (`#E3B341`, radius `0 3px 3px 0`) flush to the left edge; icon stroke `#E3B341`. Only one item is ever active.
  - Counters sit at `margin-left:auto`: 20px tall, radius 999px, 10.5px/800. Neutral `rgba(255,255,255,.1)` on `#CBD5E1` for informational totals (Clients "128"); gold `#E3B341` on `#0F172A` for time-sensitive (Schedule "4"); `#E11D48` on white for items needing action. Cap display at `99+`.
- Footer pinned with `margin-top:auto`, separated by `1px solid rgba(255,255,255,.07)`, padding 14px 10px 2px: 32px avatar chip (radius 10px, `#1B5375`, white 12px/800) + name 12.5px/600 `#E2E8F0` + role 10px `#64748B`.

**Header bar** — 80px, white, `border-bottom: 1px solid #E2E8F0`, padding 0 26px, flex, gap 20px. Left: eyebrow + screen title. Right cluster at `margin-left:auto`, gap 10px.

---

### 1. Dashboard (`/`)

**Purpose.** Morning check-in: what's earning, who's coming, and one-click access to the booking link the therapist shares with clients.

**Header right cluster:**
- **Booking link field** — 44px, `#F1F5F9`, `1px solid #E2E8F0`, radius 14px, padding `0 6px 0 14px`, gap 10px. A 15px link icon, a read-only input (238px, transparent, 13px/500 `#334155`) showing `unclutterdesk.com/booking/dr-smith`, and a 32px white copy button (radius 10px, `0 1px 2px rgba(15,23,42,.08)`, hover `#E2E8F0`).
- **Copy Booking Link button** — 44px, padding 0 20px, radius 14px, `background: var(--brand-primary)`, white 14px/700, copy icon + label, `box-shadow: 0 6px 18px rgba(15,58,83,.22)`, `white-space: nowrap`. Hover `filter: brightness(1.08)`. On click: copy `https://unclutterdesk.com/booking/dr-smith`, swap the label to **"Link copied"** for 1600ms, then revert.
- A 1px × 28px `#E2E8F0` divider, then a 44px notification button (white, `1px solid #E2E8F0`, radius 14px) with a 7px `#E11D48` dot at top 9px / right 9px, ringed `1.5px solid #fff`.

**Body:** `display:grid; grid-template-columns: minmax(0,1fr) 372px; gap:20px; align-items:start`.

**Left column — Revenue Summary** (white, `1px solid #E2E8F0`, radius 24px, padding 24px 26px, shadow sm):
- Eyebrow "REVENUE THIS MONTH".
- `₦450,000` at 40px/800/−0.04em, beside a trend pill: 24px tall, radius 999px, `#ECFDF5` / `1px solid #A7F3D0` / `#059669`, 12px/700, up-chevron + `18.2%`.
- Sub-line 13px `#64748B`: "August 2026 · vs ₦380,500 in July".
- Three stat tiles pushed right (`margin-left:auto`), **`flex-wrap: wrap; justify-content: flex-end`** so they wrap rather than overflow: min-width 96px, padding 12px 14px, radius 16px, `#F8FAFC`, `1px solid #E2E8F0`; value 22px/800/−0.03em, label 11px/500 `#64748B`. Values: `62` Total sessions · `₦7,258` Avg. per session · `94%` Attendance.
- 12-month bar row, 96px tall, gap 10px. Bars radius `8px 8px 3px 3px`, min-height 6px, `transition: height .3s ease`. Current month filled `--brand-primary`; prior months `primary + 30`. Month labels 10px/600 `#94A3B8`.

**Left column — Upcoming Client Sessions** (same card treatment, padding 22px 24px 24px):
- Eyebrow "UPCOMING" + title "Client sessions today". Right: a date chip (32px, `#F1F5F9`, radius 10px, 12.5px/700 `#475569`, "Thu, 7 Aug") and a "View schedule" link-button (32px, white, `1px solid #CBD5E1`, radius 10px, `#0F3A53`).
- Rows: 14px 16px padding, `1px solid #E2E8F0`, radius 18px, gap 16px. Hover `box-shadow: 0 8px 24px rgba(15,23,42,.08); transform: translateY(-1px)`.
  - 52px time block (start 15px/800, end 10.5px/600 `#94A3B8`), 1px × 34px divider, 38px avatar chip (radius 12px, tenant soft/primary), name 14.5px/700 + "{type} · {mode}" 12px `#64748B`.
  - Right: status pill, then **Notes** (secondary, 34px, radius 11px), **Start session** (tenant primary, 34px, radius 11px), and a 34px `⋯` overflow button.
  - Data: `14:00–15:00 Adaeze Okonkwo · Individual Therapy · Telehealth · Confirmed`; `15:30–16:20 Tunde Bello · Individual Therapy · In-person · Confirmed`; `17:00–18:00 Ngozi & Michael · Couples Therapy · Telehealth · Awaiting intake` (pending styling).

**Right column — Profile Photo** (radius 24px, padding 22px):
- Eyebrow "PROFILE PHOTO". 76px avatar, radius 24px, tenant soft fill / primary text, 24px/800, `box-shadow: 0 0 0 3px var(--brand-ring)`; a 24px `#10B981` online dot with `3px solid #fff` at bottom −3px / right −3px.
- Name 15px/700, "Clinical Psychologist · MSc" 12.5px `#64748B`, and an 11.5px `#94A3B8` constraint line with info icon: **"JPG or PNG · max 2 MB"**.
- **Upload Photo** (flex:1, 40px, radius 14px, tenant primary, upload icon + label) and **Remove** (secondary, 40px).

**Right column — Practice Status** (radius 24px, padding 20px 22px, flex row):
- Eyebrow "PRACTICE STATUS", an 8px status dot, and the label at 16px/700 — **"Active Practice"** / **"Inactive Practice"**.
- Helper text 12px `#64748B`, max-width 210px, `text-wrap: pretty`:
  - Active: "Your booking page is live and accepting new client bookings."
  - Inactive: "Your booking page is hidden. Existing sessions are unaffected."
- Toggle: 60px × 34px, radius 999px, padding 3px, `transition: background .2s ease`. Track `#10B981` active / `#CBD5E1` inactive. Knob 28px white, `0 2px 6px rgba(15,23,42,.22)`, `transform: translateX(26px)` when on, `transition: transform .2s ease`.

**Right column — Brand Styling Customizer** (radius 24px, padding 22px):
- Eyebrow "BRAND STYLING" + title "Your booking page"; a gold "WHITE-LABEL" pill at `margin-left:auto` (22px, radius 999px, `#FBF1DA` / `#8A6512`, 10px/800/0.06em).
- Two color fields in a 2-col grid: a 36px native color input (radius 10px, chrome removed via `-webkit-appearance:none` and `::-webkit-color-swatch { border:none; border-radius:10px }`) beside a 11px/700 `#64748B` role label and the uppercase mono hex. Wrapper: padding 10px 12px, `1px solid #E2E8F0`, radius 16px, `#F8FAFC`. Fires on both `change` and `input` for live update.
- Preset row: label "Presets" 10.5px/700 `#94A3B8`, then five 30px split swatches (radius 10px, two half-width fills, `2px solid` border — `#0F172A` when that preset's primary is current, else `#E2E8F0`). Clicking sets both colors.
- **Logo uploader**: dashed drop target, `1.5px dashed #CBD5E1`, radius 16px, `#F8FAFC`, padding 12px 14px; hover border `#94A3B8`, background `#F1F5F9`. 40px white logo tile, filename `jane-smith-logo.svg` 13px/700, constraint "SVG or PNG · max 2 MB · replace" 11px `#94A3B8`, and an "Upload" chip at right.
- **Custom domain (CNAME)**: label + a green "VERIFIED" pill; a 44px field (`#F8FAFC`, `1px solid #E2E8F0`, radius 14px) with globe icon and value `booking.drsmiththerapy.com`; helper 11px `#94A3B8` — "Point a CNAME record at `cname.unclutterdesk.com`" with the host in a mono chip (`#F1F5F9`, radius 5px, padding 1px 5px, `#0F3A53`).
- **Save brand settings** — full width, 44px, radius 14px, tenant primary.

---

### 2. White-Label Client Booking Portal (public)

**Purpose.** A client, arriving from the therapist's link, picks a service, a date and time, enters their details, and pays. Authored at **1180px**; presented inside a browser-chrome frame (44px bar, three 11px traffic-light dots, centered URL pill with a green padlock reading `booking.drsmiththerapy.com`) purely to communicate that this is a public page on the therapist's own domain — do not build the chrome.

**Dynamic brand header** — padding 30px 40px 26px, `background: linear-gradient(120deg, primary+14, secondary+12)`, `border-bottom: 1px solid primary+33`.
- 82px white logo tile, radius 26px, `0 8px 24px rgba(15,23,42,.10)`, initials in tenant primary at 26px/800.
- Practice name **"Dr. Jane Smith Therapy"** as an 11px/900/0.2em uppercase eyebrow *in the tenant primary color*.
- Credentials badge **"CLINICAL PSYCHOLOGY"** — 20px pill, `secondary + 1A` background, secondary text, 10px/800/0.06em.
- H1 "Book a session with Dr. Jane Smith", 30px/800/−0.035em.
- Meta row, 13px `#475569`, gap 16px: a gold star glyph (`#E3B341`) with **4.9** bold + "· 214 reviews"; a pin icon with "Lagos, Nigeria · Online & in-person"; a check icon with "Licensed · 12 years practising".

**Body** — padding 30px 40px 40px, `grid-template-columns: 1fr 348px; gap: 28px; align-items: start`, background `#FCFDFE`.

Each step is introduced by a 22px numbered circle in the tenant primary (white 11px/800) beside a 16px/700 heading: **1 Choose a service**, **2 Pick a date & time**, **3 Your details**.

**Service cards** (2-col grid, gap 12px): padding 18px, radius 20px, white, `2px solid` — tenant primary when selected, `#E2E8F0` otherwise; selected also gets `box-shadow: 0 10px 28px var(--brand-ring)`. Title 15px/700, detail 12.5px `#64748B`, price 24px/800/−0.03em + "per session" 12px `#94A3B8`. The corner pill reads its category ("MOST BOOKED", "80 MIN") when unselected and flips to **"SELECTED"** in a solid tenant-primary pill with white text when chosen.
- `50-minute Individual Session` — "One-to-one therapy · online or in person" — **₦30,000** — MOST BOOKED (selected by default)
- `80-minute Couples Session` — "For partners attending together" — **₦52,000** — 80 MIN

**Scheduling widget** — white card, `1px solid #E2E8F0`, radius 22px, padding 20px, `grid-template-columns: 1fr 216px; gap: 20px`.
- *Calendar*: prev/next 30px buttons, "August 2026" 14.5px/700, "WAT (GMT+1)" 11.5px `#94A3B8` at right. 7-column grid, gap 6px, Monday-first; day-of-week headers 10px/800/0.1em `#94A3B8`. Cells 38px, radius 12px, 13px/600.
  - Unavailable: transparent, text `#CBD5E1`, `cursor: default`.
  - Available: `#F8FAFC`, `1px solid #E2E8F0`, text `#0F172A`, and a 4px availability dot at `bottom: 5px` in `primary + 66`.
  - Selected: solid tenant primary, white text and border, dot `rgba(255,255,255,.65)`.
  - Demo open days in August 2026: 10–14, 17–21, 24–28, 31. Default selection: 14.
- *Time slots*: left border `1px solid #E2E8F0`, padding-left 20px. Eyebrow "AVAILABLE TIMES", then the long date (e.g. "Friday, 14 August 2026") at 13px/600. Pills 42px, radius 999px, 13.5px/700, `1.5px solid` — white/`#E2E8F0`/`#0F172A` at rest, solid tenant primary with white text when selected. Slots: **9:00 AM, 11:30 AM, 2:00 PM, 4:30 PM** (default 11:30 AM). Footnote 11.5px `#94A3B8`: "Times shown in your local timezone. Sessions run 50 minutes."

**Intake form** — white card, radius 22px, padding 22px, 2-col grid, gap 14px. Labels 11.5px/700 `#475569`, 6px below. Inputs 46px, padding 0 14px, `1px solid #E2E8F0`, radius 14px, `#F8FAFC`, 14px text; focus → background `#FFFFFF`, border `#94A3B8`.
- **Full name** (`Adaeze Okonkwo`), **Email address** (`adaeze@email.com`), **Phone number** (`+234 801 234 5678`) — placeholders only, all are required in production.
- **Session format** — a 46px segmented control (`#F1F5F9`, radius 14px, 4px padding); selected segment white with `#0F172A` text, radius 11px. Options: Online / In-person.
- **Share concerns (optional)** — full width, 3-row textarea, `resize: none`, line-height 1.6, placeholder "Anything you'd like Dr. Smith to know before your first session." The word "(optional)" is 500-weight `#94A3B8` inside the label.
- Footer reassurance 11.5px `#94A3B8` with a green shield icon: "Encrypted and confidential. Shared only with Dr. Smith."

**Session summary sidebar** — `position: sticky; top: 24px`, white, radius 22px, `overflow: hidden`, `1px solid #E2E8F0`, `box-shadow: 0 12px 34px rgba(15,23,42,.09)`.
- Header band in **solid tenant primary**, padding 16px 22px: eyebrow "SESSION SUMMARY" in `rgba(255,255,255,.75)`, title "Individual Therapy" 17px/700 white.
- Recap rows: key 12.5px `#94A3B8` in a 78px fixed column, value 13.5px/600 right-aligned. Rows: **Service, Date, Time** (`11:30 AM WAT · 50 min`), **Therapist** (Dr. Jane Smith), **Format**. All bound to live selection.
- 1px divider, then "Total" 13px/700 `#475569` and **₦30,000** at 26px/800/−0.035em, with "Paid securely at booking" 11.5px `#94A3B8` beneath.
- **Confirm & Book Session** — full width, 52px, radius 16px, tenant primary, white 15px/700, right-arrow icon, `box-shadow: 0 10px 26px var(--brand-ring)`, hover `filter: brightness(1.08)`.
- Below: a padlock line "Free cancellation up to 24 hours before".
- Footer strip, `#F8FAFC`, `border-top: 1px solid #E2E8F0`, padding 14px 22px: 16px mark at 60% opacity + "Booking powered by Unclutter Desk" 10.5px `#94A3B8`. **This is the only Unclutter Desk branding on the public page.**

---

### 3. Schedule (`/schedule`)

**Purpose.** See and manage the working week.

**Header right:** a 40px segmented control (`#F1F5F9`, radius 14px, 4px padding) — **Week** (selected: white, `#0F172A`, `0 1px 2px rgba(15,23,42,.08)`) / Day / Month; a secondary **Set availability** button; a primary **+ New session** button.

**Body:** a title row — "3 — 7 August 2026" 15px/700, prev/next 32px buttons, and a legend at right (11.5px `#64748B`, 10px radius-4 swatches): tenant primary = Individual, tenant secondary = Couples, `#CBD5E1` = Admin block.

**Week grid** — white card, `1px solid #E2E8F0`, radius 24px, `overflow: hidden`, **`flex: none`** (it must not be shrunk by its scroll container, or its lower rows become clipped and unreachable). `grid-template-columns: 64px repeat(5, 1fr)`.
- Gutter column `#FCFDFE`, `border-right: 1px solid #E2E8F0`, a 58px header spacer, then hour labels 9 AM → 6 PM, each 62px tall, right-aligned, 10.5px/600 `#94A3B8`, nudged `translateY(-6px)` to sit on the gridline.
- Day columns: 58px header (day-of-week 9px/900/0.18em `#94A3B8` over date 15px/700), then a 620px `position: relative` canvas ruled with `repeating-linear-gradient(#fff 0 61px, #EEF2F6 61px 62px)`.
- Events absolutely positioned, inset 6px left/right, radius 12px, padding 8px 10px, `background: category+14`, `border: 1px solid category+55`, `border-left: 3px solid category`, hover `filter: brightness(.97)`. Title 12px/700 with ellipsis; subtitle 10.5px `#64748B`.
- **Geometry:** hour row height 62px, timeline origin 9:00. `top = (startMinutes − 540) / 60 × 62`; `height = durationMinutes / 60 × 62 − 5`.

Demo week (Mon 3 – Fri 7 August 2026) contains individual sessions, couples sessions, and grey admin blocks (Supervision, Notes & billing, Intake calls).

---

### 4. Clients (`/clients`)

**Purpose.** The caseload roster — volume, status, and next appointment at a glance.

**Header right:** a 40px search field (`#F1F5F9`, `1px solid #E2E8F0`, radius 14px, magnifier icon, 200px input, placeholder "Search clients"), a secondary **Export**, a primary **+ Add client**.

**KPI row** — 4 equal cards, gap 14px, radius 20px, padding 16px 18px: eyebrow + 26px/800/−0.03em value. **Active clients 128 · In intake 7 · Paused 12 · New this month 9**.

**Roster table** — white card, radius 24px, `overflow: hidden`, **`flex: none`** (same shrink caveat as the Schedule grid). Columns `2.2fr 1fr .7fr 1.1fr .9fr 90px`, gap 16px.
- Header row: `#FCFDFE`, `border-bottom: 1px solid #E2E8F0`, padding 14px 22px, labels 9px/900/0.18em uppercase `#94A3B8` — Client, Care type, Sessions, Next session, Status.
- Body rows: padding 14px 22px, `border-bottom: 1px solid #F1F5F9`, hover `#FCFDFE`. 38px avatar chip (radius 12px) tinted by care type — tenant primary soft for Individual, tenant secondary soft for Couples. Name 14px/700 over email 11.5px `#94A3B8`. Sessions count 13px/700. Status pill per the status table. Row actions: a 32px edit (pencil) button and a 32px `⋯` button, right-aligned.
- Footer: "Showing 7 of 128 clients" 12px `#94A3B8` with Previous / Next buttons (30px, radius 9px).

---

### 5. Analytics (`/analytics`)

**Purpose.** Practice performance over time and where bookings originate.

**Header right:** a range segmented control — 30 days / 90 days / **12 months** (selected) — and a secondary **Download report**.

**KPI row** — 5 cards, gap 14px, radius 20px, padding 16px 18px: eyebrow (9px/900/0.2em), value 26px/800/−0.035em, and a green delta pill (22px, `#ECFDF5` / `1px solid #A7F3D0` / `#059669`, 11.5px/700).

| Metric | Value | Delta |
|---|---|---|
| Revenue · 12 mo | ₦4.28M | +31.4% |
| Sessions delivered | 618 | +12.9% |
| Client retention | 78% | +4.1 pts |
| No-show rate | 6% | −2.3 pts |
| Booking page views | 2,940 | +58% |

**Revenue by month** — card padding 24px 26px. Title 17px/700 beside "Sep 2025 — Aug 2026 · ₦4,281,000 total" 12.5px `#64748B`. A 220px bar row, gap 14px: value label above each bar (11px/700 `#64748B`), bar radius `10px 10px 4px 4px`, month label below (10.5px/600 `#94A3B8`). Current month in tenant primary, prior months `primary + 2E`. Monthly values (₦ thousands): 238, 262, 251, 305, 288, 331, 318, 372, 355, 401, 380, 450.

**Session mix** — half-width card. Per row: name 13.5px/700, count 12px `#94A3B8`, percentage 13.5px/800 right-aligned; a 10px track (`#F1F5F9`, radius 999px) with a filled bar. Individual · 50 min — 412 sessions — 67% (tenant primary); Couples · 80 min — 128 sessions — 21% (tenant secondary); Intake consults — 78 sessions — 12% (`#94A3B8`).

**Where bookings come from** — half-width card, rows separated by `1px solid #F1F5F9`, padding 13px 0: source 13.5px/600 (ellipsis), views 12px `#94A3B8`, share 13.5px/800 in a 40px right-aligned column. Direct booking link 1,412 / 48%; booking.drsmiththerapy.com 926 / 32%; Referral from GP network 412 / 14%; Instagram bio 190 / 6%.

---

### 6. Booking Confirmed (public)

**Purpose.** Post-payment receipt and next steps, still fully in the therapist's brand.

Centered column, padding 52px 40px 56px, `background: linear-gradient(180deg, primary+14, #FCFDFE 240px)`.
- 72px success tile, radius 26px, solid tenant primary, `box-shadow: 0 14px 34px var(--brand-ring)`, white 34px checkmark (stroke 2.6).
- "Your session is booked" 32px/800/−0.035em, centered.
- Sub-copy 15px `#475569`, max-width 460px, `text-wrap: pretty`: "A confirmation has been sent to your email, along with a secure telehealth link you can open five minutes before the session."
- Receipt card, 560px, white, radius 24px, `overflow: hidden`, `box-shadow: 0 12px 34px rgba(15,23,42,.09)`:
  - Header row: 46px therapist avatar (tenant soft), name 15.5px/700, "Clinical Psychology · 50-minute Individual Session" 12.5px `#64748B`, and a green **Confirmed** pill.
  - Rows (key column 100px): **Booking ref** `UOS-4C81-2026`, Date, Time, Therapist, Format, **Paid** `₦30,000 · Card ending 4412`.
  - Two 48px buttons, gap 10px: **Add to calendar** (tenant primary) and **Reschedule** (secondary).
  - Same "Booking powered by Unclutter Desk" footer strip.
- Closing line 12.5px `#94A3B8`: "Free cancellation up to 24 hours before your session."

---

### Mobile app (`Unclutter Desk Mobile.dc.html`)

Five screens at **390 × 844** (frames drawn at radius 46px for presentation only — build to the device viewport).

Shared **bottom navigation**: 92px tall, glass treatment, `border-radius: 24px 24px 0 0`, four items evenly distributed, padding `12px 14px 0`. Each item is a 52px column, gap 5px, padding 0 14px, radius 16px: 20px icon over a 10px/700 label. The **active** item is a solid `#0F172A` pill with white icon and label; inactive `#94A3B8`. Tabs: **Today, Schedule, Clients, Brand**.

Status bar: 52px, time "9:41" 13px/700 `#0F172A`, bottom-aligned with 6px padding.

**1 · Today.** 44px avatar chip, "THURSDAY, 7 AUGUST" 11px/800/0.14em eyebrow, "Good morning" 19px/800/−0.03em, 40px notification button with red dot. Then a **dark revenue hero**: `#0F172A`, radius 32px, padding 22px 24px, `box-shadow: 0 18px 40px rgba(15,23,42,.28)` — eyebrow `#64748B`, a green `rgba(16,185,129,.16)`/`#34D399` delta pill, `₦450,000` at 36px/800/−0.04em white, a 44px mini bar row (current month white, others `rgba(255,255,255,.22)`), and three stats above a `rgba(255,255,255,.08)` rule: 62 Sessions · 94% Attendance · 128 Clients. Below: "NEXT UP" eyebrow with a "See all 3" link in tenant primary; a next-session card (radius 26px) with a 46px **Start session** button and a 46px edit button; then two compact later-today rows (radius 22px).

**2 · Schedule.** Title 24px/800 with a "+ Session" pill in tenant primary. A 7-day strip: 66px cells, radius 20px, day letter over date over a 4px dot; the selected day is solid tenant primary, weekend days dimmed to `#CBD5E1`. Then "FRIDAY, 7 AUGUST" with "3 sessions · 2h 50m", and a timeline list: a 52px right-aligned time gutter (13px/800 time over 10.5px duration) beside a card with `border-left: 4px solid {category}`, radius 20px, name 14.5px/700, category pill, subtitle 12px.

**3 · Clients.** Title with "128 active". A 46px search field, radius 16px. Filter chips (32px, radius 999px) — All (active: `#0F172A`, white) / Active / Intake / Paused. Then rows: 44px avatar chip, name 14.5px/700 over "Individual · 14 sessions" 11.5px, an 8px status dot, and a `#CBD5E1` chevron.

**4 · Brand & booking link.** A hero card in `linear-gradient(135deg, primary, secondary)`, radius 28px, `box-shadow: 0 16px 36px var(--brand-ring)`: eyebrow "YOUR BOOKING LINK", the domain at 16px/700 white, a white **Copy link** button (44px, radius 15px — label swaps to "Copied" for 1600ms) and a translucent **Share** button. Below: brand colors card with two read-only swatch fields and the five presets; a practice-status card with a 58px toggle; and a logo card with a **Replace** chip.

**5 · Client booking (mobile web).** A 38px inset URL bar (`#F1F5F9`, radius 12px, padlock + domain) standing in for browser chrome. Brand header at `linear-gradient(140deg, primary+14, secondary+12)`, padding 22px 20px: 62px logo tile (radius 22px), practice name eyebrow in tenant primary, therapist name 20px/800, credentials pill and star rating. Then the flow, single column: selected service card (`2px solid` tenant primary, `0 8px 24px var(--brand-ring)`); a 6-across date strip (62px cells, radius 18px); wrapping time pills (42px, radius 999px); three 50px inputs. Pinned to the bottom, a **sticky glass action bar** (padding `14px 20px 26px`, `border-top: 1px solid #E2E8F0`): a recap line ("Tue 11 Aug · 11:30 AM") with **₦30,000** at 19px/800 right-aligned, above a 54px **Confirm & Book Session** button (radius 18px, tenant primary, `0 10px 26px var(--brand-ring)`).

---

## Interactions & Behavior

**Motion.** All easing is `ease-out` — no bounces, no spring. Durations: color/background 140–200ms; hover shadow and lift 160ms; bar height 300ms; toggle track and knob 200ms.

**Hover.** Cards lift `translateY(-1px)` and gain `0 8px 24px rgba(15,23,42,.08)`. Primary buttons use `filter: brightness(1.08)` — this is what makes hover work for an arbitrary tenant color without a second token. Secondary buttons go `#F1F5F9`. Sidebar items change background and text only; no transform. Press state is `translateY(1px)`.

**Focus.** `box-shadow: 0 0 0 3px var(--brand-ring)`. Inputs also switch background `#F8FAFC → #FFFFFF` and border `#E2E8F0 → #94A3B8`.

**Copy to clipboard.** Both the desktop field's icon button and the primary CTA copy the same URL. Feedback is a label swap ("Copy Booking Link" → "Link copied", "Copy link" → "Copied") for 1600ms — no toast. Clear any pending timer before setting a new one.

**Selection.** Service cards, calendar dates, time slots, and format segments are single-select and update the summary sidebar live. Unavailable calendar dates are inert (`cursor: default`, no handler).

**Brand color changes propagate immediately** — the color inputs fire on both `input` and `change`, so dragging in the picker updates the preview continuously.

**Booking flow.** Confirm & Book Session → confirmation screen. Reschedule → back to the booking form with selections intact.

**Practice status.** Toggling to Inactive should hide the public booking page (or serve a "not currently accepting bookings" state) without affecting already-booked sessions — the helper copy makes that promise, so honor it server-side.

**Responsive.** The desktop workspace is authored for **≥1440px** and has no mobile breakpoint; the mobile app covers small screens. The booking portal is authored at 1180px desktop and 390px mobile — build it responsive between those two, since clients arrive on whatever device they have. Note that in the Brand Settings preview pane the 1180px portal is **scaled** (`zoom: .6`), not reflowed; in production use an iframe at full width, or scale similarly.

**Not yet designed** (state exists in the design but has no visual treatment): loading and skeleton states, empty states (no clients, no sessions today, no revenue history), form validation errors, payment failure, and CNAME-unverified. Ask before inventing them.

## State Management

Per-tenant, persisted server-side:
- `brandPrimary`, `brandSecondary` (hex) — drive `--brand-primary` / `--brand-secondary` and everything derived
- `logoUrl`, `avatarUrl` — both capped at **2 MB**; avatar accepts JPG/PNG, logo accepts SVG/PNG
- `customDomain` + `domainVerified` (CNAME status)
- `practiceActive` (boolean) — gates the public booking page
- `bookingSlug` — the `unclutterdesk.com/booking/:slug` fallback URL

Per-session UI state, client-side:
- `selectedService`, `selectedDate`, `selectedSlot`, `sessionFormat`
- `copied` (transient, 1600ms)
- Desktop app: `activeScreen`; Brand Settings: `previewMode` (booking | confirmed)

Data the screens need: monthly revenue series (12 points) and current-month totals; today's sessions with client, time, type, mode, status; the week's events with start/end/category; a paginated client roster with status and next appointment; analytics aggregates (KPIs, session mix, referral sources); and, for the public portal, the therapist's public profile, service catalogue with prices, and real availability for the displayed month.

## Assets

- `assets/unclutterdesk-mark.svg` — Unclutter Desk app mark. Used in the sidebar (30px), the "powered by" footers (16px at 60% opacity), and mobile.
- `assets/unclutterdesk-lockup.svg` — full lockup, included for completeness.
- **Outfit** from Google Fonts, weights 300–900.
- Icons are inline SVG in the mock, drawn in the **Lucide** style — 24×24 viewBox, `stroke-width: 2`, `stroke-linecap`/`linejoin: round`, no fill. In production use `lucide-react` and match sizes: 14–15px inline, 18px nav, 20px mobile nav.
- No photography anywhere. Avatars are initials placeholders.
- `₦` (Nigerian Naira, U+20A6) is the currency throughout; amounts are comma-grouped with no decimals.

## Files

| File | Contents |
|---|---|
| `Unclutter Desk Screens.dc.html` | Spec board — all six desktop/public screens laid out side by side on one canvas. The reference for exact values. |
| `Unclutter Desk Prototype.dc.html` | Clickable desktop app: sidebar navigation across five screens, Brand Settings with a live scaled booking preview, and the booking → confirmation transition. |
| `Unclutter Desk Mobile.dc.html` | Five mobile screens (Today, Schedule, Clients, Brand, client booking). |
| `tokens/unclutterdesk.css` | The Unclutter Desk sub-brand token layer, including the white-label slots. Import this. |
| `tokens/colors_and_type.css` | Base Unclutter design system tokens that the OS layer extends. |
| `assets/` | Logo mark and lockup. |
| `support.js` | Prototype runtime. Required to open the `.dc.html` files locally. **Not a production dependency.** |
