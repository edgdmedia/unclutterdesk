-- A client's Unclutter Journal, linked by her; the practitioner's plan for a session; entries she shares.
-- AlterTable
ALTER TABLE "ConsultBooking" ADD COLUMN     "journalPlan" JSONB,
ADD COLUMN     "journalPlanAddedAt" TIMESTAMP(3),
ADD COLUMN     "journalDeliveryTime" TEXT;

-- CreateTable
CREATE TABLE "JournalLink" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "suiteLinkId" TEXT NOT NULL,
    "profileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "JournalLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLinkRequest" (
    "nonce" TEXT NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "bookingId" BIGINT NOT NULL,
    "deliveryTimeLocal" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLinkRequest_pkey" PRIMARY KEY ("nonce")
);

-- CreateTable
CREATE TABLE "JournalSharedEntry" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "bookingId" BIGINT,
    "suiteEntryId" TEXT NOT NULL,
    "promptText" TEXT,
    "content" TEXT,
    "writtenAt" TIMESTAMP(3) NOT NULL,
    "entryUpdatedAt" TIMESTAMP(3) NOT NULL,
    "sharedAt" TIMESTAMP(3) NOT NULL,
    "withdrawnAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalSharedEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JournalLink_suiteLinkId_key" ON "JournalLink"("suiteLinkId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalLink_tenantId_clientProfileId_key" ON "JournalLink"("tenantId", "clientProfileId");

-- CreateIndex
CREATE INDEX "JournalLinkRequest_tenantId_clientProfileId_idx" ON "JournalLinkRequest"("tenantId", "clientProfileId");

-- CreateIndex
CREATE INDEX "JournalSharedEntry_tenantId_clientProfileId_idx" ON "JournalSharedEntry"("tenantId", "clientProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalSharedEntry_tenantId_suiteEntryId_key" ON "JournalSharedEntry"("tenantId", "suiteEntryId");

-- AddForeignKey
ALTER TABLE "JournalLink" ADD CONSTRAINT "JournalLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLinkRequest" ADD CONSTRAINT "JournalLinkRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalSharedEntry" ADD CONSTRAINT "JournalSharedEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

