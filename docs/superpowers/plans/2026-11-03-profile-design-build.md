# Building the approved design: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the approved design (design canvas "Therapysts.com design", https://claude.ai/artifact/2JorsrGRFSDa5y7oA73FdX) into the live profile site, the editor's appearance picker, and the home page.

**Spec:** §6.5 (layouts and palettes, rewritten 3 Nov 2026), §6.3, §6.10, §6.11.

**Builder:** Spec Claude, on `phase1/profile-design` (branched from `phase1/profile-reports`, PR #76). Opencode's share-kit and admin-content plans run in parallel; they don't touch these files.

## Global constraints

- Never push to `main`. One commit per task, prefix `Phase 1:`. PR into `dev`.
- The CSP stays as it is: no inline scripts or styles, no outside origins. Fonts are self-hosted.
- Readable without JavaScript. WCAG 2.1 AA. Works at 320 px.
- Palette tokens and layout keys come only from `packages/ui/src/brand/profileThemes.ts`; the API keeps `THEME_KEYS` and `LAYOUT_KEYS` in `themes.ts`, pinned equal by a test.

## Tasks

- [x] **1. Palettes and layout keys.** New palette values from the design (pine, clay, blue, olive, night), a `soft` token, `PROFILE_LAYOUTS`, API `LAYOUT_KEYS`, a contrast test that includes chip text on the soft fill. `themes.css.ts` emits `--soft`.
- [x] **2. `layoutKey` on the profile.** Migration (`layoutKey TEXT NOT NULL DEFAULT 'classic'`), validation in `updateOwn` (like `themeKey`), in the owner and public DTOs, and a purge on change.
- [x] **3. Self-hosted fonts.** Outfit (variable, all layouts) and Fraunces (italic 500, Editorial only) as woff2 under `apps/profiles/public/fonts/`, with `@font-face` and `font-display: swap`. Fraunces loads only on Editorial pages.
- [x] **4. Profile layouts.** Built as one `ProfileView.astro` with a single section list and a `layout-*` class (plus small header variants), rather than four components: the content and order then can't drift at all. Checked against the canvas at 390 and 1280 px (no horizontal overflow, no CSP errors). Deviation from the canvas: on a phone, Split keeps the fees panel after the sections (in the §6.4 order); the Book button is already in the introduction.
- [x] **5. Public pages.** Home (`/`) with the two-slide hero as two tab links (no JavaScript, no autoplay), the report page and its thank-you state, and the 404 and 410 pages, all from the canvas.
- [x] **6. Editor appearance picker.** In `PublicProfileEditor.tsx`: a layout picker and a palette picker, and a live phone preview built from the same tokens. Saves `layoutKey` and `themeKey`.
- [ ] **7. Link-preview images (§6.3).** Rendered in the API (satori + resvg) as a background job on save, stored in R2, one design per layout in the profile's palette (canvas "Link preview image"). `og:image` points to it; until it exists, the photo.
- [ ] **8. Check and ship.** Lighthouse accessibility ≥ 95 on each layout; profiles tests; a manual check at 320, 390 and 1280 px; deploy the Worker.

The profile PDF (§6.10, canvas "Profile PDF one-pager") is in opencode's share-kit plan. Point that work at the canvas board before it starts.
