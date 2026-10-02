# Session Formats and Locations Implementation Plan (SET-06, SET-07, ONB-05, BKG-05, BKG-07)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:**
- A practice can see clients online, in person at one or more named locations, or both.
- Each service has a price per format.
- Each session time says which formats it allows and, for in person, where: a therapist can be online at 9:00 and online-or-in-person at 10:00. The week repeats as a pattern, and any single upcoming time can be changed for that date only.
- Clients book a therapist's time, and the format and price follow from it.
- In-person clients receive the full address, directions and a Google Maps link.

**Architecture:**
- **The weekly pattern becomes stored data:** a new `TherapistWeeklyTime` model holds one row per session time in the repeating week (weekday, start, formats, location). Today hours exist only as generated slots, and the settings page rebuilds them from those slots.
- **Generation:** slots are generated from the weekly times in Lagos time and carry `allowsOnline`, `allowsInPerson` and `locationId`. A slot changed for one date (`customised`) is kept when the pattern is regenerated.
- **One rules module:** a pure `formats.ts` decides which formats a slot allows and what a booking costs. Slot generation, the public API, booking, staff booking and reschedule all use it.
- **Bookings record what was bought:** `format` and `locationId`.
- **Old data keeps working:** existing data migrates to "everything online, current price", so nothing changes for a practice until it turns on in person.

**Tech Stack:** NestJS, Prisma (PostgreSQL), React and Vite, vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-session-formats-and-locations-design.md` (including "Decisions on the open questions, 1 Oct 2026").

## Global Constraints

- **Formats** are exactly `ONLINE` and `IN_PERSON`. A legacy slot `channel` of `VIDEO` means `ONLINE`. `channel` stays on old rows, read-only; new code reads `allowsOnline`, `allowsInPerson` and `locationId`.
- **Session length** is per service and the same in both formats. Only the price differs by format.
- **Clients never choose a location.** It comes from the time they pick. No location has opening hours of its own.
- **In-person details:** location name, full address, city, directions note, and an "Open in Google Maps" link: `https://www.google.com/maps/search/?api=1&query=<encodeURIComponent(address + ', ' + city)>`. No Maps API key.
- **All schedule times are Africa/Lagos** (UTC+1, no daylight saving). Generation must not depend on the server's time zone.
- **Rules (spec "Rules" 1–9)** are enforced on the server, never trusted from the page.
- **Migration defaults:**
  - every service gets an `ONLINE` format at its current `priceKobo`;
  - every therapist gets `offersOnline = true` and `offersInPerson = false`;
  - every future slot gets `allowsOnline = true`;
  - every booking gets `format = 'ONLINE'`;
  - a practice with `Tenant.address` gets one location named after the practice;
  - every therapist with upcoming slots gets a weekly pattern rebuilt from them (Task 1).
- **Tests:** API specs use Prisma stand-ins. App tests use `renderWithApp` and fake only `utils/apiClient` and `context/AuthContext`. Run with `--maxWorkers=2 --minWorkers=1`. Migrations are generated with `prisma migrate diff`, never `prisma format`.
- **Every tenant-scoped query filters by `tenantId`** (`tenant-isolation.spec.ts` enforces it). New client-callable routes go into `client-surface.spec.ts`'s reviewed list.

## Review Focus

1. **The weekly pattern is edited after a one-off change** ("in Lekki this Thursday 10:00"). The one-off stays exactly as set; the pattern doesn't create a second slot at that time.
2. **A therapist switches to online only while they have future in-person bookings.** Those bookings stay as they are and are listed for the practice to handle; only open slots change.
3. **A client picks a slot that allows both formats, and the in-person price differs.** The summary, the Paystack charge and `amountKobo` all use the in-person price, with any discount applied to it.
4. **A practice deactivates the only location some in-person times use.** Refused while future in-person bookings exist; otherwise those weekly times and one-off slots lose in person (staying online if they allowed it, otherwise removed), and the practice is told how many changed.
5. **Server time zone UTC versus Lagos.** A 09:00 weekly time yields a slot whose `startsAt` is 08:00Z, whatever `TZ` the API runs with.
6. **An old booking with no `format`** (made before migration on another branch, or a data gap) reads as online everywhere and never offers a "Get directions" link.

---

## File Structure

**API:**
- `prisma/schema.prisma`, plus migrations `20261004090000_formats_and_locations` (schema) and `20261004090100_formats_and_locations_data` (backfill).
- `apps/api/src/modules/consult/formats.ts` (new, pure): types `Format`, `allowedFormats(...)`, `priceFor(...)`, `mapsLink(...)`, `timeErrors(...)`.
- `apps/api/src/modules/consult/hours.ts` (new, pure): `slotsFromPattern(weeklyTimes, opts)`, `timesInHours(...)`, Lagos-time arithmetic.
- `apps/api/src/modules/tenant/locations.service.ts` and `locations.controller.ts` (new): `/v1/tenant/locations`.
- `apps/api/src/modules/consult/consult.service.ts`:
  - services gain `formats`;
  - `replaceTherapistAvailability` stores the weekly times and generates from them;
  - `getTherapistAvailability` returns the weekly times and upcoming slots;
  - new `updateSlot` for one-off changes;
  - public services and availability include formats and location;
  - `createBooking` takes `format`;
  - `updateTherapistProfile` takes `offersOnline`, `offersInPerson` and `locationIds`.
- `apps/api/src/modules/consult/staff-booking.service.ts` and the reschedule path: format and location.
- `apps/api/src/modules/notifications/booking-notifier.service.ts` and `apps/api/src/modules/calendar/calendar.service.ts`: in-person details instead of a join link.

