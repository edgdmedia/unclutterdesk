-- v2 Phase 0: a FREE plan below Starter, complimentary periods with a reason,
-- and the lapse timeline for paid plans (spec §5.4, §5.4a).

CREATE TYPE "ComplimentaryReason" AS ENUM ('INVITE_CODE', 'MIGRATION', 'INTERNAL');

ALTER TABLE "Tenant" ALTER COLUMN "subscriptionTier" SET DEFAULT 'FREE';
ALTER TABLE "Tenant" ADD COLUMN "complimentaryReason" "ComplimentaryReason";
ALTER TABLE "Tenant" ADD COLUMN "subscriptionLapsedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "downgradeAt" TIMESTAMP(3);
ALTER TABLE "Profile" ADD COLUMN "pausedByDowngradeAt" TIMESTAMP(3);

-- The demo practice (isDemo) shows paid features to prospects and must not
-- drop to FREE: it gets a complimentary plan with no end date, like the
-- founder's practice (set by script after deploy).
UPDATE "Tenant"
SET "complimentaryReason" = 'INTERNAL',
    "complimentaryUntil" = NULL
WHERE "isDemo" = true;

-- Existing invite-code periods get their reason.
UPDATE "Tenant"
SET "complimentaryReason" = 'INVITE_CODE'
WHERE "complimentaryUntil" IS NOT NULL;

-- Starter used to be what every new practice got without paying, and no
-- practice has paid for anything (D9). Each keeps its plan free for 90 days;
-- the expiry cron then moves it to FREE and the reminders go out from the
-- cron (a migration can't send email). A plan now needs a subscription or a
-- complimentary period, so Pro/Clinic practices an admin set by hand get the
-- same 90 days rather than silently counting as FREE. Data only: no tenant
-- IDs, so it runs the same on fresh, local, CI and production databases.
UPDATE "Tenant"
SET "complimentaryUntil" = NOW() + INTERVAL '90 days',
    "complimentaryReason" = 'MIGRATION'
WHERE "subscriptionTier" IN ('STARTER', 'PRO', 'CLINIC')
  AND ("subscriptionStatus" IS NULL OR "subscriptionStatus" <> 'active')
  AND "complimentaryUntil" IS NULL
  AND "complimentaryReason" IS NULL;
