-- Slots staff create for a single booking at a time they chose. They are never
-- reopened to the public when that booking lapses or is moved. Staff bookings
-- have not shipped yet, so there are no existing rows to mark.
ALTER TABLE "ConsultAvailability" ADD COLUMN "createdForBooking" BOOLEAN NOT NULL DEFAULT false;
