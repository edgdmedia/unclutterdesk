# Session formats, locations and prices: design

**Status:** draft for review · **Date:** 1 Oct 2026 · **Closes:** BKG-05, ONB-05 · **Replaces:** plan Tasks 5–6 in `docs/superpowers/plans/2026-09-30-testing-sheet-open-items.md`

## Decisions (product owner, 1 Oct 2026)

1. **A practice can have several locations.** In-person sessions happen at a named location.
2. **Prices are per service, per format.** For example, Individual Therapy costs ₦30,000 online and ₦35,000 in person. They can be the same.
3. **Formats are set per block of time, and limited by the therapist.** The practice decides, for each block of working hours, whether it's online, in person (at a location), or either. A therapist who only works online only ever has online times, so their clients only see online slots.

## What exists today

- `ConsultService` has one `priceKobo`.
- `ConsultAvailability.channel` exists, but every slot is created as `VIDEO` (`consult.service.ts` `replaceTherapistAvailability` and `staff-booking.service.ts`).
- `Tenant.address` and `Tenant.city` are single, optional fields, set in setup's Practice Details step and in Settings → Practice profile. They're only shown on the public profile page.
- The booking page has an Online / In-person toggle that's never sent anywhere, and a hard-coded "Lagos, Nigeria · Online & in-person" header.
- `ConsultBooking` doesn't record a format or location.

## Concepts

| Concept | Meaning |
|---|---|
| **Format** | `ONLINE` (secure video) or `IN_PERSON` (at a location). Replaces the free-text `channel` (`VIDEO` maps to `ONLINE`). |
| **Location** | A named place the practice sees clients: name, address, city, and optional directions ("Gate 2, second floor"). |
| **Service format** | A service offered in one format at one price. A service has one or both. |
| **Therapist formats** | What each therapist does: online, in person (at chosen locations), or both. |
| **Block** | A stretch of a therapist's weekly hours with the formats allowed in it and, for in person, the location. |
| **Slot** | One bookable time, generated from a block. It carries which formats it allows and the location. |
| **Booking** | Records the chosen format, the location (in person) and the price charged. |

## Data model

```prisma
model PracticeLocation {
  id         BigInt   @id @default(autoincrement())
  tenantId   BigInt
  name       String            // "Lekki clinic"
  address    String
  city       String
  directions String?           // shown to clients after booking
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt
  tenant     Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  @@index([tenantId, isActive])
}

model ConsultServiceFormat {        // a service offered in one format, at one price
  id        BigInt  @id @default(autoincrement())
  serviceId BigInt
  format    String                  // "ONLINE" | "IN_PERSON"
  priceKobo BigInt
  isActive  Boolean @default(true)
  service   ConsultService @relation(fields: [serviceId], references: [id], onDelete: Cascade)
  @@unique([serviceId, format])
}

model TherapistLocation {           // where an in-person therapist works
  profileId  BigInt
  locationId BigInt
  @@id([profileId, locationId])
}
```

Changes to existing models:
- `ConsultTherapistProfile`: add `offersOnline Boolean @default(true)` and `offersInPerson Boolean @default(false)`.
- `ConsultAvailability` (slot): add `allowsOnline Boolean @default(true)`, `allowsInPerson Boolean @default(false)` and `locationId BigInt?`. `channel` is kept, read-only, for old rows.
- `ConsultBooking`: add `format String` (`ONLINE` or `IN_PERSON`) and `locationId BigInt?`. `amountKobo` already records what was charged.
- `ConsultService.priceKobo` stays as the default price shown in lists. It's derived from the cheapest active format, so older screens keep working.

**Migration of existing data:**
- Each service gets an `ONLINE` format at its current `priceKobo`.
- Each therapist gets `offersOnline = true` and `offersInPerson = false`.
- Every future slot gets `allowsOnline = true` and `allowsInPerson = false`.
- Every booking gets `format = 'ONLINE'`.
- A practice with `Tenant.address` gets one location built from it, named after the practice, and the old fields are then left unused.

Nothing that works today changes behaviour: everyone stays online until they turn on in person.

## Rules

1. **A slot allows a format only if:**
   - its block allows that format;
   - the therapist offers it;
   - for in person, the block's location is one where the therapist works.

   This is enforced when slots are generated, and again at booking.
2. **A service can be booked in a format only if** it has an active `ConsultServiceFormat` for that format.
3. **The client chooses the format when a slot allows both.** One booking takes the whole slot.
4. **In person needs a location:** a practice can't offer in person until it has at least one active location.
5. **Price** = the chosen service format's `priceKobo`, minus any discount. `amountKobo` records what was charged.
6. **Video rooms** are created only for `ONLINE` bookings. In-person bookings get the address and directions instead.
7. **Changing a block** never changes slots that are already booked. Only open slots are regenerated, which is today's rule.
8. **Turning a format off** for a service, therapist or location hides it for new bookings. Existing bookings are kept and listed for the practice to handle.
9. **Deactivating a location that has future in-person bookings** is blocked, with a list of those bookings.

