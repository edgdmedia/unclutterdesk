-- AlterTable
ALTER TABLE "ConsultBooking" ADD COLUMN     "holdReleasedAt" TIMESTAMP(3),
ADD COLUMN     "refundRef" TEXT,
ADD COLUMN     "refundedAt" TIMESTAMP(3);

