-- Move platform subscription billing from Stripe to Paystack.
-- Stripe does not support merchant signup from Nigeria, so the integration is
-- being removed rather than paused.
--
-- The dropped columns are unused: subscription tiers were changed directly in
-- the database and no Stripe customer or subscription was ever created, so
-- there is no billing state to migrate. Verify before applying:
--
--   SELECT count(*) FROM "Tenant"
--    WHERE "stripeCustomerId" IS NOT NULL OR "stripeSubscriptionId" IS NOT NULL;
--   SELECT count(*) FROM "BankSubaccount" WHERE "stripeAccountId" IS NOT NULL;
--
-- Both must return 0. If either does not, stop and migrate that state first —
-- these DROPs are irreversible.

ALTER TABLE "Tenant" DROP COLUMN "stripeCustomerId";
ALTER TABLE "Tenant" DROP COLUMN "stripeSubscriptionId";
ALTER TABLE "BankSubaccount" DROP COLUMN "stripeAccountId";

ALTER TABLE "Tenant" ADD COLUMN "paystackCustomerCode" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "paystackSubscriptionCode" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "paystackSubscriptionToken" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "subscriptionRenewsAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Tenant_paystackCustomerCode_key" ON "Tenant"("paystackCustomerCode");
CREATE UNIQUE INDEX "Tenant_paystackSubscriptionCode_key" ON "Tenant"("paystackSubscriptionCode");
