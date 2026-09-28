# Visual restyle: design brief

**Date:** 28 Sep 2026
**Status:** brief. What should change has not been decided. Section 4 lists the questions for the design conversation that turns this into a spec.
**Depends on:** `2026-09-28-responsive-layout-shared-components-design.md` (all five PRs merged)

## 1. What it is for

To be defined with the product owner. "Restyle" came up as something the responsive work deliberately leaves alone. The responsive work changes where things sit, not how they look. A restyle would change how they look.

## 2. What exists today

- **Design source:** `docs/design/` holds the handoffs:
  - `design_handoff_unclutteros`, `design_handoff_unclutteros_screens_2_3`, `design_handoff_mobile_and_collapsed_sidebar`, `design_handoff_unclutteros_marketing`;
  - the "Unclutter Desk design system" folder;
  - `.dc.html` boards.

  `docs/DESIGN_SPECIFICATION.md` summarises them: the navy, slate, gold and soft-surface palette, the type scale and the component token mapping.
- **Tokens:** `packages/ui/src/tokens`, covering colours, typography, spacing, radius, elevation, brand slots and fonts.
- **Drift from the design:** screens are hand-built, so values vary. For example, there are six control height and corner combinations where the design has two. Much of this drift is removed by the responsive work, because pages move onto shared components.

## 3. Why it waits for the responsive work

Once every page uses the shared shell, page, header, grid, table, tile and form components, a restyle mostly means changing tokens and a few dozen components in `packages/ui`, not 58 page files. Doing it before would mean styling everything twice.

## 4. Questions for the design conversation

1. **Motivation:** what prompts it? Brand refresh, the Unclutter Suite integration, looking dated, specific screens that feel wrong, or feedback from practices?
2. **Reach:** tokens only (colour, type, radius, shadow), component shapes too, or screen layouts and flows?
3. **Brand:** is there a new Unclutter brand direction (logo, palette, type), or is it within the current one?
4. **Surfaces:** workspace, portal, public booking and the marketing site (`apps/landing`). Which are in?
5. **White-label:** how much of each practice's brand should show through, beyond today's brand colour and logo?
6. **Design source:** will new designs come from the design tool (a new handoff), or be worked out in code against the tokens?
7. **Success:** how will we judge it? Practice feedback, booking conversion on public pages, or a design review sign-off?

## 5. Relationship to dark mode

If both go ahead, do the restyle's token decisions first, or together with dark mode's semantic tokens (see `2026-09-28-dark-mode-brief.md`), so tokens are named and valued once.
