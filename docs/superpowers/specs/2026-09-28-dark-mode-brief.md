# Dark mode: design brief

**Date:** 28 Sep 2026
**Status:** brief. The decisions in section 5 need a design conversation before this becomes a spec.
**Depends on:** `2026-09-28-responsive-layout-shared-components-design.md` (all five PRs merged)

## 1. What it is for

A dark theme for people who work in low light or prefer it. This especially means practitioners doing evening sessions, and clients opening the portal at night. It should reduce glare without making clinical information harder to read.

## 2. What the code looks like today

- **No theme mechanism:** there is no `prefers-color-scheme`, `.dark` class or `data-theme` anywhere.
- **Tokens:** `packages/ui/src/tokens/colors.css` defines 58 colour variables. They are named by value and role mixed together, for example `--os-sidebar-bg: #0F172A`.
- **Hard-coded colours in the app:** 2,389 hex values (81 distinct) across 74 files, 484 Tailwind palette classes (`bg-slate-50`, `text-emerald-700` and so on), and 20 inline style colours.

Dark mode is therefore mostly a **colour-token migration**; the theme itself is the smaller part. Every colour has to come from a semantic token before a second set of values can exist.

## 3. Why it waits for the responsive work

That work moves the shell, navigation, tables, stat tiles and form controls into `packages/ui` on tokens. After it, most repeated colour lives in the package rather than in 74 page files, so the migration here is roughly halved.

## 4. Likely shape (to confirm)

1. **Semantic tokens:** surface, surface-raised, text, text-muted, border, focus, success, warning, danger and info, plus the brand slots. Defined in `colors.css` for light, with a dark set under `[data-theme="dark"]`.
2. **Tailwind mapping:** these tokens exposed as Tailwind colours via `@theme` (for example `bg-surface`, `text-muted`), so pages use names rather than hex values.
3. **Migration:** the package first, then each page, with a rule check that bans raw hex values and palette classes in `apps/app` (an allow-list for the logo and charts).
4. **Theme choice:** follow the device by default, with an override in Account preferences (the `Profile` already stores display preferences such as locale and time format).
5. **Checks:** a contrast check (WCAG AA) on every token pair, and the layout check script extended to screenshot both themes.

## 5. Decisions to settle before the spec

1. **Scope:** the practice and admin workspace only, or the client portal and public booking pages too? Public pages carry each practice's brand; a dark version changes how practices look to their clients.
2. **Tenant brand colours in dark mode:** use the practice's colour as is, adjust it automatically for contrast, or let practices set a dark-mode brand colour?
3. **Default:** follow the device setting, or light unless chosen?
4. **Charts and status colours:** keep the same hues and darken the surfaces only, or define dark variants?
5. **Printed and exported documents** (hours log PDF, data export): always light? Assumed yes.
6. **Sidebar:** it is already dark slate. Does it stay as is in dark mode, or shift to separate it from a dark content area?

## 6. Size

Large: every page file is touched, though mostly mechanically once the tokens exist. Expect several PRs: tokens and package, then practice, admin, portal and public.
