-- Invite codes: platform-issued codes that give a practice a plan for free for a
-- set time (e.g. Pro for 90 days for early testers). Additive only.

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "complimentaryUntil" TIMESTAMP(3),
ADD COLUMN     "inviteCodeId" BIGINT;

-- CreateTable
CREATE TABLE "InviteCode" (
    "id" BIGSERIAL NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "tier" VARCHAR(20) NOT NULL,
    "durationDays" INTEGER NOT NULL DEFAULT 90,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "redeemBy" TIMESTAMP(3),
    "note" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InviteCode_code_key" ON "InviteCode"("code");

-- CreateIndex
CREATE INDEX "Tenant_complimentaryUntil_idx" ON "Tenant"("complimentaryUntil");

-- AddForeignKey
ALTER TABLE "Tenant" ADD CONSTRAINT "Tenant_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

