-- VID-02: each practice chooses how early its video rooms open (0, 5, 10 or 15 minutes).
ALTER TABLE "Tenant" ADD COLUMN "joinOpensMinutesBefore" INTEGER NOT NULL DEFAULT 10;
