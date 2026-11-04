# Dashboard brand tokens: Therapysts in the practice app

PR 3 of `2026-11-04-therapysts-design-system.md`, in detail. Spec Claude builds 3a and 3b; 3c can go to opencode.

## Where the dashboard stands (origin/dev, 4 Nov 2026)

There are three palettes at once:

- **`packages/ui/src/tokens`:** pine `--desk-*` (386 `var()` uses), slate neutrals, and Outfit.
- **`apps/app/src/index.css`:** overrides the brand slots with navy `#0F3A53` and gold `#E3B341`, and keeps its own `--os-*` copy of slate (6 uses).
- **Raw hex in class names:** about 2,100 in `apps/app/src`. The top values are `#0F172A` (502), `#E2E8F0` (423), `#64748B` (403), `#475569` (245), `#0F3A53` (243), `#94A3B8` (219), `#F8FAFC` (197), `#F1F5F9` (120) and `#E3B341` (80).

## Token map (source: `packages/ui/src/brand/therapysts/tokens.json`, light theme)

The `--desk-*` names stay, so no component has to change in 3a; only their values move. The `--ds-*` names are added for new code and mirror the design system one to one.

| Role | Old | New | Design-system token |
|---|---|---|---|
| Primary (`pine-600`) | `#24614F` | `#2A56A8` | primary |
| Primary hover (`pine-700`) | `#1C4E3F` | `#1E3F7A` | primary-hover / navy |
| `pine-900` / `800` | `#0E2A22` / `#143A2F` | `#0F1B33` / `#17305E` | ink / between ink and navy |
| `pine-500` / `400` | `#2E7A63` / `#4A9781` | `#3463B8` / `#6189CC` | the blues on either side of primary |
| `pine-300` | `#7DB8A5` | `#8FB6EC` | sky |
| `pine-200` | `#B6D8CC` | `#C9D6EA` | the design's ghost border |
| Primary soft (`pine-100`) | `#DDEDE6` | `#E9F0FB` | surface-tint |
| `pine-050` | `#F0F7F4` | `#F7FAFE` | bg-alt |
| Clay | unchanged | unchanged | The design uses clay `#8A5A3C` for its second eyebrow |
| Sidebar | `#0F172A` | `#0F1B33` | ink-band |
| Sidebar hover / active | `#1E293B` / `#17293F` | `#1A2A4D` / `#1E3F7A` | navy for active |
| App background | `#F8FAFC` | `#F7FAFE` | bg-alt |
| Card | `#FFFFFF` | `#FFFFFF` | surface |
| Muted fill | `#F1F5F9` | `#EEF3FA` | between bg-alt and surface-tint |
| Border | `#E2E8F0` | `#E3EAF5` | border |
| Strong border (controls) | `#CBD5E1` | `#7384A6` | border-control (3:1) |
| Text | `#0F172A` | `#0F1B33` | ink |
| Body text | `#475569` | `#4A5876` | ink-muted |
| Muted text | `#64748B` | `#56637D` | the design's caption grey |
| Subtle text | `#94A3B8` (2.6:1) | `#5F6D88` (4.7:1 or better) | readable; was below AA |
| Success | `#16A34A` | `#1F7A4D` | success |
| Pending | `#C2410C` | `#8A5A00` on `#FFF4D6` | warning / warning-soft |
| Danger | `#E11D48` | `#B42318` | danger |
| Info | `#0284C7` | `#2A56A8` on `#E9F0FB` | primary / surface-tint |

- **Brand slots:** the dashboard uses the house defaults (primary blue, secondary clay). The navy and gold override in `index.css` goes. The practice's own colours still theme only its booking pages (PR 2).
- **Type:** Figtree replaces Outfit everywhere, and JetBrains Mono stays for codes. Fraunces (weight 560, 'SOFT' 100) is for page titles only (`h1`); the dense UI stays in Figtree.
- **Shadows:** the brand-tinted ones are retinted from pine to navy, and the active nav item gets a navy gradient.

## 3a: token layer (this PR)

- [ ] **`colors.css`:** the values above, plus the `--ds-*` set.
- [ ] **`elevation.css`:** retint the shadows.
- [ ] **`fonts.css` and `typography.css`:** Figtree and Fraunces.
- [ ] **`apps/app/src/index.css`:** `--os-*` becomes aliases of the `--desk-*` tokens; drop the brand-slot override; body font from the token.
- [ ] **Remove** `Outfit-VariableFont_wght.ttf` and its `index.html` preload.
- [ ] **Tests:**
  - Every `--ds-*` value equals `THERAPYSTS_COLORS`.
  - The mapped `--desk-*` values equal their design-system token.
  - Text and status pairs meet 4.5:1.

## 3b: raw hex to tokens (next PR, a codemod)

- [ ] **A script maps each value to its token.** It works on each class name and inline style, using the property and the hex: `text-[#0F172A]` becomes `text-[var(--desk-text)]`, and `bg-[#0F172A]` becomes `bg-[var(--desk-sidebar)]`. The navy `#0F3A53` and gold `#E3B341` become primary and clay.
- [ ] **Values the table doesn't cover** are listed for a decision, not guessed.
- [ ] **A test fails** on any raw hex in `apps/app/src` outside an allow-list (charts, the custom colour picker, practice brand defaults).
- [ ] **Screenshots** of the main pages before and after.

## 3c: shape (opencode, after 3b)

- [ ] **Buttons:** pills.
- [ ] **Cards:** `radius-lg` with hairline borders, and shadows only on floating elements.
- [ ] **Sidebar:** the design's logo and mark, once the product name is settled for the domain move.
