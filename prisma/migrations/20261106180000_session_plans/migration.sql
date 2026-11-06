-- Session plans, first piece (6 Nov 2026, spec §11.2): a booked session can be
-- turned back into "not scheduled"; the client (or staff) chooses its time
-- later. The money stays on the booking it was paid on.
-- AlterTable
ALTER TABLE "ConsultBooking" ADD COLUMN     "unscheduledAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SessionPlan" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "providerProfileId" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    "createdByProfileId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionPlanLine" (
    "id" BIGSERIAL NOT NULL,
    "planId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "count" INTEGER NOT NULL,
    "unitPriceKobo" BIGINT,
    "discountPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionPlanLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanSession" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "planId" BIGINT NOT NULL,
    "lineId" BIGINT NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "providerProfileId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "format" VARCHAR(20) NOT NULL DEFAULT 'ONLINE',
    "locationId" BIGINT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PAID',
    "paymentMethod" VARCHAR(20) NOT NULL,
    "amountKobo" BIGINT NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "paidOnBookingId" BIGINT,
    "bookingId" BIGINT,
    "createdByProfileId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionPlan_tenantId_clientProfileId_providerProfileId_stat_idx" ON "SessionPlan"("tenantId", "clientProfileId", "providerProfileId", "status");

-- CreateIndex
CREATE INDEX "SessionPlanLine_planId_idx" ON "SessionPlanLine"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "PlanSession_bookingId_key" ON "PlanSession"("bookingId");

-- CreateIndex
CREATE INDEX "PlanSession_tenantId_clientProfileId_status_idx" ON "PlanSession"("tenantId", "clientProfileId", "status");

-- CreateIndex
CREATE INDEX "PlanSession_tenantId_providerProfileId_status_idx" ON "PlanSession"("tenantId", "providerProfileId", "status");

-- AddForeignKey
ALTER TABLE "SessionPlanLine" ADD CONSTRAINT "SessionPlanLine_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SessionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSession" ADD CONSTRAINT "PlanSession_planId_fkey" FOREIGN KEY ("planId") REFERENCES "SessionPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSession" ADD CONSTRAINT "PlanSession_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "SessionPlanLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanSession" ADD CONSTRAINT "PlanSession_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ConsultBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

