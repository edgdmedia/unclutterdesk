
# Handoff: Mobile companion app + collapsed sidebar

## Overview
Two pieces from the Unclutter Desk design system:
1. The **React Native companion app** — five mobile screens (Today, Schedule, Clients, Brand & booking link, Client booking) at 390×844, sharing a glass bottom nav.
2. The **workspace sidebar's collapsed state** — a 76px icon-only rail, an alternate mode of the existing `Sidebar` component (which already also renders the 248px expanded rail).

## About the design files
The files here are **design references built in HTML/React (web), not production code to copy directly**. They use `React.createElement`-style JSX, inline styles, and CSS custom properties from the design system's token files, running directly in a browser — no build step, no React Native.

Your task is to **recreate these designs in the target codebase's actual environment**:
- The mobile screens should be rebuilt in **React Native** (or whatever the companion app's real stack is), translating the layout, spacing, colors and type to native primitives (`View`, `Text`, `ScrollView`, platform-appropriate blur for the bottom nav, etc). Treat the web mockups as a precise spec of what to build, not literal code to port.
- The collapsed sidebar is already **web React** and matches the target stack directly — port its JSX with minimal translation, keeping the token-driven styling.

## Fidelity
**High-fidelity.** All colors, type, spacing and radii below are exact values from the shipped token files (`tokens/colors.css`, `tokens/spacing.css`, `tokens/typography.css`, `tokens/elevation.css`), included in this bundle. Recreate pixel-accurately.

## 1. Collapsed sidebar

### Component
`components/navigation/Sidebar.jsx` — one component, two states via the `collapsed` boolean prop. No separate collapsed component exists; do not build one.

### Layout — collapsed (`collapsed={true}`)
- Width **76px** (vs 248px expanded), fixed, full height, background `var(--desk-sidebar)` = `#0F172A`. Width transitions over `200ms ease-out` when toggling.
- Padding `20px 10px` (vs `20px 14px` expanded); `align-items: center` (vs `stretch`); column flex, `gap: 3px`.
- **Never** apply tenant/brand color to this background in any tenancy — that rule is structural to the white-label system.

### Header
- Logo switches from the `lockup` variant (mark + wordmark + badge) to the `mark` variant alone (30px), centered.

### Nav items (`NavItem.jsx`, collapsed mode)
- Each item: 44×44px, centered, `border-radius: 14px`, icon only (label dropped from layout but passed as the native `title` attribute → **use as an accessibility label / long-press tooltip**, not a visible tooltip requirement).
- Active item: gradient background `linear-gradient(90deg, rgba(28,78,63,.92), rgba(46,122,99,.55))`, shadow `inset 0 0 0 1px rgba(74,151,129,.30), 0 8px 24px rgba(20,58,47,.50)`, icon stroke `var(--desk-pine-400)` (`#4A9781`). The left 3px active-edge marker present in expanded mode is **omitted** when collapsed (no room).
- Hover (or native press) background: `var(--desk-sidebar-hover)` = `#1E293B`; inactive text/icon color `var(--desk-text-subtle)` = `#94A3B8`.
- **Count badges** move from an inline pill (expanded) to a small corner badge: absolute, `top:-5px; right:-7px`, min-width 15px, height 15px, `border-radius: 999px`, 1.5px border in the sidebar color (so it "cuts into" the dark background), font 9px/800. Badge fill is `countTone`: `neutral` → `var(--desk-danger)` background/white text (note: the neutral tone repurposes danger red for visibility on dark, per source), `pine` → `var(--desk-pine-400)` bg / `var(--desk-sidebar)` text, `danger` → `var(--desk-danger)` bg / white text.

### Collapse/expand toggle row
- Present only if the parent wires up a toggle handler. 44×36px button, centered icon only when collapsed (full-width, left-aligned with "Collapse" label when expanded).
- Icon: 16px stroke icon, a rounded-rect "panel" with an arrow flipping direction by state (path data in `Sidebar.jsx`, look for the `d={collapsed ? … : …}` conditional).
- Hover background `var(--desk-sidebar-hover)`.

### User footer
- Border-top `1px solid rgba(255,255,255,.07)`, padding `14px 0 2px`, centered.
- Avatar-only: `AvatarChip` initials, 32px, `tone="slate"`, `radius: 10`. Name/role text is dropped entirely (not truncated — removed).

### Interaction
- Toggling collapsed/expanded should animate width and padding over 200ms ease-out (no bounce). No content reflow animation is specified beyond that — labels/text can appear/disappear without their own transition.

## 2. Mobile companion app (5 screens, 390×844)

Full annotated layout is in `ui_kits/mobile/README.md` (included) and the literal markup/values are in `ui_kits/mobile/Screens.jsx` (included) — read both. Summary:

- **Screen 1 · Today** — greeting header with avatar + notification bell; dark revenue hero (`#0F172A` bg, `border-radius: 32px`, 22px/24px padding) with eyebrow, +18.2% delta pill (`rgba(16,185,129,.16)` bg / `#34D399` text — lighter than the light-surface success pill because the surface is dark), ₦450,000 hero stat (40px/800), 12-bar mini chart (44px tall, last bar white, others `rgba(255,255,255,.22)`), 3-stat footer row (Sessions/Attendance/Clients) above a `rgba(255,255,255,.08)` divider. Below: "NEXT UP" eyebrow + "See all 3" link in brand-primary color, one full session card with Start/Edit buttons, then two compact rows.
- **Screen 2 · Schedule** — 7-day strip (66px tall cells, `border-radius: 20px`, selected day filled `var(--brand-primary)`), then a day-eyebrow + session count line, then a timeline: 52px right-aligned time gutter + category-bordered cards (`border-left: 4px solid` brand-primary or brand-secondary by category).
- **Screen 3 · Clients** — search input, 4 filter chips (first one solid `var(--desk-sidebar)`, rest outlined), client rows: avatar chip, name/subtext, status dot (`--desk-active-dot`/`--desk-pending-dot`/`--desk-inactive`), chevron.
- **Screen 4 · Brand & booking link** — tenant-gradient link card (`linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))`, shadow `var(--brand-ring)`-tinted) with Copy/Share actions (copy label swaps to "Copied" for 1600ms); brand colors 2-up `ColorField`s + `PresetSwatches`; practice-status card with toggle; logo-replace row.
- **Screen 5 · Client booking (public web)** — no bottom nav; instead a sticky glass action bar (date/time + total + "Confirm & Book Session" CTA, `height: 54px`, `border-radius: 18px`, shadow `var(--desk-shadow-tenant)`). Top: a lock+domain bar, tenant-gradient brand header (name, category badge, star rating), selected-session card (2px brand-primary border), date strip, time-slot pills, three inputs, "Booking powered by Unclutter Desk" logo line.

### Shared bottom navigation (`BottomNav.jsx`)
- Height **92px**, `border-radius: 24px 24px 0 0`, glass: `background: rgba(255,255,255,.85)`, `backdrop-filter: blur(18px) saturate(140%)`, top border `#E2E8F0`.
- 4 tabs: Today, Schedule, Clients, Brand — `justify-content: space-between`.
- Each tab button: 52px tall, icon (20px) above 10px/700 label, `border-radius: 16px`.
- **Active tab is a solid pill**, `background: #0F172A`, white icon + white label — never icon-only, even when active.
- Screen 5 (public booking) has **no bottom nav** — native equivalent should be a plain scroll view with the sticky action bar described above instead of a tab bar.

### Frame
The 46px-radius rounded frame in the mockup (`radius-phone` token) is presentation-only, to suggest a device bezel in the design file — build to the real device viewport, no rounded frame in the shipped app.

## Interactions & behavior
- **Copy Booking Link** (Brand screen): label swaps `"Copy link"` → `"Copied"` for 1600ms, then reverts. No toast.
- **Practice status toggle**: flips helper copy between "Your booking page is live." / "Your booking page is hidden." — instant, no confirmation step shown in the mock (confirm with product whether a real toggle needs one).
- **Collapse/expand sidebar**: single click/tap on the toggle row; width/padding animate 200ms ease-out; state is presumably persisted per-user (not specified in the mock — ask before inventing storage behavior).
- All transitions in this system use **ease-out only** — no springs, no bounces.
- Tenant brand colors (`--brand-primary` / `--brand-secondary`) drive the revenue-hero delta pill is the one exception that stays slate-green regardless of tenant; everything else marked `var(--brand-*)` above must re-theme per tenant. The sidebar and bottom nav are explicitly **never** tenant-themed.

## State management
- `collapsed: boolean` — sidebar rail state, lifted to whatever shell owns the workspace layout.
- `active: string` (nav key) — shared selection state between `Sidebar`/`BottomNav` and the routed screen.
- Mobile `Brand` screen: `brand: { primary: string, secondary: string }`, `active: boolean` (practice status), transient `copied: boolean` (auto-resets after 1600ms).
- No loading/empty/error states are designed for any of these screens — ask before inventing them (per the design system's own "Not yet designed" list).

## Design tokens
Full source in `tokens/colors.css`, `tokens/spacing.css`, `tokens/typography.css`, `tokens/elevation.css` (included). Key values used here:

**Color**
- Sidebar background `#0F172A`, hover `#1E293B`, active base `#17293F`
- Pine (primary): 600 `#24614F`, 700 (hover) `#1C4E3F`, 400 (active-nav icon/marker) `#4A9781`, 100 (soft) `#DDEDE6`
- Clay (secondary): 600 `#8A5A3C`
- Success: `#16A34A` / dot `#22C55E`; Pending: `#C2410C` / dot `#EA580C`; Inactive `#64748B`; Danger `#E11D48`
- Text: primary `#0F172A`, body `#475569`, muted `#64748B`, subtle `#94A3B8`

**Spacing / radius**
- Sidebar: 248px expanded / 76px collapsed
- Radius: card 24px · panel 22px · nested 20px · row 18px · control 14px · chip 12px · small 10px · pill 999px · phone frame 46px (presentation only)
- Control heights: 32 / 40 / 44 / 48px, CTA 52px (54px on mobile booking)

**Type** — Outfit throughout. Eyebrow 9px/900/0.22em uppercase is the signature label style; hero stat 40px/800/-0.04em tabular-nums; screen title 24px/800/-0.035em.

**Motion** — all ease-out; toggle 200ms, color/background 140–200ms.

## Assets
- `assets/unclutterdesk-mark.svg` — square tile mark, used at 30px in the sidebar (both states).
- `assets/unclutterdesk-lockup.svg` — mark + wordmark + DESK badge, used in the expanded sidebar header and "powered by" footers (16px, 60% opacity).
- Icons are Lucide (`lucide-react` in production); this bundle's `ui_kits/mobile/Screens.jsx` references an `ICON`/`Icon` helper local to the prototype — swap for your codebase's real Lucide icon set (`Home`, `Calendar`, `Users`, `Brush`, `Bell`, `Play`, `Pencil`, `Plus`, `Search`, `ChevronRight`, `Lock`, `Star`, `File`, `ArrowRight`).

## Files in this bundle
- `components/navigation/Sidebar.jsx` + `.d.ts` + `.prompt.md` — the sidebar, both states
- `components/navigation/NavItem.jsx` — individual nav row, both states
- `components/navigation/BottomNav.jsx` — mobile bottom nav
- `ui_kits/mobile/Screens.jsx` — all five mobile screen layouts
- `ui_kits/mobile/app.jsx` — how the five screens + bottom nav + tenant theming wire together
- `ui_kits/mobile/index.html`, `ui_kits/mobile/README.md` — open `index.html` in a browser to see all five screens side by side; README has the per-screen breakdown
- `tokens/*.css` — colors, spacing, typography, elevation, brand-slots (tenant theming variables)
- `assets/unclutterdesk-*.svg` — logo mark and lockup
