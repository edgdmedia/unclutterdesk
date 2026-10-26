-- v2 Phase 0: a FREE plan below Starter, and Starter only for practices that pay.

ALTER TABLE "Tenant" ALTER COLUMN "subscriptionTier" SET DEFAULT 'FREE';
ALTER TABLE "Tenant" ADD COLUMN "subscriptionPastDueAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "downgradeBlockedAt" TIMESTAMP(3);

-- Starter used to be the default every new practice got without paying. No
-- practice has paid for it (decision D9), so every Starter practice without an
-- active subscription or an invite-code period becomes FREE.
UPDATE "Tenant"
SET "subscriptionTier" = 'FREE'
WHERE "subscriptionTier" = 'STARTER'
  AND ("subscriptionStatus" IS NULL OR "subscriptionStatus" <> 'active')
  AND "complimentaryUntil" IS NULL;