**App:**
- `pages/practice/settings/LocationsSettingsPage.tsx` (new), route `/dashboard/settings/locations` and a settings nav entry.
- `pages/practice/settings/ServicesSettingsPage.tsx`: Online and In-person rows, each with a switch and a price.
- `pages/practice/settings/AvailabilitySettingsPage.tsx`: the weekly pattern as per-time tiles (format and location each), "Set all … times to", and an Upcoming times list for one-off changes.
- Team or My profile: "Sees clients" and "Works at".
- `pages/practice/settings/PracticeProfilePage.tsx`: address and city move to Locations.
- `pages/public/booking/*`: format-aware service cards, format choice, times, summary and confirmation; the real header.
- `pages/practice/OnboardingWizardPage.tsx`: "How do you see clients?", an inline first location, and per-format prices.
- `components/booking/StaffBookingDialog.tsx`, `components/RescheduleDialog.tsx`, session pages: format and location.

---

### Task 1: Data model, migrations and backfill

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20261004090000_formats_and_locations/migration.sql` (generated) and `prisma/migrations/20261004090100_formats_and_locations_data/migration.sql` (hand-written backfill)

**Interfaces:**
- Produces these models and fields (exact names):
  - `PracticeLocation { id, tenantId, name, address, city, directions?, isActive, createdAt, updatedAt }`
  - `ConsultServiceFormat { id, serviceId, format, priceKobo, isActive }`, `@@unique([serviceId, format])`
  - `TherapistLocation { profileId, locationId }`, `@@id([profileId, locationId])`
  - `TherapistWeeklyTime { id, tenantId, profileId, weekday (0=Mon…6=Sun), start ('HH:MM'), allowsOnline, allowsInPerson, locationId? }`, `@@unique([profileId, weekday, start])`: one row per session time in the repeating week
  - `ConsultTherapistProfile.offersOnline Boolean @default(true)`, `offersInPerson Boolean @default(false)`, `sessionLengthMinutes Int @default(50)`, `gapMinutes Int @default(10)`
  - `ConsultAvailability.allowsOnline Boolean @default(true)`, `allowsInPerson Boolean @default(false)`, `locationId BigInt?`, `customised Boolean @default(false)` (changed for that date only; regeneration keeps it)
  - `ConsultBooking.format String @default("ONLINE") @db.VarChar(20)`, `locationId BigInt?`

- [ ] **Step 1: Edit the schema by hand** (keep column alignment; don't run `prisma format`). Add the four models with relations:
  - `PracticeLocation.tenant` with `onDelete: Cascade`;
  - `ConsultServiceFormat.service` with `onDelete: Cascade`;
  - `TherapistLocation` relations to `ConsultTherapistProfile(profileId)` and `PracticeLocation(id)`, both `onDelete: Cascade`;
  - `TherapistWeeklyTime` relations to tenant (Cascade), therapist (Cascade) and location (`SetNull`).

  Add the back-relations (`Tenant.locations`, `ConsultService.formats`, `ConsultTherapistProfile.locations`, `ConsultTherapistProfile.weeklyTimes`, `PracticeLocation.therapists`, `PracticeLocation.weeklyTimes`) and the optional `location` relations on `ConsultAvailability` and `ConsultBooking` (`onDelete: SetNull`). Indexes: `PracticeLocation @@index([tenantId, isActive])`, `TherapistWeeklyTime @@index([tenantId, profileId])`.

- [ ] **Step 2: Generate the schema migration**

```bash
git show HEAD:prisma/schema.prisma > /tmp/schema-before.prisma
mkdir -p prisma/migrations/20261004090000_formats_and_locations
cd apps/api && npx prisma migrate diff --from-schema-datamodel /tmp/schema-before.prisma --to-schema-datamodel ../../prisma/schema.prisma --script > ../../prisma/migrations/20261004090000_formats_and_locations/migration.sql
```

Expected: `CREATE TABLE` for the four tables, `ALTER TABLE` for the new columns, and foreign keys.

- [ ] **Step 3: Write the backfill migration**

```sql
-- prisma/migrations/20261004090100_formats_and_locations_data/migration.sql
-- Everything that exists today is online, at today's price (spec "Migration of existing data").
INSERT INTO "ConsultServiceFormat" ("serviceId", "format", "priceKobo", "isActive")
SELECT "id", 'ONLINE', "priceKobo", true FROM "ConsultService"
ON CONFLICT ("serviceId", "format") DO NOTHING;

UPDATE "ConsultAvailability" SET "allowsOnline" = true, "allowsInPerson" = false WHERE "startsAt" >= now();
UPDATE "ConsultBooking" SET "format" = 'ONLINE' WHERE "format" IS NULL OR "format" = '';

-- A practice that typed an address gets one location named after it.
INSERT INTO "PracticeLocation" ("tenantId", "name", "address", "city", "isActive", "createdAt", "updatedAt")
SELECT "id", "name", "address", COALESCE("city", ''), true, now(), now()
FROM "Tenant" WHERE "address" IS NOT NULL AND btrim("address") <> '';

-- The weekly pattern was never stored; rebuild it from each therapist's
-- upcoming open slots: every distinct (weekday, start time) in Lagos time,
-- online, as today.
INSERT INTO "TherapistWeeklyTime" ("tenantId", "profileId", "weekday", "start", "allowsOnline", "allowsInPerson", "locationId")
SELECT DISTINCT s."tenantId", s."providerProfileId",
       (EXTRACT(ISODOW FROM (s."startsAt" + interval '1 hour'))::int - 1),
       to_char((s."startsAt" + interval '1 hour')::time, 'HH24:MI'),
       true, false, NULL::bigint
FROM "ConsultAvailability" s
WHERE s."startsAt" >= now() AND s."createdForBooking" = false
ON CONFLICT ("profileId", "weekday", "start") DO NOTHING;

