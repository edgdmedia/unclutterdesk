`Sidebar` is the workspace shell's left rail. Five items: Dashboard, Schedule, Clients, Brand Settings, Analytics.

```jsx
<Sidebar
  items={[{key:'dashboard',label:'Dashboard',icon:<HomeIcon/>}, …]}
  active={screen} onSelect={setScreen} assetBase="../../"
  collapsed={collapsed} onToggleCollapse={() => setCollapsed(c => !c)}
  user={{initials:'JS', name:'Dr. Jane Smith', role:'Clinical Psychologist'}} />
```

`assetBase` is the relative path from the page to the design system root; it is
forwarded to the lockup so the mark resolves.

Collapsed is a 76px icon-only rail: the lockup drops to the mark alone, labels
become title tooltips, counters move to a small corner badge, and the user
footer shows the avatar without the name. Supplying `onToggleCollapse` renders
the collapse/expand row itself — omit it if the parent triggers collapse from
elsewhere.

Never tint the sidebar with the tenant color — that is the rule the white-label architecture rests on.
