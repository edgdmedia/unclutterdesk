`Card` is the workspace surface. Everything in the body of a Desk screen sits in one.

```jsx
<Card><Eyebrow>Revenue this month</Eyebrow>…</Card>
<Card radius={20} padding="sm">…</Card>          {/* KPI tile */}
<Card hoverable padding={0} radius={18}>…</Card> {/* clickable session row */}
<Card dark radius={32}>…</Card>                  {/* mobile revenue hero */}
```

Radius by role: 24 standard card · 22 booking panel · 20 nested/KPI · 18 list row. Don't reach past this set.
