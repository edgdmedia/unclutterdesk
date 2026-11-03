-- Profile reports (spec §6.15): a queue of its own, not PlatformRequest, which
-- needs a practice; a report about a therapist must never sit in their own
-- practice's records. profileId goes null if the profile is deleted.

-- CreateEnum
CREATE TYPE "ProfileReportType" AS ENUM ('IMPERSONATION', 'MISLEADING', 'UNSAFE', 'OTHER', 'REMOVAL_REQUEST');

-- CreateEnum
CREATE TYPE "ProfileReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ProfileReport" (
    "id" BIGSERIAL NOT NULL,
    "profileId" BIGINT,
    "handle" VARCHAR(30) NOT NULL,
    "type" "ProfileReportType" NOT NULL,
    "details" TEXT,
    "reporterName" VARCHAR(120),
    "reporterEmail" VARCHAR(254),
    "relationship" VARCHAR(40),
    "status" "ProfileReportStatus" NOT NULL DEFAULT 'OPEN',
    "reviewerUserId" BIGINT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "ProfileReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProfileReport_status_createdAt_idx" ON "ProfileReport"("status", "createdAt");

-- CreateIndex
CREATE INDEX "ProfileReport_profileId_idx" ON "ProfileReport"("profileId");

-- AddForeignKey
ALTER TABLE "ProfileReport" ADD CONSTRAINT "ProfileReport_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PractitionerProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

