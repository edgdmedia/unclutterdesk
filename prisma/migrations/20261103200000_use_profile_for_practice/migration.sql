-- §6.17: a solo practice can use its owner's profile for its page.
ALTER TABLE "Tenant" ADD COLUMN "useProfileForPractice" BOOLEAN NOT NULL DEFAULT true;
