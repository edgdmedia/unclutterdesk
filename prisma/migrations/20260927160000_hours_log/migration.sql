-- Hours log: practitioners' clinical hours and their targets. Additive only.

-- CreateTable
CREATE TABLE "PractitionerHoursEntry" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "practitionerProfileId" BIGINT NOT NULL,
    "bookingId" BIGINT,
    "clientProfileId" BIGINT,
    "date" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'DIRECT_CLIENT',
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "notes" TEXT,
    "supervisorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PractitionerHoursEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PractitionerHoursTarget" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "practitionerProfileId" BIGINT NOT NULL,
    "label" TEXT,
    "totalTargetHours" INTEGER,
    "supervisionTargetHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PractitionerHoursTarget_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PractitionerHoursEntry_bookingId_key" ON "PractitionerHoursEntry"("bookingId");

-- CreateIndex
CREATE INDEX "PractitionerHoursEntry_tenantId_practitionerProfileId_date_idx" ON "PractitionerHoursEntry"("tenantId", "practitionerProfileId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "PractitionerHoursTarget_tenantId_practitionerProfileId_key" ON "PractitionerHoursTarget"("tenantId", "practitionerProfileId");

-- AddForeignKey
ALTER TABLE "PractitionerHoursEntry" ADD CONSTRAINT "PractitionerHoursEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerHoursTarget" ADD CONSTRAINT "PractitionerHoursTarget_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

