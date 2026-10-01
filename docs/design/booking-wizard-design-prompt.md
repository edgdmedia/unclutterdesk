# Design brief: client booking wizard

*For Claude Design. Copy everything below the line.*

---

Design the **client booking flow** for Unclutter Desk, a practice-management app for therapists and counselling practices in Nigeria. This page is what a practice's clients see when they open the practice's booking link (for example `calmrooms.unclutterdesk.com`). The practice shares it on WhatsApp, Instagram and email, so most visitors are on a phone, many are booking therapy for the first time, and they may feel anxious. The page has to feel calm, trustworthy and simple.

The current page shows everything at once: services, calendar, times, the client's details, session format, discount code and payment all sit on one long screen. It has empty space that does no work, the parts don't read as one flow, and the practice's logo never appears. Replace it with a **step-by-step wizard**.

## The steps

1. **Choose a service**
   - The practice's services as cards: name, short description, length (for example "50 min") and price in naira (for example "₦35,000").
   - Show which formats each service is offered in, as small tags: "Online", "In person" or both.
   - If the practice has only one service, skip this step and show that service at the top of step 2.

2. **Pick a time**
   - A horizontal date strip covering the next 4 weeks. Days with no free times are dimmed and can't be selected.
   - The free times for the chosen day, as a grid of time buttons. Each time shows its format ("Online" or "In person"), because the practice decides the format of each time; the client doesn't choose it separately.
   - When the practice offers both formats, a filter above the times: **All / Online / In person**.
   - For "In person", show the practice's address once the time is picked.
   - An empty state for "No times this week", with a button to jump to the next available day.

3. **Your details**
   - Sign in, or create an account. One account works with every practice on Unclutter Desk, and each practice sees only its own records. Say this in one short, reassuring line.
   - The fields for a new account are first name, last name, email, phone and password.
   - A client who is already signed in sees "Booking as Ada Okafor · Not you?" and goes straight on.
   - An optional "Anything the therapist should know before the first session?" note.

4. **Review and pay**
   - A summary of the service, date and time (in the practice's local time, West Africa Time), format, therapist and price.
   - A discount code field, collapsed by default ("Have a discount code?"). When applied, show the saving and the new total.
   - The payment choice:
     - **Pay online** with card or bank through Paystack. Say "Payments processed securely by Paystack".
     - **Bank transfer**, only when the practice has turned it on. Explain that the time is held for 48 hours, show the practice's account details with a copy button, and give the transfer reference to use.
   - The cancellation policy in one line (for example "Free cancellation up to 24 hours before").
   - The main button: "Pay ₦35,000" or "Hold my time".

5. **Confirmation**, after payment or hold
   - "You're booked", with the date, time and format, an **Add to calendar** button and, for online sessions, "Your video link will be emailed and shown in your account".
   - **What's next:** "Please complete two short forms before your first session: About you (intake) and Confidentiality agreement." Each has a **Start** button, and they can also be done later from the emailed link or the client's account. The forms are filled in after booking, never during it.
   - For bank transfer: the transfer details again, and a clear countdown until the hold ends.

## Layout and behaviour

- **The header on every step:** the practice's logo (or an initials badge if it has none), the practice name, and a small "Secure booking" mark. Nothing else: no app navigation.
- **Progress:** a slim four-step indicator (Service, Time, Details, Pay). Earlier steps are clickable to go back. Every step has a **Back** control.
- **Phone first (390px wide):** single column, with the main button pinned to the bottom of the screen and showing the running total once a service is picked. No sideways scrolling. Touch targets at least 44px.
- **Desktop (1280px):** the step on the left (about 60%), and a sticky summary card on the right that builds as the client goes: service, then time, then total. Use the width for that summary, not for padding.
- **Tablet (820px):** as on the phone, but with more breathing room.
- **Practice information** (bio, city, reviews and average rating) lives on the practice's separate profile page. Here, show at most a small "★ 4.9 · 32 reviews" line in the header area, linking to that page.
- **States to include:** loading (skeletons, not spinners), no services, no times in the next 4 weeks, a slot taken while the client was deciding ("That time was just booked. Here are the nearest free times"), payment failed, discount code invalid, and a signed-in client.

## Brand and visual system

Every practice has **its own colours and logo**. Design with placeholder brand slots, not fixed colours:
- **Brand primary:** main buttons, the selected date and time, and progress. The default is deep teal `#0F3A53`.
- **Brand secondary:** small accents only. The default is warm gold `#E3B341`.
- Test the design with at least two very different practice colours: the default teal, and a light one such as a pale lilac. Make sure button text stays readable on both.

The fixed product palette (Unclutter Desk tokens):
- Page background `#F8FAFC`, cards `#FFFFFF`, borders `#E2E8F0`, muted fills `#F1F5F9`.
- Text `#0F172A`, body `#475569`, secondary `#64748B`, subtle `#94A3B8`.
- Success `#16A34A` on `#F0FDF4`, pending `#C2410C` on `#FFF7ED`, danger `#E11D48` on `#FFF1F2`.

Typography: **Outfit** is the only typeface (variable weight). Use JetBrains Mono only for codes, such as the transfer reference.

Shape: rounded corners of 14–24px on cards and inputs, pill-shaped time buttons, soft shadows used sparingly, and 48–54px main buttons.

Tone of voice: warm, plain and brief. Say "your session", not "appointment slot". No clinical jargon, and no exclamation marks except "You're booked".

## Deliverables

- Each of the 5 steps at **390px** and **1280px**, plus step 2 at **820px**.
- The states listed above.
- The header with a logo and with the initials fallback.
- A light practice colour applied to steps 2 and 4, to show the brand slots work.
- A short note on spacing and component sizes (date strip, time button, summary card, sticky footer), so it can be built as reusable components.
