CREATE TABLE "InviteSend" (
    "id" BIGSERIAL NOT NULL,
    "inviteCodeId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT,
    "delivered" BOOLEAN NOT NULL,
    "sentById" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InviteSend_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InviteSend_inviteCodeId_createdAt_idx" ON "InviteSend"("inviteCodeId", "createdAt");

ALTER TABLE "InviteSend" ADD CONSTRAINT "InviteSend_inviteCodeId_fkey" FOREIGN KEY ("inviteCodeId") REFERENCES "InviteCode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InviteSend" ADD CONSTRAINT "InviteSend_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
