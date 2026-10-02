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
