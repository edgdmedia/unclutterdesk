-- Time off: therapist holidays and days away. Additive only.

-- CreateTable
CREATE TABLE "TimeOff" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimeOff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimeOff_tenantId_profileId_startsOn_endsOn_idx" ON "TimeOff"("tenantId", "profileId", "startsOn", "endsOn");

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimeOff" ADD CONSTRAINT "TimeOff_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ConsultTherapistProfile"("profileId") ON DELETE CASCADE ON UPDATE CASCADE;