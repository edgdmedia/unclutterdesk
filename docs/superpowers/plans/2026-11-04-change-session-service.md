# Change a booked session's service

A client booked Consultation when they meant Individual Session. Staff can move, cancel and complete a session, but not change what was booked.

## Decisions (owner, 4 Nov 2026)

- **Price:** the client keeps what they paid. The session shows the paid amount, the new price and the balance. Staff record the balance as paid at the practice, or waive it. Refunds of an overpayment stay manual, and the page says so.
- **Length:** when the new service is longer, the session is extended if the practitioner is free for the added time. Open slots in that time are closed, as a custom time does. Otherwise staff are told to reschedule as well.

## API (PR A, this one)

- [ ] **Migration:** `ConsultBooking.balanceKobo`, `balanceStatus` ('DUE' | 'PAID' | 'WAIVED'), `balanceSettledAt`, `balanceSettledByProfileId`.
- [ ] **`PATCH practice/sessions/:id/service { serviceId }`**, with the same permission as reschedule. Only the desk (`viewAll`) can use it.
  - **Rules:** the session must not be cancelled. The service must be active, in the tenant and offered in the booking's format.
  - **Time:** the new end is the start plus the new service's duration. If the session hasn't started, the slot's end moves:
    - Longer: under the staff-booking advisory lock, close open slots in the added time, check for a clash, then extend.
    - Shorter: the end moves in, and the freed time isn't reopened.
    - If the session has started, its time is kept.
  - **Money:**
    - Unpaid online booking: `amountKobo` becomes the new price.
    - Paid, manual or free booking: balance = new price − `amountKobo`. If it's above 0 the balance is DUE; if not, it's cleared.
    - The response carries `overpaidKobo` so the page can say a refund is manual.
  - **Afterwards:** the calendar event is updated, and the client gets an email ("Your session is now …", with any balance).
- [ ] **`POST practice/sessions/:id/balance { action: 'PAID' | 'WAIVED' }`** (`payments.desk`).
  - PAID adds the balance to `amountKobo`, so revenue counts it, and stamps who and when.
  - WAIVED keeps the figure for the record.
- [ ] **Settler:** if a Paystack charge for a pending booking is less than `amountKobo` (an old checkout finishing after a price change), the booking confirms, `amountKobo` takes what was paid, and the difference becomes a DUE balance.
- [ ] **The session view** returns the service id, duration, format, price, balance and its status.

## App

- [ ] **Session page:** a "Change service" dialog lists the services offered in the session's format, with length and price. It previews the new end time, the price, what's paid and the balance.
- [ ] **Balance card:** shows the amount owed, with "Paid at the practice" and "Waive".

## Later (PR B)

- A Paystack pay link for a DUE balance. It needs its own reference prefix in the settler and the webhook.
