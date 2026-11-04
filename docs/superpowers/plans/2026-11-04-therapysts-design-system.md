# Adopt the Therapysts design system: Implementation Plan

**Source of truth:** the Therapysts design system (Claude artifact `25fygx6CKguevktxnoNFK7`). Its `README.md` is the brand book, and `tokens.json` holds the tokens. Copy values exactly; never approximate them. Logos are the system's SVG files; fonts are its `Fraunces-Variable.woff2` and `Figtree-Variable.woff2` (SIL OFL), self-hosted.

**Decided (4 Nov 2026):**
- Adopt it everywhere, public site first.
- The dashboard moves too, before the domain move.
- Custom brand colour (Starter and up) and the practice-address reviews exception are in the system's README.

## PR 1: public site (therapysts.com and profiles) — `apps/profiles`, `packages/ui/src/brand`

- [ ] **Tokens:** add `packages/ui/src/brand/therapysts.ts` exporting the system's colour, type, spacing, radius and shadow tokens (light and dark), copied from `tokens.json`. One test compares it with a checked-in copy of `tokens.json`.
- [ ] **Fonts:** Fraunces (headings and names, `'SOFT' 100, 'WONK' 0`, weight 560) and Figtree (everything else), self-hosted. Drop Outfit from the public site.
- [ ] **Logo:** the y lockup, wordmark, mark and app icon / favicon from the system, replacing the leaf.
- [ ] **Look:** white `bg` with `bg-alt` sections; pill buttons; hairline-bordered cards (shadows only on floating previews); 17px public body text; 52–56px primary buttons on public pages.
- [ ] **Profile palettes:** remap to the system's table: Calm (blue), Warm, **Crisp**, Earth, Night.
  - Rename the `clinical` key to `crisp`, with a migration that updates `PractitionerProfile.themeKey`. The API keeps accepting `clinical` as an alias for one release.
  - Keep `THEME_KEYS` and the UI palette file pinned by the existing test.
  - Contrast tests for every palette on every layout.
- [ ] **Link previews and profile PDF:** new fonts, logo and palettes.
- [ ] **Checks:** Lighthouse accessibility ≥ 95 on home, pricing and each layout × palette; works at 320px; under 100 KB before the photo; no third-party requests.

## PR 2: booking pages and client portal — `apps/app` public and client routes

- [ ] Same tokens, fonts and logo.
- [ ] The booking flow takes the look of the page it came from: palette or `brandTokens(hex)` (shared-public-page plan, task 1), plus the practice logo.
- [ ] Confirmation page, pay page, portal and session room all match.

## PR 3: dashboard — `packages/ui` and `apps/app` practice routes

- [ ] **Remap the dashboard's tokens to the system:**
  - Figtree 15px body.
  - `primary` blue replaces `#0F3A53` and pine; `ink`, `ink-muted` and `border`.
  - Sidebar on `ink-band` with `on-band` text and `sky` accents.
  - Pill buttons, `radius-lg` cards.
- [ ] **Replace hard-coded colours** in pages (`#0F3A53`, `#24614F`, `#E3B341` and so on) with tokens, file by file. Add a test that fails on a raw brand hex outside the token files.
- [ ] **Practice-chosen colours stay:** tenant brand colours still theme the practice's own booking pages (PR 2), not the dashboard chrome.
- [ ] **Checks:** contrast for every token pair in both themes; screenshots of the main pages before and after in the PR.

## Order and owners

- PR 1 first. PR 2 needs `brandTokens` (shared-public-page plan task 1).
- PR 3 can run alongside PR 2.
- Spec Claude builds PR 1 and `brandTokens`; opencode builds PR 3 after the Schedule and time-off work. PR 2 goes to whoever is free first.