-- Session length follows each therapist's first upcoming slot.
UPDATE "ConsultTherapistProfile" t SET "sessionLengthMinutes" = sub.len
FROM (SELECT DISTINCT ON ("providerProfileId") "providerProfileId",
             (EXTRACT(EPOCH FROM ("endsAt" - "startsAt")) / 60)::int AS len
      FROM "ConsultAvailability" WHERE "startsAt" >= now() AND "createdForBooking" = false
      ORDER BY "providerProfileId", "startsAt") sub
WHERE t."profileId" = sub."providerProfileId" AND sub.len BETWEEN 10 AND 240;
```

(Stored times are UTC; `+ interval '1 hour'` converts to Lagos time.)

- [ ] **Step 4: Prove the backfill on a copy**

```bash
createdb unclutter_os_formats && pg_dump --no-owner unclutter_os | psql -q unclutter_os_formats
DATABASE_URL=<local url with /unclutter_os_formats> npx prisma migrate deploy --schema ../../prisma/schema.prisma
psql unclutter_os_formats -c 'select count(*) from "ConsultServiceFormat"' -c 'select count(*) from "ConsultService"' \
  -c 'select "profileId", weekday, start from "TherapistWeeklyTime" order by 1,2,3 limit 15'
```

Expected:
- one `ONLINE` format per service (equal counts);
- each therapist with upcoming slots has weekly times matching the session times the Availability page shows today;
- the locations count equals the number of tenants with an address.

- [ ] **Step 5: Generate the client, typecheck, commit**

Run: `npx prisma generate --schema ../../prisma/schema.prisma && npx tsc --noEmit -p .`. Expected: 0 errors.

```bash
git add prisma && git commit -m "Formats and locations: locations, per-format prices, a stored weekly pattern of session times; everything starts online"
```

---

### Task 2: The rules module (formats.ts and hours.ts)

**Files:**
- Create: `apps/api/src/modules/consult/formats.ts`, `apps/api/src/modules/consult/hours.ts`
- Test: `apps/api/src/modules/consult/formats.spec.ts`, `apps/api/src/modules/consult/hours.spec.ts`

**Interfaces:**
- Produces:

```ts
// formats.ts
export type Format = 'ONLINE' | 'IN_PERSON';
export const FORMATS: Format[] = ['ONLINE', 'IN_PERSON'];
export function asFormat(raw: unknown): Format | null;                       // 'online'|'ONLINE' → 'ONLINE'; 'VIDEO' → 'ONLINE'; else null
export interface TherapistFormats { offersOnline: boolean; offersInPerson: boolean; locationIds: bigint[] }
export interface TimeFormats { allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }
/** Rule 1: what one time may actually offer for this therapist. */
export function allowedFormats(time: TimeFormats, therapist: TherapistFormats): { online: boolean; inPerson: boolean; locationId: bigint | null };
/** Rule 2 + 5: the price of a service in a format, or null when not offered. */
export function priceFor(formats: Array<{ format: string; priceKobo: bigint; isActive: boolean }>, format: Format): bigint | null;
/** The cheapest active price, for lists and older screens (spec: ConsultService.priceKobo stays derived). */
export function listPrice(formats: Array<{ format: string; priceKobo: bigint; isActive: boolean }>): bigint | null;
export function mapsLink(address: string, city: string): string;
/** Validation for one time (weekly or one-off) from the Availability page, as user-facing messages. */
export function timeErrors(time: { formats: Format[]; locationId: bigint | null }, therapist: TherapistFormats & { name: string }, activeLocationIds: bigint[]): string[];
```

```ts
// hours.ts
export interface WeeklyTime { weekday: number; start: string; allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }
export interface GeneratedSlot { startsAt: Date; endsAt: Date; allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }
/** The session start times that fit in working hours, for laying out tiles: '09:00'–'12:00', 50 + 10 → ['09:00','10:00','11:00']. */
export function timesInHours(start: string, end: string, sessionLengthMinutes: number, gapMinutes: number): string[];
/** Dated slots from the weekly pattern, in Lagos time, independent of the server's TZ. `isTaken` covers booked slots and one-off changes. */
export function slotsFromPattern(times: WeeklyTime[], opts: { now: Date; days: number; sessionLengthMinutes: number; isTaken: (s: Date, e: Date) => boolean }): GeneratedSlot[];
```

- [ ] **Step 1: Write the failing tests**

```ts
// formats.spec.ts
import { describe, it, expect } from 'vitest';
import { allowedFormats, asFormat, listPrice, mapsLink, priceFor, timeErrors } from './formats';

const both = { offersOnline: true, offersInPerson: true, locationIds: [1n] };
const onlineOnly = { offersOnline: true, offersInPerson: false, locationIds: [] };
const inPersonOnly = { offersOnline: false, offersInPerson: true, locationIds: [1n] };

