-- CreateTable
CREATE TABLE "TenantSlugHistory" (
    "slug" VARCHAR(50) NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantSlugHistory_pkey" PRIMARY KEY ("slug")
);

-- CreateIndex
CREATE INDEX "TenantSlugHistory_tenantId_idx" ON "TenantSlugHistory"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantSlugHistory" ADD CONSTRAINT "TenantSlugHistory_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
