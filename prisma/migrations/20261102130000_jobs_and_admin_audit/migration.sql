-- v2 Phase 1 shared infrastructure (spec §4.4): a generic background job
-- table, run on the existing 5-minute schedule, and the admin audit log.

-- CreateTable
CREATE TABLE "BackgroundJob" (
    "id" BIGSERIAL NOT NULL,
    "type" VARCHAR(60) NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dedupeKey" VARCHAR(200),
    "lockedUntil" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminAuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorUserId" BIGINT NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "targetType" VARCHAR(60) NOT NULL,
    "targetId" VARCHAR(80) NOT NULL,
    "reason" TEXT,
    "metaJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BackgroundJob_completedAt_failedAt_runAfter_idx" ON "BackgroundJob"("completedAt", "failedAt", "runAfter");

-- CreateIndex
CREATE INDEX "BackgroundJob_dedupeKey_idx" ON "BackgroundJob"("dedupeKey");

-- CreateIndex
CREATE INDEX "AdminAuditLog_targetType_targetId_idx" ON "AdminAuditLog"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "AdminAuditLog_actorUserId_createdAt_idx" ON "AdminAuditLog"("actorUserId", "createdAt");


-- One pending job per dedupe key. A finished or failed job doesn't block a
-- new one with the same key.
CREATE UNIQUE INDEX "BackgroundJob_one_pending_per_key" ON "BackgroundJob"("dedupeKey")
  WHERE "completedAt" IS NULL AND "failedAt" IS NULL AND "dedupeKey" IS NOT NULL;
