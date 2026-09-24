-- Manual payments: a practice on Pro or Clinic can let clients pay by bank
-- transfer, confirmed by its staff. Additive only; off by default.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "manualPaymentDetails" JSONB,
ADD COLUMN     "manualPaymentsEnabled" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ConsultBooking" ADD COLUMN     "clientReportedPaidAt" TIMESTAMP(3),
ADD COLUMN     "holdExpiresAt" TIMESTAMP(3),
ADD COLUMN     "paymentConfirmedByProfileId" BIGINT,
ADD COLUMN     "paymentMethod" VARCHAR(20) NOT NULL DEFAULT 'PAYSTACK';

