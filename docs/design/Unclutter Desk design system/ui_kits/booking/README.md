# UI kit — White-label client booking portal

The public page a client lands on from the therapist's link, served on the
therapist's own domain. Authored at **1180px**; build it responsive down to the
390px mobile view in `../mobile/`.

Open `index.html`. Pick a service, a date, a time and a format — the summary
sidebar updates live. **Confirm & Book Session** goes to the confirmation
screen; **Reschedule** comes back with selections intact.

| File | Contents |
|---|---|
| `Booking.jsx` | `BookingPortal` (brand header, three steps, sticky summary) and `BookingConfirmed` (receipt) |
| `app.jsx` | Screen switch + the presentation-only browser chrome |

**Query parameters** — used by the Brand Settings preview pane:

```
index.html?embed=1&screen=confirmed&primary=%23007BFF&secondary=%236F42C1
```

`embed=1` drops the browser chrome and the outer frame.

**The browser chrome is presentation only.** It exists to communicate that this
is a public page on the therapist's own domain. Do not build it.

**Everything branded reads the tenant slots.** The header gradient, the step
numerals, the selected service border and its shadow, the calendar selection and
availability dots, the time-slot pills, the summary header band, and the CTA.
The only Unclutter Desk branding on the page is the "Booking powered by
Unclutter Desk" footer strip — 16px mark at 60% opacity plus a 10.5px line.

Demo open days in August 2026: 10–14, 17–21, 24–28, 31. Default selection 14,
11:30 AM, Individual.