describe('formats', () => {
  it('reads old VIDEO slots as online', () => {
    expect(asFormat('VIDEO')).toBe('ONLINE');
    expect(asFormat('in_person')).toBe('IN_PERSON');
    expect(asFormat('phone')).toBeNull();
  });

  it('an online-only therapist never gets in person, even at a time that allows it (rule 1)', () => {
    expect(allowedFormats({ allowsOnline: true, allowsInPerson: true, locationId: 1n }, onlineOnly)).toEqual({ online: true, inPerson: false, locationId: null });
  });

  it('in person needs a location where the therapist works (rule 1)', () => {
    expect(allowedFormats({ allowsOnline: false, allowsInPerson: true, locationId: 2n }, both)).toEqual({ online: false, inPerson: false, locationId: null });
    expect(allowedFormats({ allowsOnline: false, allowsInPerson: true, locationId: 1n }, both)).toEqual({ online: false, inPerson: true, locationId: 1n });
  });

  it('prices by format and refuses a format the service does not offer (rules 2, 5)', () => {
    const f = [{ format: 'ONLINE', priceKobo: 3000000n, isActive: true }, { format: 'IN_PERSON', priceKobo: 3500000n, isActive: false }];
    expect(priceFor(f, 'ONLINE')).toBe(3000000n);
    expect(priceFor(f, 'IN_PERSON')).toBeNull();
    expect(listPrice(f)).toBe(3000000n);
  });

  it('builds a Google Maps search link without a key', () => {
    expect(mapsLink('12 Admiralty Way, Lekki', 'Lagos')).toBe('https://www.google.com/maps/search/?api=1&query=12%20Admiralty%20Way%2C%20Lekki%2C%20Lagos');
  });

  it('explains a time the therapist cannot work', () => {
    expect(timeErrors({ formats: ['IN_PERSON'], locationId: 1n }, { ...onlineOnly, name: 'Ada' }, [1n])).toEqual(['Ada only works online. Turn on in-person for Ada first.']);
    expect(timeErrors({ formats: ['ONLINE'], locationId: null }, { ...inPersonOnly, name: 'Ada' }, [1n])).toEqual(["Ada doesn't see clients online. Turn on online for Ada first."]);
    expect(timeErrors({ formats: ['IN_PERSON'], locationId: null }, { ...both, name: 'Ada' }, [1n])).toEqual(['Choose where in-person sessions happen.']);
    expect(timeErrors({ formats: ['IN_PERSON'], locationId: 9n }, { ...both, name: 'Ada' }, [1n, 9n])).toEqual(["Ada doesn't work at that location. Add it under Ada's locations first."]);
    expect(timeErrors({ formats: [], locationId: null }, { ...both, name: 'Ada' }, [1n])).toEqual(['Choose online, in person, or both.']);
  });
});
```

```ts
// hours.spec.ts
import { describe, it, expect } from 'vitest';
import { slotsFromPattern, timesInHours } from './hours';

const never = () => false;
const time = (weekday: number, start: string, over: Partial<{ allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }> = {}) => ({
  weekday, start, allowsOnline: true, allowsInPerson: false, locationId: null, ...over,
});

describe('the weekly pattern', () => {
  it('lays out the session times that fit in working hours', () => {
    expect(timesInHours('09:00', '12:00', 50, 10)).toEqual(['09:00', '10:00', '11:00']);
    expect(timesInHours('09:00', '09:40', 50, 10)).toEqual([]);
  });

  it('uses Lagos time whatever the server time zone (Mon 09:00 WAT = 08:00Z)', () => {
    const slots = slotsFromPattern([time(0, '09:00')], { now: new Date('2026-10-04T12:00:00Z'), days: 7, sessionLengthMinutes: 50, isTaken: never });
    expect(slots.map((s) => s.startsAt.toISOString())).toEqual(['2026-10-05T08:00:00.000Z']);
  });

  it('gives each time its own formats: online at 9, either at 10 (in person at Lekki)', () => {
    const slots = slotsFromPattern(
      [time(0, '09:00'), time(0, '10:00', { allowsInPerson: true, locationId: 4n })],
      { now: new Date('2026-10-04T12:00:00Z'), days: 7, sessionLengthMinutes: 50, isTaken: never },
    );
    expect(slots.map((s) => [s.startsAt.toISOString().slice(11, 16), s.allowsOnline, s.allowsInPerson, s.locationId])).toEqual([
      ['08:00', true, false, null],
      ['09:00', true, true, 4n],
    ]);
  });

  it('skips times already taken (a booking or a one-off change) and times in the past', () => {
    const now = new Date('2026-10-05T08:30:00Z');
    const taken = (s: Date) => s.toISOString() === '2026-10-05T09:00:00.000Z';
    const slots = slotsFromPattern([time(0, '09:00'), time(0, '10:00'), time(0, '11:00')], { now, days: 1, sessionLengthMinutes: 50, isTaken: taken });
    expect(slots.map((s) => s.startsAt.toISOString().slice(11, 16))).toEqual(['10:00']);
  });
});
```

- [ ] **Step 2: Run, to see them fail.** Run: `cd apps/api && npx vitest run src/modules/consult/formats.spec.ts src/modules/consult/hours.spec.ts`. Expected: FAIL (modules missing).

- [ ] **Step 3: Implement**

```ts
// hours.ts
const LAGOS_OFFSET_MIN = 60; // Africa/Lagos is UTC+1, no DST
const DAY_MS = 86_400_000;

export interface WeeklyTime { weekday: number; start: string; allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }
export interface GeneratedSlot { startsAt: Date; endsAt: Date; allowsOnline: boolean; allowsInPerson: boolean; locationId: bigint | null }

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const hhmm = (mins: number) => `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;

export function timesInHours(start: string, end: string, sessionLengthMinutes: number, gapMinutes: number): string[] {
  const out: string[] = [];
  for (let t = minutes(start); t + sessionLengthMinutes <= minutes(end); t += sessionLengthMinutes + gapMinutes) out.push(hhmm(t));
  return out;
}

/** Midnight in Lagos of the Lagos calendar day containing `at`, as a UTC Date. */
function lagosMidnight(at: Date): Date {
  const local = new Date(at.getTime() + LAGOS_OFFSET_MIN * 60_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()) - LAGOS_OFFSET_MIN * 60_000);
}

export function slotsFromPattern(
  times: WeeklyTime[],
  opts: { now: Date; days: number; sessionLengthMinutes: number; isTaken: (s: Date, e: Date) => boolean },
): GeneratedSlot[] {
  const out: GeneratedSlot[] = [];
  const first = lagosMidnight(opts.now);
  for (let d = 0; d <= opts.days; d++) {
    const dayStart = new Date(first.getTime() + d * DAY_MS);
    const lagosDay = new Date(dayStart.getTime() + LAGOS_OFFSET_MIN * 60_000).getUTCDay(); // 0 = Sunday
    const weekday = lagosDay === 0 ? 6 : lagosDay - 1;
    for (const t of times.filter((x) => x.weekday === weekday).sort((a, b) => minutes(a.start) - minutes(b.start))) {
      const s = new Date(dayStart.getTime() + minutes(t.start) * 60_000);
      const e = new Date(s.getTime() + opts.sessionLengthMinutes * 60_000);
      if (e > opts.now && !opts.isTaken(s, e)) {
        out.push({ startsAt: s, endsAt: e, allowsOnline: t.allowsOnline, allowsInPerson: t.allowsInPerson, locationId: t.locationId });
      }
    }
  }
  return out;
}
```

