`Input` is every single-line field in Desk — intake form, header booking link, search, CNAME.

```jsx
<Input label="Full name" placeholder="Adaeze Okonkwo" />
<Input muted readOnly mono value="unclutterdesk.com/booking/dr-smith" height={44}
       icon={<LinkIcon/>} trailing={<IconButton size={32} variant="plain"><CopyIcon/></IconButton>} />
<Input muted height={40} icon={<SearchIcon/>} placeholder="Search clients" />
```
