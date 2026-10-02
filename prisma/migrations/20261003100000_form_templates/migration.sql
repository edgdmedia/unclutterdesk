-- AlterTable
ALTER TABLE "PlatformRequest" ADD COLUMN     "formTemplateId" BIGINT;

-- CreateTable
CREATE TABLE "FormTemplate" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "sourceFormId" BIGINT,
    "createdByProfileId" BIGINT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetType" TEXT NOT NULL DEFAULT 'INTAKE',
    "schemaJson" JSONB NOT NULL,
    "shareStatus" VARCHAR(20) NOT NULL DEFAULT 'PRIVATE',
    "anonymous" BOOLEAN NOT NULL DEFAULT false,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FormTemplate_tenantId_idx" ON "FormTemplate"("tenantId");

-- CreateIndex
CREATE INDEX "FormTemplate_shareStatus_idx" ON "FormTemplate"("shareStatus");

-- AddForeignKey
ALTER TABLE "FormTemplate" ADD CONSTRAINT "FormTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

