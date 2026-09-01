# UI kit — Therapist workspace

The internal practice-management app, behind a login. Authored for **≥1440px**;
no mobile breakpoint (the companion app covers small screens).

Open `index.html` and click through the sidebar.

| File | Screen |
|---|---|
| `Dashboard.jsx` | `/` — revenue summary, today's sessions, profile photo, practice status, brand customizer |
| `Schedule.jsx` | `/schedule` — Mon–Fri week grid, 9 AM–6 PM, 62px hour rows |
| `Clients.jsx` | `/clients` — KPI row and the roster table |
| `BrandSettings.jsx` | `/brand` — the two tenant hexes beside a live scaled preview of the public booking page |
| `Analytics.jsx` | `/analytics` — KPIs, revenue by month, session mix, referral sources |
| `app.jsx` | Shell: sidebar + header + screen switch |
| `icons.jsx` | Inline Lucide-style glyphs. Prototype convenience — use `lucide-react` in production. |

**Shell.** 248px slate sidebar (never tenant-tinted) + 80px white header +
scrolling main at `24px 26px 30px`.

**Week grid geometry.** Hour row 62px, timeline origin 9:00.
`top = (startMinutes − 540) / 60 × 62`; `height = durationMinutes / 60 × 62 − 5`.
The grid card must be `flex: none` or its lower rows get clipped by the scroll
container.

**Tenant color** is set on the shell wrapper as `--brand-primary` /
`--brand-secondary` with `class="desk-tenant"`, and everything downstream
derives.

These are visual recreations, not production code. Charts are CSS `div` bars —
use the codebase's chart library and match the treatment.
