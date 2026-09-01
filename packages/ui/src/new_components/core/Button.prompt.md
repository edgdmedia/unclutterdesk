Use `Button` for every clickable action in the Desk workspace and the white-label booking portal.

```jsx
<Button variant="primary" size="lg" icon={<CopyIcon />}>Copy Booking Link</Button>
<Button variant="secondary">Set availability</Button>
<Button variant="primary" size="cta" fullWidth iconAfter={<ArrowRight />}>Confirm &amp; Book Session</Button>
```

Variants: `primary` (tenant fill + `--desk-shadow-button`), `secondary` (white, `--desk-border-strong`), `ghost`, `link` (pine text on white), `danger`, `tenantSoft` (`--brand-fill` background, tenant text).

Sizes map to the control-height scale: `sm` 32 · `md` 40 · `lg` 44 · `xl` 48 · `cta` 52 (the booking portal's Confirm button; 54 on mobile).

Hover on tenant-colored variants is `filter: brightness(1.08)` — never a second stored color token. Press is `translateY(1px)`.
