-- CreateTable
CREATE TABLE "Tenant" (
    "id" BIGSERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(50) NOT NULL,
    "customDomain" VARCHAR(100),
    "customDomainStatus" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "primaryColor" VARCHAR(20) NOT NULL DEFAULT '#0F3A53',
    "secondaryColor" VARCHAR(20) NOT NULL DEFAULT '#E3B341',
    "currency" VARCHAR(10) NOT NULL DEFAULT 'NGN',
    "cancellationHours" INTEGER NOT NULL DEFAULT 24,
    "shortName" TEXT,
    "welcomeTitle" TEXT,
    "welcomeMessage" TEXT,
    "publicEmail" TEXT,
    "publicPhone" TEXT,
    "city" TEXT,
    "address" TEXT,
    "category" TEXT,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'STARTER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "notificationChannels" JSONB NOT NULL DEFAULT '{"in_app":true,"email":true,"push":true,"sms":false}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" BIGSERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "platformRole" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" TEXT NOT NULL,
    "userId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "userAgent" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Profile" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "userId" BIGINT,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'user',
    "role" TEXT NOT NULL DEFAULT 'CLIENT',
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'active',
    "firstName" TEXT,
    "lastName" TEXT,
    "phone" TEXT,
    "gender" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "avatarUrl" TEXT,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "emailVerifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultTherapistProfile" (
    "profileId" BIGINT NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "publicUsername" VARCHAR(50),
    "bookingEmail" TEXT,
    "notificationEmail" TEXT,
    "welcomeMessage" TEXT,
    "specialty" TEXT,
    "modalities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "credentials" TEXT,
    "yearsExperience" INTEGER,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "acceptsGeneralBooking" BOOLEAN NOT NULL DEFAULT true,
    "videoProvider" TEXT DEFAULT 'JITSI',
    "dailyApiKey" TEXT,
    "googleRefreshToken" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultTherapistProfile_pkey" PRIMARY KEY ("profileId")
);

-- CreateTable
CREATE TABLE "ConsultService" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "durationMinutes" INTEGER NOT NULL DEFAULT 50,
    "priceKobo" BIGINT NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ConsultService_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultAvailability" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "providerProfileId" BIGINT NOT NULL,
    "serviceId" BIGINT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'VIDEO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultAvailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultBooking" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "serviceId" BIGINT NOT NULL,
    "availabilityId" BIGINT NOT NULL,
    "clientProfileId" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "paymentRef" TEXT,
    "paidAt" TIMESTAMP(3),
    "notes" TEXT,
    "videoRoomName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ConsultBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountCode" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT,
    "discountType" TEXT NOT NULL DEFAULT 'PERCENT',
    "discountPercent" INTEGER,
    "discountAmountKobo" BIGINT,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DiscountCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultPendingInvite" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'THERAPIST',
    "claimToken" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsultPendingInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversalForm" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT,
    "systemKey" TEXT,
    "description" TEXT,
    "targetType" TEXT NOT NULL DEFAULT 'INTAKE',
    "schemaJson" JSONB NOT NULL,
    "reviewPublicationMode" TEXT NOT NULL DEFAULT 'MANUAL',
    "reviewerDisplayMode" TEXT NOT NULL DEFAULT 'FIRST_NAME',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UniversalForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UniversalFormSubmission" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "formId" BIGINT NOT NULL,
    "bookingId" BIGINT,
    "clientProfileId" BIGINT NOT NULL,
    "targetType" TEXT NOT NULL DEFAULT 'INTAKE',
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "answersJson" JSONB NOT NULL,
    "derivedJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "UniversalFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClinicalNote" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "bookingId" BIGINT,
    "clientProfileId" BIGINT NOT NULL,
    "authorProfileId" BIGINT NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "diagnosisCode" TEXT,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankSubaccount" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "bankCode" TEXT NOT NULL,
    "bankName" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "paystackCode" TEXT,
    "stripeAccountId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankSubaccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "actionLabel" TEXT,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDispatch" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "actionLabel" TEXT,
    "data" JSONB,
    "category" TEXT,
    "channels" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "triggerAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "dedupeKey" TEXT,
    "lastError" TEXT,
    "notificationId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDispatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "module" TEXT NOT NULL,
    "category" TEXT,
    "channel" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailLog" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "providerId" TEXT,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebPushSubscription" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "profileId" BIGINT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastError" TEXT,
    "lastSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_customDomain_key" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeCustomerId_key" ON "Tenant"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_stripeSubscriptionId_key" ON "Tenant"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "Tenant_slug_idx" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_customDomain_idx" ON "Tenant"("customDomain");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Token_tokenHash_key" ON "Token"("tokenHash");

-- CreateIndex
CREATE INDEX "Token_userId_type_idx" ON "Token"("userId", "type");

-- CreateIndex
CREATE INDEX "Token_type_expiresAt_idx" ON "Token"("type", "expiresAt");

-- CreateIndex
CREATE INDEX "Profile_tenantId_status_idx" ON "Profile"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_tenantId_email_key" ON "Profile"("tenantId", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Profile_tenantId_username_key" ON "Profile"("tenantId", "username");

-- CreateIndex
CREATE INDEX "ConsultTherapistProfile_tenantId_isPublic_idx" ON "ConsultTherapistProfile"("tenantId", "isPublic");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultTherapistProfile_tenantId_profileId_key" ON "ConsultTherapistProfile"("tenantId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultTherapistProfile_tenantId_publicUsername_key" ON "ConsultTherapistProfile"("tenantId", "publicUsername");

-- CreateIndex
CREATE INDEX "ConsultService_tenantId_isActive_idx" ON "ConsultService"("tenantId", "isActive");

-- CreateIndex
CREATE INDEX "ConsultAvailability_tenantId_providerProfileId_startsAt_isA_idx" ON "ConsultAvailability"("tenantId", "providerProfileId", "startsAt", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultBooking_paymentRef_key" ON "ConsultBooking"("paymentRef");

-- CreateIndex
CREATE INDEX "ConsultBooking_tenantId_clientProfileId_idx" ON "ConsultBooking"("tenantId", "clientProfileId");

-- CreateIndex
CREATE INDEX "ConsultBooking_tenantId_status_idx" ON "ConsultBooking"("tenantId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "DiscountCode_tenantId_code_key" ON "DiscountCode"("tenantId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultPendingInvite_claimToken_key" ON "ConsultPendingInvite"("claimToken");

-- CreateIndex
CREATE UNIQUE INDEX "ConsultPendingInvite_tenantId_email_key" ON "ConsultPendingInvite"("tenantId", "email");

-- CreateIndex
CREATE INDEX "UniversalForm_tenantId_targetType_idx" ON "UniversalForm"("tenantId", "targetType");

-- CreateIndex
CREATE INDEX "UniversalFormSubmission_tenantId_bookingId_idx" ON "UniversalFormSubmission"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "UniversalFormSubmission_tenantId_clientProfileId_idx" ON "UniversalFormSubmission"("tenantId", "clientProfileId");

-- CreateIndex
CREATE INDEX "ClinicalNote_tenantId_bookingId_idx" ON "ClinicalNote"("tenantId", "bookingId");

-- CreateIndex
CREATE INDEX "ClinicalNote_tenantId_clientProfileId_idx" ON "ClinicalNote"("tenantId", "clientProfileId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSubaccount_tenantId_key" ON "BankSubaccount"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BankSubaccount_stripeAccountId_key" ON "BankSubaccount"("stripeAccountId");

-- CreateIndex
CREATE INDEX "Notification_profileId_status_idx" ON "Notification"("profileId", "status");

-- CreateIndex
CREATE INDEX "Notification_profileId_createdAt_idx" ON "Notification"("profileId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_tenantId_createdAt_idx" ON "Notification"("tenantId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDispatch_notificationId_key" ON "NotificationDispatch"("notificationId");

-- CreateIndex
CREATE INDEX "NotificationDispatch_status_triggerAt_idx" ON "NotificationDispatch"("status", "triggerAt");

-- CreateIndex
CREATE INDEX "NotificationDispatch_tenantId_profileId_idx" ON "NotificationDispatch"("tenantId", "profileId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationDispatch_dedupeKey_key" ON "NotificationDispatch"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationPreference_profileId_idx" ON "NotificationPreference"("profileId");

-- CreateIndex
CREATE INDEX "NotificationPreference_tenantId_idx" ON "NotificationPreference"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_profileId_module_category_channel_key" ON "NotificationPreference"("profileId", "module", "category", "channel");

-- CreateIndex
CREATE INDEX "EmailLog_tenantId_createdAt_idx" ON "EmailLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "EmailLog_profileId_createdAt_idx" ON "EmailLog"("profileId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebPushSubscription_endpoint_key" ON "WebPushSubscription"("endpoint");

-- CreateIndex
CREATE INDEX "WebPushSubscription_profileId_idx" ON "WebPushSubscription"("profileId");

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Profile" ADD CONSTRAINT "Profile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultTherapistProfile" ADD CONSTRAINT "ConsultTherapistProfile_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultTherapistProfile" ADD CONSTRAINT "ConsultTherapistProfile_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultService" ADD CONSTRAINT "ConsultService_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultAvailability" ADD CONSTRAINT "ConsultAvailability_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultAvailability" ADD CONSTRAINT "ConsultAvailability_providerProfileId_fkey" FOREIGN KEY ("providerProfileId") REFERENCES "ConsultTherapistProfile"("profileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultAvailability" ADD CONSTRAINT "ConsultAvailability_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ConsultService"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultBooking" ADD CONSTRAINT "ConsultBooking_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultBooking" ADD CONSTRAINT "ConsultBooking_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "ConsultService"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultBooking" ADD CONSTRAINT "ConsultBooking_availabilityId_fkey" FOREIGN KEY ("availabilityId") REFERENCES "ConsultAvailability"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultBooking" ADD CONSTRAINT "ConsultBooking_clientProfileId_fkey" FOREIGN KEY ("clientProfileId") REFERENCES "Profile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountCode" ADD CONSTRAINT "DiscountCode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultPendingInvite" ADD CONSTRAINT "ConsultPendingInvite_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversalForm" ADD CONSTRAINT "UniversalForm_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversalFormSubmission" ADD CONSTRAINT "UniversalFormSubmission_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversalFormSubmission" ADD CONSTRAINT "UniversalFormSubmission_formId_fkey" FOREIGN KEY ("formId") REFERENCES "UniversalForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UniversalFormSubmission" ADD CONSTRAINT "UniversalFormSubmission_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ConsultBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "ConsultBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankSubaccount" ADD CONSTRAINT "BankSubaccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDispatch" ADD CONSTRAINT "NotificationDispatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDispatch" ADD CONSTRAINT "NotificationDispatch_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationDispatch" ADD CONSTRAINT "NotificationDispatch_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailLog" ADD CONSTRAINT "EmailLog_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebPushSubscription" ADD CONSTRAINT "WebPushSubscription_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "Profile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

