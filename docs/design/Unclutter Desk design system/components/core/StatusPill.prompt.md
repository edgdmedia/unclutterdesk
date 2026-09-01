`StatusPill` shows a record's state: session confirmed, client in intake, practice paused.

```jsx
<StatusPill status="active">Confirmed</StatusPill>
<StatusPill status="pending">Awaiting intake</StatusPill>
<StatusPill status="inactive">Paused</StatusPill>
<StatusPill status="active" dot={false} height={22}>+18.2%</StatusPill>  {/* delta pill */}
```

`active` is `#16A34A` (not the old emerald — that read as the brand primary) and `pending` is warm orange `#C2410C` (not amber — amber is gold-family).
