-- The amount actually charged for a booking was never stored. It was computed
-- at booking time (service price minus any discount), handed to Paystack, and
-- discarded — so nothing in the database records what a client paid, and any
-- receipt or payment history had to guess from the service's current price.
-- That guess is wrong for every discounted booking, and wrong for every booking
-- whose service has since been repriced.
ALTER TABLE "ConsultBooking" ADD COLUMN "amountKobo" BIGINT;
ALTER TABLE "ConsultBooking" ADD COLUMN "discountCodeUsed" TEXT;

-- Existing rows: the service price is the best available answer, and it is the
-- exact answer for every booking made without a discount code.
UPDATE "ConsultBooking" b
SET "amountKobo" = s."priceKobo"
FROM "ConsultService" s
WHERE b."serviceId" = s."id" AND b."amountKobo" IS NULL;
