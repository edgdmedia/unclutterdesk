-- Account closure fields.
-- Both nullable with no default, so this is additive: it rewrites no rows and
-- takes no long lock on an existing Tenant table.
ALTER TABLE "Tenant" ADD COLUMN "closureRequestedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN "closureRequestedBy" BIGINT;
