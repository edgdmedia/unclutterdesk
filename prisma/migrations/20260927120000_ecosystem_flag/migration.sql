-- Ecosystem integration flag: links a practice to the Unclutter Suite.
-- Additive only; off for every existing practice.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "ecosystemIntegrationEnabled" BOOLEAN NOT NULL DEFAULT false;
