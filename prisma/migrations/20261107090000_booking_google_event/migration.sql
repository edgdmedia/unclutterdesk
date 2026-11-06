-- Google Calendar events (7 Nov 2026): each push inserted a new event, so a
-- moved session left its old event behind (and got a second Meet link). The
-- booking now remembers its event and whose calendar holds it, so a push
-- updates it, a change of practitioner moves it, and a cancellation removes it.
ALTER TABLE "ConsultBooking" ADD COLUMN "googleEventId" VARCHAR(1024);
ALTER TABLE "ConsultBooking" ADD COLUMN "googleEventOwnerProfileId" BIGINT;