`formats.ts`: implement exactly to the tests:
- `allowedFormats`: `online = time.allowsOnline && t.offersOnline`; `inPerson = time.allowsInPerson && t.offersInPerson && time.locationId != null && t.locationIds.includes(time.locationId)`; `locationId = inPerson ? time.locationId : null`.
- `priceFor`: the active row for the format, else null.
- `listPrice`: the minimum of the active prices, else null.
- `mapsLink`: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address}, ${city}`)}`.
- `timeErrors`: returns the messages in the order the test shows (no formats; in person but the therapist doesn't offer it; online but the therapist doesn't offer it; in person without a location; a location not among the therapist's, or inactive).

- [ ] **Step 4: Run, to see them pass.** Expected: PASS. Also run `TZ=UTC npx vitest run src/modules/consult/hours.spec.ts` and `TZ=America/New_York …` to prove time-zone independence (Review Focus 5).
- [ ] **Step 5: Commit.** `git commit -m "Formats and locations: one rules module for formats, prices and Lagos-time slots from the weekly pattern"`

---

### Task 3: Locations: API and Settings → Locations

**Files:**
- Create: `apps/api/src/modules/tenant/locations.service.ts`, `locations.controller.ts`; register them in `tenant.module.ts`
- Create: `apps/app/src/pages/practice/settings/LocationsSettingsPage.tsx`; route `/dashboard/settings/locations` in `App.tsx`; a nav entry beside "Practice profile" (find the settings nav list with `grep -rn "settings/profile" apps/app/src/components`)
- Modify: `apps/app/src/pages/practice/settings/PracticeProfilePage.tsx` (replace the address and city inputs with "Addresses live in Locations" and a link)
- Test: `apps/api/src/modules/tenant/locations.spec.ts`, `apps/app/src/pages/__tests__/LocationsSettingsPage.test.tsx`

**Interfaces:**
- Produces: `GET/POST /v1/tenant/locations`, `PATCH/DELETE /v1/tenant/locations/:id` (`@Permissions('practice.manage')`; check the permission that owners and admins hold in `common/permissions.ts` and use it).
- `LocationView = { id: string; name: string; address: string; city: string; directions: string | null; isActive: boolean; mapsUrl: string; upcomingInPerson: number }`.
- `LocationsService.list(tenantId)`, `create(tenantId, dto)`, `update(tenantId, id, dto)`, `deactivate(tenantId, id): Promise<{ deactivated: true; changedTimes: number }>` (throws `BadRequestException` listing up to 5 bookings when future in-person bookings use it: rule 9).

Rules:
- name, address and city are required, trimmed, at most 120/240/80 characters; directions at most 500;
- names are unique per practice among active locations;
- deactivating sets `isActive=false`; removes it from `TherapistLocation`; on weekly times and on open one-off slots that used it, sets `allowsInPerson=false` and `locationId=null`, deleting any that are then neither online nor in person (Review Focus 4); then regenerates open slots for the affected therapists (call `ConsultService.regenerateFromPattern(tenantId, profileId)` from Task 5; until Task 5 lands, the method is a no-op stub that Task 5 replaces; note it in the ledger).

- [ ] **Step 1: Write the failing API tests:**
  - list returns only this tenant's locations, with a maps link;
  - create rejects a missing address ("Add the street address.");
  - a duplicate active name is refused;
  - deactivate is refused with "3 upcoming in-person sessions use Lekki clinic: …" when bookings exist;
  - deactivate switches affected weekly times and one-off slots off in-person and returns `changedTimes`;
  - PATCH on another tenant's location gives 404.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement** the service and controller. Every query is scoped `{ tenantId }`.
- [ ] **Step 4: Write the failing app test.** The page lists locations (name, address, city), adds one through a small form (Name, Street address, City, Directions for clients), edits inline, and deactivates with a confirm, showing the server's refusal text as is.
- [ ] **Step 5: Implement the page** with `Card`, `Eyebrow`, `Button` and `Input` from `@unclutterdesk/ui`, at 390px and 1280px. Empty state: "Add the places you see clients in person. Clients get the address and directions after they book."
- [ ] **Step 6: Run the API and app suites; commit.** `git commit -m "Formats and locations: practices manage their locations"`

---

### Task 4: Service formats and prices

**Files:**
- Modify: `apps/api/src/modules/consult/consult.service.ts` (`serviceView`, `serviceFields`, `createService`, `updateService`, `listServices`, `getPublicServices`)
- Modify: `apps/app/src/pages/practice/settings/ServicesSettingsPage.tsx`
- Test: `apps/api/src/modules/consult/services.spec.ts` (extend), `apps/app/src/pages/__tests__/ServicesSettingsPage.test.tsx` (create)

**Interfaces:**
- Consumes: `priceFor` and `listPrice` (Task 2).
- Produces:
  - service views gain `formats: Array<{ format: Format; priceKobo: string; isActive: boolean }>`;
  - `priceKobo` stays as `listPrice` (spec);
  - `POST /v1/consult/services` and `PATCH /v1/consult/services/:id` accept `formats` (upserted on `[serviceId, format]`). A legacy `priceKobo` alone updates the `ONLINE` row, so older screens and setup keep working;
  - `getPublicServices` returns only active formats, and omits a service with none.

- [ ] **Step 1: Write the failing tests:**
  - a service saved with online ₦30,000 and in person ₦35,000 returns both, and `priceKobo` is `'3000000'`;
  - turning in person off hides it from the public services;
  - a legacy PATCH with `priceKobo` only changes the ONLINE price;
  - a service with no active formats is refused ("Offer this service online, in person, or both.");
  - App: each service row shows Online and In person switches with prices; saving sends `formats`; "Same price for both" copies the online price into in person.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.** After a write, `ConsultService.priceKobo` is recomputed as `listPrice` and stored, so the dashboards that read it stay right.
- [ ] **Step 4: Run both suites; commit.** `git commit -m "Formats and locations: each service is priced per format"`

---

### Task 5: Therapists, the weekly pattern and one-off changes

**Files:**
- Modify: `consult.service.ts`:
  - `updateTherapistProfile` accepts `offersOnline`, `offersInPerson` and `locationIds`, validated against active locations, refused if in person is on with no locations;
  - `replaceTherapistAvailability` stores the weekly times (plus length and gap on the therapist), then calls `regenerateFromPattern`;
  - new `regenerateFromPattern(tenantId, profileId)`;
  - new `updateSlot(tenantId, profileId, slotId, dto)` for one-off changes;
  - `getTherapistAvailability` returns `{ cancellationHours, sessionLengthMinutes, gapMinutes, weeklyTimes, slots }`.
- Modify: `apps/api/src/modules/consult/consult.controller.ts`:
  - DTO shapes;
  - `PATCH /v1/consult/therapist/slots/:id` (the therapist, or an admin for a team member) with `{ formats: Format[]; locationId?: string | null } | { reset: true }`;
  - the team/admin route that edits a team member's profile (find it with `grep -rn "updateTherapistProfile" apps/api/src`).
- Modify: `apps/app/src/pages/practice/settings/AvailabilitySettingsPage.tsx` (rebuilt; see "The Availability page"); the team-member editor and My profile ("Sees clients": Online, In person; "Works at": location checkboxes).
- Test: `apps/api/src/modules/consult/availability-regenerate.spec.ts` (extend), `apps/api/src/modules/consult/therapist-formats.spec.ts` and `apps/api/src/modules/consult/one-off-slots.spec.ts` (create), `apps/app/src/pages/__tests__/AvailabilitySettingsPage.test.tsx` (create)

**Interfaces:**
- Consumes: `slotsFromPattern`, `timesInHours`, `allowedFormats`, `timeErrors` (Task 2); `TherapistWeeklyTime`, `ConsultAvailability.customised` (Task 1).
- Produces:
  - `PATCH /v1/consult/therapist/availability` body: `{ weeklyTimes: Array<{ weekday: number; start: 'HH:MM'; formats: Format[]; locationId?: string | null }>; sessionLengthMinutes; gapMinutes; cancellationHours? }`. The old body (`days[].windows`, no formats) is still accepted: each window becomes online weekly times via `timesInHours`, so older clients keep working.
  - `regenerateFromPattern(tenantId: bigint, profileId: bigint): Promise<void>`:
    - deletes future open slots that have no bookings **and are not `customised`**;
    - builds slots with `slotsFromPattern`, where `isTaken` covers booked slots **and** customised slots (Review Focus 1);
    - applies `allowedFormats` per time for this therapist, dropping times that end up with no format;
    - creates them with `channel` set to `'VIDEO'` when online-only, else `'IN_PERSON'` (kept for old readers).
  - `updateSlot(...)`:
    - a slot with a non-cancelled booking is refused: 409 "This time is booked. Reschedule the session instead.";
    - `{ formats, locationId }` validates with `timeErrors`, then sets `allowsOnline`, `allowsInPerson`, `locationId` and `customised=true`;
    - `{ reset: true }` deletes the open slot and regenerates, so the weekly pattern's version comes back.
  - Slot views in `getTherapistAvailability` include `formats`, `location` (`{ id, name }`), `customised` and `booked`.

Rules:
- Validation errors from `timeErrors` return 400; for weekly times, the message is prefixed with the time ("Mon 10:00: Ada only works online. Turn on in-person for Ada first.").
- Changing the pattern or the therapist's formats never touches booked slots or one-off changes (rule 7). If a one-off change is no longer allowed after the therapist's formats change, it's corrected the same way as a weekly time (format removed; the slot is deleted if none remains) and listed in the response.
- If a therapist turns off a format while future bookings in that format exist, the change is saved, and the response includes `affectedBookings: [{ id, startsAt, clientName, format }]`. The app shows these as "These sessions keep their format; contact the clients if that needs to change." (rule 8; Review Focus 2)

**The Availability page:**
- **Working hours per day** (as today: on/off and hours, with "Add hours"), plus session length and gap. Changing hours lays out the times with `timesInHours`. A time that already existed keeps its format and location; new times copy the format of the nearest earlier time that day, or Online.
- **Tiles:** each session time is a tile showing its format: "Online", "In person · Lekki", "Either · Lekki". Tapping a tile opens a small chooser with Online, In person, Either and, when in person is involved, a location select limited to the therapist's locations.
- **"Set all Monday times to…":** one chooser per day that applies to every tile that day.
- **Upcoming times:** the next 4 weeks grouped by date, each time a tile like the above. Booked times are shown but locked ("Booked"); one-off changes carry a "This date only" badge and a "Back to weekly" action. Changing a tile here calls `PATCH /v1/consult/therapist/slots/:id`.
- Saving the weekly pattern sends `weeklyTimes`. The page explains: "Changes apply to open times. Booked sessions and this-date-only changes stay as they are."

- [ ] **Step 1: Write the failing API tests:**
  - saving weekly times stores them, saves length and gap, and GET returns them;
  - Mon 09:00 online and 10:00 either at Lekki produce slots with exactly those formats;
  - an online-only therapist saving an in-person time gets 400 "Mon 10:00: Ada only works online. Turn on in-person for Ada first.";
  - a one-off change sets `customised` and survives a later pattern save (no duplicate slot at that time);
  - "Back to weekly" restores the pattern's formats;
  - changing a booked slot gets 409;
  - turning in person off regenerates open slots online-only, corrects one-off changes, and reports affected bookings;
  - an old-shape body (`days[].windows`) still works and yields online slots;
  - booked slots are untouched.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.** Replace Task 3's `regenerateFromPattern` stub, and ledger that.
- [ ] **Step 4: Write the failing app tests:**
  - the page loads saved weekly times (not derived from slots) and shows tiles with their formats;
  - tapping a tile and choosing "Either" with Lekki updates it, and Save sends it in `weeklyTimes`;
  - "Set all Monday times to Online" changes every Monday tile;
  - the location select lists only the therapist's locations;
  - an upcoming time changed to "In person" calls the slot PATCH and then shows "This date only";
  - a booked upcoming time can't be changed;
  - the server's 400 text shows in the error banner;
  - affected bookings show after save.
- [ ] **Step 5: Implement the UI,** reusing `SegmentedControl`, `Card` and `Button` from `@unclutterdesk/ui`. Tiles wrap at 390px; check 1280px.
- [ ] **Step 6: Run both suites; commit.** `git commit -m "Formats and locations: each session time has its own format, set weekly or for one date"`

---

### Task 6: Public availability, booking, and what the client receives

**Files:**
- Modify: `consult.service.ts`:
  - `getPublicAvailability(tenantId, providerProfileId?, serviceId?, format?)` returns each slot's `formats: Format[]` (from `allowsOnline` and `allowsInPerson`, filtered by the service's active formats) and, for in person, `location: { name, city }`;
  - with `format`, it returns only slots allowing it.
