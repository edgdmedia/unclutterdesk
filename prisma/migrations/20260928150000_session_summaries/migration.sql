ALTER TABLE "ConsultBooking"
  ADD COLUMN "internalSummary" TEXT,
  ADD COLUMN "clientRecap" TEXT,
  ADD COLUMN "clientRecapSentAt" TIMESTAMP(3);
