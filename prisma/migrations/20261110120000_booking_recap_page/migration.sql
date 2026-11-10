-- The recap as a page in the client portal: attached assessments and the
-- client's ticks on its tick-box items.
ALTER TABLE "ConsultBooking" ADD COLUMN "recapAssessmentKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ConsultBooking" ADD COLUMN "recapTicks" JSONB;
