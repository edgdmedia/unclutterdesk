`Sidebar` is the workspace shell's left rail. Five items: Dashboard, Schedule, Clients, Brand Settings, Analytics.

```jsx
<Sidebar
  items={[{key:'dashboard',label:'Dashboard',icon:<HomeIcon/>}, …]}
  active={screen} onSelect={setScreen} assetBase="../../"
  user={{initials:'JS', name:'Dr. Jane Smith', role:'Clinical Psychologist'}} />
```

`assetBase` is the relative path from the page to the design system root; it is
forwarded to the lockup so the mark resolves.

Never tint the sidebar with the tenant color — that is the rule the white-label architecture rests on.
