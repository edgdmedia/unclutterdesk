Use `IconButton` when the control is a glyph alone: copy-to-clipboard next to the booking link field, calendar prev/next, the `⋯` row overflow, the header bell.

```jsx
<IconButton size={44} dot aria-label="Notifications"><BellIcon /></IconButton>
<IconButton size={32} variant="plain" aria-label="Copy link"><CopyIcon /></IconButton>
<IconButton size={30} variant="muted" aria-label="Previous month"><ChevronLeft /></IconButton>
```

Always give it an `aria-label`. `dot` renders the 7px `--desk-danger` notification dot with its 1.5px white ring.
