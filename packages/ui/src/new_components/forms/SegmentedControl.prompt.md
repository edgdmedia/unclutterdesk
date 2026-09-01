`SegmentedControl` for 2-3 mutually exclusive views or modes. More than four options belongs in a select.

```jsx
<SegmentedControl options={['Week','Day','Month']} value={view} onChange={setView} />
<SegmentedControl options={['Online','In-person']} value={format} onChange={setFormat} height={46} />
```
