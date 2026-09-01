`BarChart` is the revenue series.

```jsx
<BarChart data={months} height={96} />                                    {/* dashboard */}
<BarChart data={months} height={220} gap={14} showValues
          formatValue={v => '₦' + v + 'k'} />                             {/* analytics */}
```

Mark the current month with `current: true`; everything else renders in `--brand-bar`.
