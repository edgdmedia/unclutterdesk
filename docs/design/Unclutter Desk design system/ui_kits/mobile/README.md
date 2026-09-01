# UI kit — Mobile companion app

Five screens at **390 × 844**. The 46px frame radius is presentation only —
build to the device viewport.

Open `index.html` to see all five side by side.

| Screen | Contents |
|---|---|
| 1 · Today | Greeting, dark revenue hero (`#0F172A`, radius 32, mini bar row), next session card, two compact later-today rows |
| 2 · Schedule | 7-day strip, then a timeline list with a 52px time gutter and category-bordered cards |
| 3 · Clients | Search field, filter chips, roster rows with status dot and chevron |
| 4 · Brand & booking link | Tenant-gradient link card with copy/share, brand colours + presets, practice status, logo replace |
| 5 · Client booking | The booking flow on mobile web, with a sticky glass action bar |

**Shared bottom navigation** — 92px, glass, radius `24px 24px 0 0`, four tabs
(Today, Schedule, Clients, Brand). The active tab is a solid `#0F172A` pill with
white icon **and** label; never icon-only. Screen 5 is public web, so it has no
bottom nav — it has the sticky action bar instead.

The dark revenue hero is the one place slate carries content rather than chrome.
Its delta pill is `rgba(16,185,129,.16)` on `#34D399` — a lighter treatment than
the light-surface status pill, because the surface is dark.
