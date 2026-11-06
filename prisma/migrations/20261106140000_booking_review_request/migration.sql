-- Review requests (6 Nov 2026): staff choose, per completed session, to email
-- the client a signed link to the practice's review form. Asked once per session.
ALTER TABLE "ConsultBooking" ADD COLUMN "reviewRequestedAt" TIMESTAMP(3);
