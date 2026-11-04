-- Change a booked session's service (4 Nov 2026): what the client still owes
-- after staff move them to a dearer service, and how the desk settled it.
ALTER TABLE "ConsultBooking" ADD COLUMN "balanceKobo" BIGINT;
ALTER TABLE "ConsultBooking" ADD COLUMN "balanceStatus" VARCHAR(10);
ALTER TABLE "ConsultBooking" ADD COLUMN "balanceSettledAt" TIMESTAMP(3);
ALTER TABLE "ConsultBooking" ADD COLUMN "balanceSettledByProfileId" BIGINT;