- Modify: `consult.service.ts`, `createBooking`. The DTO gains `format`:
  - if the slot allows exactly one format, it's taken when `format` is omitted; otherwise `format` is required ("Choose online or in person.");
  - check rule 1 (the slot allows it and the therapist still offers it) and rule 2 (the service offers it);
  - the price is `priceFor(service.formats, format)`, then the discount is validated against that price;
  - store `format` and `locationId` on the booking;
  - create a video room only for `ONLINE` (rule 6).
- Modify: `apps/api/src/modules/notifications/booking-notifier.service.ts`. `load()` includes `location`. `confirmedEmail` replaces the join link for in-person bookings with: "Where: {name}, {address}, {city}. {directions}" plus the action "Open in Google Maps" (`mapsLink`). Online stays as today.
- Modify: `apps/api/src/modules/calendar/calendar.service.ts` (Google event and `.ics`): `location` is the full address for in person and the join link for online; the description carries the directions.
- Modify: the client portal booking payloads (`grep -rn "videoRoomLink:" consult.service.ts`) to add `format` and `location` (with `mapsUrl`), and to send no `videoRoomLink` for in person.
- Modify: `apps/api/src/modules/tenant/tenant.service.ts`. Public info adds `locations: [{ name, city }]` (active only) and `formats: Format[]` (any active service format across services), for the booking page header.
- Test: `apps/api/src/modules/consult/booking-formats.spec.ts` (create), plus extensions to `booking-notifier.spec.ts` and the calendar spec.

