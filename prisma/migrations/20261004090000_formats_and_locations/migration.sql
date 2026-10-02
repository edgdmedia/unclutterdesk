-- AlterTable
ALTER TABLE "ConsultTherapistProfile" ADD COLUMN     "gapMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "offersInPerson" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "offersOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sessionLengthMinutes" INTEGER NOT NULL DEFAULT 50;

-- AlterTable
ALTER TABLE "ConsultAvailability" ADD COLUMN     "allowsInPerson" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "allowsOnline" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "customised" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "locationId" BIGINT;

-- AlterTable
ALTER TABLE "ConsultBooking" ADD COLUMN     "format" VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
ADD COLUMN     "locationId" BIGINT;

-- CreateTable
CREATE TABLE "ConsultServiceFormat" (
    "id" BIGSERIAL NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "format" VARCHAR(20) NOT NULL,
    "priceKobo" BIGINT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ConsultServiceFormat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PracticeLocation" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "address" VARCHAR(240) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "directions" VARCHAR(500),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeLocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TherapistLocation" (
    "profileId" BIGINT NOT NULL,
    "locationId" BIGINT NOT NULL,

    CONSTRAINT "TherapistLocation_pkey" PRIMARY KEY ("profileId","locationId")
);

-- CreateTable
CREATE TABLE "TherapistWeeklyTime" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "start" VARCHAR(5) NOT NULL,
    "allowsOnline" BOOLEAN NOT NULL DEFAULT true,
    "allowsInPerson" BOOLEAN NOT NULL DEFAULT false,
    "locationId" BIGINT,

    CONSTRAINT "TherapistWeeklyTime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsultServiceFormat_serviceId_format_key" ON "ConsultServiceFormat"("serviceId", "format");

-- CreateIndex
CREATE INDEX "PracticeLocation_tenantId_isActive_idx" ON "PracticeLocation"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "TherapistWeeklyTime_tenantId_profileId_idx" ON "TherapistWeeklyTime"("tenantId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "TherapistWeeklyTime_profileId_weekday_start_key" ON "TherapistWeeklyTime"("profileId", "weekday", "start");

-- AddForeignKey
ALTER TABLE "ConsultServiceFormat" ADD CONSTRAINT "ConsultServiceFormat_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ConsultService"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PracticeLocation" ADD CONSTRAINT "PracticeLocation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistLocation" ADD CONSTRAINT "TherapistLocation_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ConsultTherapistProfile"("profileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistLocation" ADD CONSTRAINT "TherapistLocation_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistWeeklyTime" ADD CONSTRAINT "TherapistWeeklyTime_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistWeeklyTime" ADD CONSTRAINT "TherapistWeeklyTime_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "ConsultTherapistProfile"("profileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TherapistWeeklyTime" ADD CONSTRAINT "TherapistWeeklyTime_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultAvailability" ADD CONSTRAINT "ConsultAvailability_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultBooking" ADD CONSTRAINT "ConsultBooking_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "PracticeLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

