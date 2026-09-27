-- A practice's own email domain, verified through Resend. Additive only.

-- CreateTable
CREATE TABLE "TenantSendingDomain" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "domain" TEXT NOT NULL,
    "resendDomainId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NOT_STARTED',
    "records" JSONB NOT NULL DEFAULT '[]',
    "fromLocalPart" TEXT NOT NULL DEFAULT 'notifications',
    "verifiedAt" TIMESTAMP(3),
    "lastCheckedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantSendingDomain_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TenantSendingDomain_tenantId_key" ON "TenantSendingDomain"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSendingDomain_domain_key" ON "TenantSendingDomain"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "TenantSendingDomain_resendDomainId_key" ON "TenantSendingDomain"("resendDomainId");

-- AddForeignKey
ALTER TABLE "TenantSendingDomain" ADD CONSTRAINT "TenantSendingDomain_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