**Interfaces:**
- Consumes: Tasks 1, 2 and 4.
- Produces: the public slot `{ ...existing, formats: Format[]; location: { name: string; city: string } | null }`; the booking response gains `format` and `location: { name, address, city, directions, mapsUrl } | null`.

- [ ] **Step 1: Write the failing tests:**
  - availability with `format=IN_PERSON` returns only in-person slots, each with location name and city;
  - a slot allowing both, booked with no format, gets 400;
  - booking `IN_PERSON` at ₦35,000 with a 10% code charges ₦31,500 and stores `format` and `locationId` (Review Focus 2);
  - booking a format the service stopped offering gets 400;
  - an in-person booking has no `videoRoomName`;
  - the confirmed email for in person has the address, the directions and a maps link, and no join link;
  - the calendar event location is the address;
  - an old booking with `format` null reads as online (Review Focus 5).
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the API suite** (and fix specs that construct bookings without `format` by adding `format: 'ONLINE'` to their fixtures). **Commit.** `git commit -m "Formats and locations: booking takes a format and its price; in-person clients get the address and a map link"`

---

### Task 7: The booking wizard

**Files:**
- Modify:
  - `apps/app/src/pages/public/booking/useBookingData.ts`: types gain `formats` and `location`;
  - `bookingSlots.ts`: `formatOf` reads `formats`, falling back to `channel`;
  - `bookingWizard.ts`: state gains `format: Format | null`; `chooseSlot` sets it when the slot allows one format, else null; new action `chooseFormat`;
  - `ServiceStep.tsx`: card price "Online ₦30,000 · In person ₦35,000";
  - `TimeStep.tsx`: the existing filter stays. Each time shows its format, or "Online or in person". The in-person location line shows the location's name and city (not the practice address);
  - `ReviewPayStep.tsx`: a format choice (two radio cards with prices) when the chosen slot allows both; the summary uses the chosen format's price;
  - `BookingWizardPage.tsx`: sends `format`; the header shows the real cities and formats from public info, replacing "Lagos, Nigeria · Online & in-person";
  - `ConfirmationStep.tsx`: in person shows the name, full address, directions and an **Open in Google Maps** button; online stays as today.
