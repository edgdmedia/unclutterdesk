`NavItem` is one row of the workspace sidebar.

```jsx
<NavItem label="Dashboard" icon={<HomeIcon/>} active />
<NavItem label="Schedule" icon={<CalendarIcon/>} count="4" countTone="pine" />
<NavItem label="Clients" icon={<UsersIcon/>} count="128" />
```

Counter tone carries meaning: neutral for informational totals, pine for time-sensitive, danger for needs-action. Cap display at `99+`.
