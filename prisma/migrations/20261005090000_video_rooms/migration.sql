-- AlterTable
ALTER TABLE "ConsultTherapistProfile" ALTER COLUMN "videoProvider" SET DEFAULT 'BUILT_IN';

-- AlterTable
ALTER TABLE "ConsultBooking" ADD COLUMN     "videoProvider" VARCHAR(20);

-- CreateTable
CREATE TABLE "VideoParticipant" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "bookingId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "provider" VARCHAR(20) NOT NULL,
    "role" VARCHAR(20) NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "VideoParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VideoParticipant_tenantId_joinedAt_idx" ON "VideoParticipant"("tenantId", "joinedAt");

-- CreateIndex
CREATE INDEX "VideoParticipant_provider_joinedAt_idx" ON "VideoParticipant"("provider", "joinedAt");

-- CreateIndex
CREATE INDEX "VideoParticipant_bookingId_idx" ON "VideoParticipant"("bookingId");


-- Everyone who wasn't on Google Meet moves to the built-in room.
UPDATE "ConsultTherapistProfile" SET "videoProvider" = 'BUILT_IN' WHERE "videoProvider" IS NULL OR "videoProvider" <> 'GOOGLE_MEET';

-- Old meet.jit.si names on future bookings are dropped; rooms are made on first join now.
UPDATE "ConsultBooking" b SET "videoRoomName" = NULL
  FROM "ConsultAvailability" a
  WHERE b."availabilityId" = a."id" AND a."startsAt" > (now() at time zone 'utc') AND b."videoRoomName" NOT LIKE 'http%';