- Test: extend `booking/__tests__/*` (`ServiceStep`, `TimeStep`, `ReviewPayStep`, `BookingWizardPage`, `ConfirmationStep`, `bookingWizard`)

**Interfaces:**
- Consumes: the Task 6 API shapes.

- [ ] **Step 1: Write the failing tests:**
  - a service card shows both prices;
  - a slot allowing both makes step 4 ask "How would you like to meet?" with both prices, and Pay is disabled until one is chosen;
  - choosing in person updates the total;
  - a slot allowing only in person goes straight to the in-person price;
  - the booking POST carries `format`;
  - the confirmation for in person shows the address and a maps link with the right URL;
  - the header shows "Lagos · Online & in person" from the data, and "Online sessions" for an online-only practice.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the app suite;** check at 390px and 1280px; **commit.** `git commit -m "Formats and locations: the booking page offers the format, its price and where to go"`

---

### Task 8: Setup: "How do you see clients?"

**Files:**
- Modify: `apps/app/src/pages/practice/OnboardingWizardPage.tsx`:
  - the Services step (`stepKey === 'availability'`, around line 874) gets the new question and an inline first location;
  - the Practice Details step loses address and city (moved to the inline location);
  - the save calls send formats, locations, therapist formats and weekly times.
- Test: `apps/app/src/pages/__tests__/OnboardingServicesStep.test.tsx` (create)

**Interfaces:**
- Consumes: `/v1/tenant/locations` (Task 3), service `formats` (Task 4), therapist formats and weekly times (Task 5).

Behaviour (spec "Setup"):
- **"How do you see clients?":** Online, In person, or Both. The default is Online.
- **In person or Both:** an inline "Where do you see clients?" with Name (prefilled with the practice name), Street address, City (prefilled from the draft's city) and an optional directions note.
- **Prices:** one field per chosen format. With Both, "Same price for both" is ticked by default.
- **Default weekly times** (laid out with `timesInHours` over 09:00–17:00 on the chosen days):
  - Online: every time online;
  - In person: every time in person at the new location;
  - Both: times before 13:00 in person at the new location, the rest online. The practice can change any time later on the Availability page.
- **Save order:** create the location, then update the therapist's formats and locations, then set the service formats, then save the weekly times. Every step is idempotent on retry (find the existing location by name before creating one).
- **Drafts:** an existing draft with `city`/`address` from the old Details step pre-fills the inline location.

- [ ] **Step 1: Write the failing tests:**
  - Both plus an address saves a location, a service with two formats (same price by default), a therapist with both formats, and weekly times split morning in person / afternoon online;
  - Online makes no location call and sends online-only weekly times;
  - an old draft with an address pre-fills the location fields;
  - a missing street address for In person blocks Continue with "Add the street address clients will come to."
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the app suite; commit.** `git commit -m "Formats and locations: setup asks how the practice sees clients"`

---

### Task 9: Staff booking, reschedule and session pages

**Files:**
- Modify: `apps/api/src/modules/consult/staff-booking.service.ts` (`resolveTime`, price, video room only for online; a staff-made time takes `format` and, for in person, `locationId` from the therapist's locations); the reschedule service (`grep -rn "reschedule" apps/api/src/modules/consult/*.service.ts`): the new slot must allow the booking's format; otherwise "That time isn't available in person. Choose another." and the format can't change silently.
- Modify: `apps/app/src/components/booking/StaffBookingDialog.tsx`, `apps/app/src/components/RescheduleDialog.tsx`, the session detail and sessions list pages: show the format and location. "Join video" shows only for online. Staff can choose the format where the slot allows both.
- Test: extend `staff-booking.spec.ts`, `reschedule.spec.ts`, `SessionDetailPage.test.tsx`, `SessionsPage.test.tsx`

- [ ] **Step 1: Write the failing tests:**
  - staff booking in person at a location stores both and creates no video room;
  - rescheduling an in-person booking onto an online-only slot is refused;
  - the session page shows "In person · Lekki clinic" and no Join button;
  - an online session still shows Join.
- [ ] **Step 2: Run, to see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run both full suites; commit.** `git commit -m "Formats and locations: staff booking, reschedule and session pages know the format and place"`

---

### Task 10: Browser check and the testing sheet

- [ ] **Step 1:** On a copy of the local database (as in Task 1 Step 4), start the API and the app on spare ports, pointing the app at the API with `API_PROXY_TARGET`.
- [ ] **Step 2:** As `dr.jane@smiththerapy.ng`:
  - add two locations;
  - set Individual Therapy to online ₦30,000 and in person ₦35,000;
  - make Jane both, working at Lekki;
  - Monday 09:00 online, 10:00 and 11:00 either at Lekki, 14:00–17:00 online;
  - change next Thursday 10:00 to in person only (this date only), then edit the weekly pattern and check the Thursday change is still there;
  - add a second therapist who is online only;
  - check that the online-only therapist cannot get an in-person time, and the reverse.
- [ ] **Step 3:** As a client at `/book`:
  - Monday 9:00 is online only at ₦30,000;
  - Monday 10:00 asks online or in person; in person charges ₦35,000, and the confirmation and the logged email show the Lekki address and a maps link, with no join link;
  - next Thursday 10:00 is in person only.

  Check both at 390px and 1280px.
- [ ] **Step 4:** Run setup as a new practice choosing Both, and confirm the location, prices and weekly times it created.
- [ ] **Step 5:** In `docs/testing-feedback.md`, set SET-06, SET-07, ONB-05, BKG-05 and BKG-07 to **Fixed**, with the commits and what Steps 2–4 showed. Commit.