## API

- `GET/POST/PATCH/DELETE /v1/tenant/locations`: owners and admins. Delete is a soft delete, blocked by rule 9.
- `PATCH /v1/consult/services/:id` accepts `formats: [{ format, priceKobo, isActive }]`.
- `PATCH /v1/consult/therapist/profile` (the therapist, or an admin for a team member) accepts `offersOnline`, `offersInPerson` and `locationIds`.
- `PATCH /v1/consult/therapist/availability`: each window accepts `formats: ('ONLINE' | 'IN_PERSON')[]` and `locationId` (required when `IN_PERSON` is included). It's validated against the therapist's formats and locations, with a clear error, for example "Ada only works online. Turn on in-person for Ada first."
- `GET /v1/consult/public/services` returns each service's active formats and prices.
- `GET /v1/consult/public/availability?serviceId&format`: slots that allow the format and whose therapist offers the service. In-person slots carry their location's name and city.
- `POST` booking takes `format`. The server checks rules 1–2 and prices by rule 5.
- The public tenant info returns active locations (name and city only). The full address and directions are shown after booking.

## Screens

**Setup (practice and therapist personas):**
- New question on the Services step: **"How do you see clients?"** Online, In person, or Both.
- If in person: add the first location (name, address, city) right there.
- Prices: one price field per chosen format, with **"Same price for both"** ticked by default when both are chosen.
- Working hours: the default blocks follow the answer. "Both" gives in-person mornings and online afternoons, and the practice can change this later.

**Settings:**
- **Locations** (new, under Practice): list, add, edit and deactivate locations.
- **Services & pricing:** for each service, an Online row and an In-person row, each with a switch and a price.
- **Availability:** each block gets a format choice (Online, In person, or Either) and, for in person, a location picker limited to the therapist's locations.
- **Team & staff → therapist:** "Sees clients" (Online and/or In person) and "Works at" (locations).
- **Practice profile:** address and city move to Locations, with a link.

**Booking page:**
- **Service cards:** "Online ₦30,000 · In person ₦35,000".
- **Format choice:** shown only when the service and practice offer both, with the price on each option. A choice of in person with several locations shows the locations to pick from.
- **Times:** only slots that allow the chosen format (and location). Each time shows its format when the list mixes formats.
- **Summary and payment:** use the chosen format's price.
- **Confirmation, email and calendar invite:**
  - In person: the location's name, address and directions.
  - Online: "Your video link will be emailed and shown in your account".
- The hard-coded "Lagos, Nigeria · Online & in-person" header is replaced by the practice's real cities and formats.

**Staff booking dialog and reschedule:** the same format and location choice, with the same rules.

**Session pages:** show the format and location. "Join video" appears only for online sessions.

## Testing

- **API specs:**
  - each rule above;
  - the migration's defaults (an existing practice behaves exactly as before);
  - an online-only therapist never gets an in-person slot, even in a block that allows it;
  - booking a format the slot or service doesn't allow is refused;
  - price by format, with and without a discount;
  - deactivating a location with future bookings is blocked.
- **App tests (`renderWithApp`, network faked):** setup's "How do you see clients?" with an inline location, and the Services price rows; Availability block format and location; the booking page's format choice, filtered times, price and summary; confirmation for each format.
- **Browser check:**
  - a practice with two locations, one online-only therapist and one in-person-only therapist;
  - book each format as a client;
  - check the emails in preview mode at 390px and 1280px.

## Build order (each step shippable)

1. **Data model and migration**, with all defaults online. Nothing changes for users.
2. **Locations:** the API and the Settings → Locations page.
3. **Service formats and prices:** the API and Services & pricing.
4. **Therapist formats and locations, and blocks with formats:** generation rules 1, 7 and 8, and the Availability settings.
5. **Booking:** the public API, the booking page format choice, pricing, confirmation, email and calendar.
6. **Setup:** "How do you see clients?", the inline first location, and the per-format prices.
7. **Staff booking, reschedule and session pages.**

## Open questions

- Should a location have its own opening hours, or only through therapists' blocks? **Proposed:** only through blocks.
- Should clients see a map? **Proposed:** a "Get directions" link opening Google Maps with the address. No embedded map.
- When the online and in-person times for a service differ in length (for example 50 and 60 minutes), should length also be per format? **Proposed:** not now, since length stays per service. Revisit if a practice asks.
