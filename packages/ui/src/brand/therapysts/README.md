# Therapysts brand files

Copied unchanged from the Therapysts design system (the source of truth): `tokens.json`, the logo SVGs and the two variable fonts (SIL OFL). Don't edit them here; update the design system and copy them again. `therapysts.ts` exposes the tokens to code, and a test keeps it equal to `tokens.json`.

## Files made from the originals (for page weight)

Public pages have a 100 KB budget before the photo.

- `fonts/Fraunces-Heading.woff2`: made from `Fraunces-Variable.woff2` by `packages/ui/scripts/make-heading-font.py` (fonttools 4.55.0, brotli 1.1.0). It keeps what the design system uses: weight 560, 'SOFT' 100, 'WONK' 0, optical size 20–96, Latin. It's 30 KB; the original is 118 KB.
- `logos/*.min.svg`: the wordmark and lockup with path coordinates reduced to one decimal by svgo 3.3.5 (`svgo -p 1`). About 7 KB each instead of 31 KB. Rendered at 1200 px, they differ from the originals only on anti-aliased edges (under 0.06% of pixel values).

Re-run both when the design system's files change.
