-- Assessments: standard instruments stored as rule-based definitions, which
-- practices switch on, send to clients and read scored results from; kept
-- apart from forms. Also general requests from practices to the platform.
-- Additive only. Built-in instruments are inserted by the API on start.

-- CreateTable
CREATE TABLE "AssessmentInstrument" (
    "key" VARCHAR(40) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    "builtIn" BOOLEAN NOT NULL DEFAULT false,
    "definition" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentInstrument_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "TenantAssessment" (
    "tenantId" BIGINT NOT NULL,
    "instrumentKey" VARCHAR(40) NOT NULL,
    "enabledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TenantAssessment_pkey" PRIMARY KEY ("tenantId","instrumentKey")
);

-- CreateTable
CREATE TABLE "AssessmentAssignment" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "instrumentKey" VARCHAR(40) NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "sentByProfileId" BIGINT,
    "bookingId" BIGINT,
    "tokenHash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'SENT',
    "message" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssessmentResponse" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "assignmentId" BIGINT,
    "instrumentKey" VARCHAR(40) NOT NULL,
    "instrumentVersion" INTEGER NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "answers" JSONB NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "severityLabel" TEXT NOT NULL,
    "severityLevel" INTEGER NOT NULL,
    "result" JSONB NOT NULL,
    "hasFlags" BOOLEAN NOT NULL DEFAULT false,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformRequest" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "requestedByProfileId" BIGINT,
    "type" VARCHAR(20) NOT NULL,
    "subject" VARCHAR(160) NOT NULL,
    "details" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "adminNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentAssignment_tokenHash_key" ON "AssessmentAssignment"("tokenHash");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_tenantId_clientProfileId_idx" ON "AssessmentAssignment"("tenantId", "clientProfileId");

-- CreateIndex
CREATE INDEX "AssessmentAssignment_tenantId_status_idx" ON "AssessmentAssignment"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AssessmentResponse_assignmentId_key" ON "AssessmentResponse"("assignmentId");

-- CreateIndex
CREATE INDEX "AssessmentResponse_tenantId_clientProfileId_instrumentKey_idx" ON "AssessmentResponse"("tenantId", "clientProfileId", "instrumentKey");

-- CreateIndex
CREATE INDEX "PlatformRequest_status_idx" ON "PlatformRequest"("status");

-- CreateIndex
CREATE INDEX "PlatformRequest_tenantId_idx" ON "PlatformRequest"("tenantId");

-- AddForeignKey
ALTER TABLE "TenantAssessment" ADD CONSTRAINT "TenantAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantAssessment" ADD CONSTRAINT "TenantAssessment_instrumentKey_fkey" FOREIGN KEY ("instrumentKey") REFERENCES "AssessmentInstrument"("key") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssessmentResponse" ADD CONSTRAINT "AssessmentResponse_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlatformRequest" ADD CONSTRAINT "PlatformRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

