-- v2 Phase 1: therapist profiles (spec §6.1, §6.2).
--
-- PractitionerProfile is global, not tenant-scoped: it belongs to a person,
-- who may practise at several practices (PractitionerPlace). Places are in
-- this first migration on purpose: adding them after launch would need a
-- data migration (§6.1).

-- CreateEnum
CREATE TYPE "OnboardingIntent" AS ENUM ('PROFILE', 'PRACTICE');

-- CreateEnum
CREATE TYPE "PracticeHomePage" AS ENUM ('PROFILE', 'PRACTICE');

-- CreateEnum
CREATE TYPE "PractitionerProfileStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'HIDDEN', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "PractitionerKind" AS ENUM ('COUNSELLOR', 'PSYCHOTHERAPIST', 'PSYCHOLOGIST', 'PSYCHIATRIST', 'SOCIAL_WORKER', 'TRAINEE');

-- CreateEnum
CREATE TYPE "TaxonomyKind" AS ENUM ('SPECIALTY', 'MODALITY', 'POPULATION', 'LANGUAGE');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('NONE', 'DESK', 'EXTERNAL');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "homePage" "PracticeHomePage",
ADD COLUMN     "onboardingIntent" "OnboardingIntent" NOT NULL DEFAULT 'PRACTICE';

-- AlterTable
ALTER TABLE "ConsultTherapistProfile" ADD COLUMN     "allowProfileBooking" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "PractitionerProfile" (
    "id" BIGSERIAL NOT NULL,
    "userId" BIGINT NOT NULL,
    "handle" VARCHAR(30) NOT NULL,
    "status" "PractitionerProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "kind" "PractitionerKind" NOT NULL,
    "templateKey" TEXT,
    "themeKey" TEXT NOT NULL DEFAULT 'calm',
    "displayName" TEXT NOT NULL,
    "pronouns" TEXT,
    "photoKey" TEXT,
    "previewImageKey" TEXT,
    "headline" VARCHAR(120),
    "about" VARCHAR(2000),
    "approach" VARCHAR(1500),
    "introVideoKey" TEXT,
    "credentialsText" TEXT,
    "city" TEXT,
    "countryCode" CHAR(2) NOT NULL DEFAULT 'NG',
    "offersOnline" BOOLEAN NOT NULL DEFAULT true,
    "offersInPerson" BOOLEAN NOT NULL DEFAULT false,
    "acceptingClients" BOOLEAN NOT NULL DEFAULT true,
    "faithIntegration" TEXT,
    "supervisedBy" TEXT,
    "showPlatformExperience" BOOLEAN NOT NULL DEFAULT false,
    "selfReportedYears" INTEGER,
    "selfReportedClientsBucket" TEXT,
    "feeRangeText" TEXT,
    "bookingMode" "BookingMode" NOT NULL DEFAULT 'NONE',
    "externalBookingUrl" TEXT,
    "contactEmailPublic" TEXT,
    "socialLinks" JSONB,
    "completenessScore" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" TIMESTAMP(3),
    "lastActiveAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PractitionerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxonomyTerm" (
    "id" BIGSERIAL NOT NULL,
    "kind" "TaxonomyKind" NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TaxonomyTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PractitionerTaxonomy" (
    "profileId" BIGINT NOT NULL,
    "termId" BIGINT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PractitionerTaxonomy_pkey" PRIMARY KEY ("profileId","termId")
);

-- CreateTable
CREATE TABLE "PractitionerTimelineEntry" (
    "id" BIGSERIAL NOT NULL,
    "profileId" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "organisation" TEXT,
    "startYear" INTEGER,
    "endYear" INTEGER,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PractitionerTimelineEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PractitionerHandleHistory" (
    "handle" VARCHAR(30) NOT NULL,
    "profileId" BIGINT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PractitionerHandleHistory_pkey" PRIMARY KEY ("handle")
);

-- CreateTable
CREATE TABLE "PractitionerPlace" (
    "id" BIGSERIAL NOT NULL,
    "profileId" BIGINT NOT NULL,
    "tenantId" BIGINT NOT NULL,
    "therapistProfileId" BIGINT NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PractitionerPlace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProfileTemplate" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "kind" "PractitionerKind",
    "sections" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProfileTemplate_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PractitionerProfile_userId_key" ON "PractitionerProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PractitionerProfile_handle_key" ON "PractitionerProfile"("handle");

-- CreateIndex
CREATE INDEX "PractitionerProfile_status_countryCode_idx" ON "PractitionerProfile"("status", "countryCode");

-- CreateIndex
CREATE UNIQUE INDEX "TaxonomyTerm_kind_key_key" ON "TaxonomyTerm"("kind", "key");

-- CreateIndex
CREATE INDEX "PractitionerTaxonomy_termId_idx" ON "PractitionerTaxonomy"("termId");

-- CreateIndex
CREATE INDEX "PractitionerTimelineEntry_profileId_idx" ON "PractitionerTimelineEntry"("profileId");

-- CreateIndex
CREATE INDEX "PractitionerHandleHistory_profileId_idx" ON "PractitionerHandleHistory"("profileId");

-- CreateIndex
CREATE INDEX "PractitionerPlace_tenantId_idx" ON "PractitionerPlace"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "PractitionerPlace_profileId_therapistProfileId_key" ON "PractitionerPlace"("profileId", "therapistProfileId");

-- AddForeignKey
ALTER TABLE "PractitionerProfile" ADD CONSTRAINT "PractitionerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerTaxonomy" ADD CONSTRAINT "PractitionerTaxonomy_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PractitionerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerTaxonomy" ADD CONSTRAINT "PractitionerTaxonomy_termId_fkey" FOREIGN KEY ("termId") REFERENCES "TaxonomyTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerTimelineEntry" ADD CONSTRAINT "PractitionerTimelineEntry_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PractitionerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerHandleHistory" ADD CONSTRAINT "PractitionerHandleHistory_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PractitionerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerPlace" ADD CONSTRAINT "PractitionerPlace_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "PractitionerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerPlace" ADD CONSTRAINT "PractitionerPlace_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PractitionerPlace" ADD CONSTRAINT "PractitionerPlace_therapistProfileId_fkey" FOREIGN KEY ("therapistProfileId") REFERENCES "ConsultTherapistProfile"("profileId") ON DELETE CASCADE ON UPDATE CASCADE;

-- §6.2 handle rules, enforced by the database as well as the API
-- (apps/api/src/modules/practitioner-profile/handles.ts): lowercase, 3–30
-- characters, [a-z0-9-], no leading or trailing hyphen.
ALTER TABLE "PractitionerProfile" ADD CONSTRAINT "PractitionerProfile_handle_format"
  CHECK ("handle" ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');
ALTER TABLE "PractitionerHandleHistory" ADD CONSTRAINT "PractitionerHandleHistory_handle_format"
  CHECK ("handle" ~ '^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$');

-- At most one main place per profile (§6.1). "Exactly one when any exist" is
-- kept by the API, which promotes the next place when the main one goes.
CREATE UNIQUE INDEX "PractitionerPlace_one_main_per_profile" ON "PractitionerPlace"("profileId") WHERE "isMain";

-- Taxonomy starter list (§6.1), for Olalekan to review and edit in admin.
-- Population terms on sensitive identities are deliberately not here: they go
-- in only with Olalekan's approval. ON CONFLICT keeps edits made in admin.
INSERT INTO "TaxonomyTerm" ("kind", "key", "label", "sortOrder") VALUES
  ('SPECIALTY', 'anxiety', 'Anxiety', 10),
  ('SPECIALTY', 'depression', 'Depression', 20),
  ('SPECIALTY', 'trauma', 'Trauma & PTSD', 30),
  ('SPECIALTY', 'grief', 'Grief & loss', 40),
  ('SPECIALTY', 'relationships', 'Relationships', 50),
  ('SPECIALTY', 'marriage', 'Marriage', 60),
  ('SPECIALTY', 'family-conflict', 'Family conflict', 70),
  ('SPECIALTY', 'parenting', 'Parenting', 80),
  ('SPECIALTY', 'stress', 'Stress', 90),
  ('SPECIALTY', 'burnout', 'Burnout', 100),
  ('SPECIALTY', 'work-career', 'Work & career', 110),
  ('SPECIALTY', 'self-esteem', 'Self-esteem', 120),
  ('SPECIALTY', 'anger', 'Anger', 130),
  ('SPECIALTY', 'addiction', 'Addiction & substance use', 140),
  ('SPECIALTY', 'alcohol', 'Alcohol use', 150),
  ('SPECIALTY', 'eating', 'Eating & body image', 160),
  ('SPECIALTY', 'sleep', 'Sleep', 170),
  ('SPECIALTY', 'ocd', 'OCD', 180),
  ('SPECIALTY', 'bipolar', 'Bipolar disorder', 190),
  ('SPECIALTY', 'adhd', 'ADHD', 200),
  ('SPECIALTY', 'autism', 'Autism', 210),
  ('SPECIALTY', 'personality', 'Personality disorders', 220),
  ('SPECIALTY', 'psychosis', 'Psychosis', 230),
  ('SPECIALTY', 'suicidal-thoughts', 'Suicidal thoughts', 240),
  ('SPECIALTY', 'self-harm', 'Self-harm', 250),
  ('SPECIALTY', 'life-transitions', 'Life transitions', 260),
  ('SPECIALTY', 'loneliness', 'Loneliness', 270),
  ('SPECIALTY', 'infertility', 'Infertility', 280),
  ('SPECIALTY', 'perinatal', 'Pregnancy & postpartum', 290),
  ('SPECIALTY', 'chronic-illness', 'Chronic illness', 300),
  ('SPECIALTY', 'chronic-pain', 'Chronic pain', 310),
  ('SPECIALTY', 'sexual-concerns', 'Sexual concerns', 320),
  ('SPECIALTY', 'domestic-abuse', 'Domestic abuse', 330),
  ('SPECIALTY', 'sexual-assault', 'Sexual assault', 340),
  ('SPECIALTY', 'bullying', 'Bullying', 350),
  ('SPECIALTY', 'academic-stress', 'Academic stress', 360),
  ('SPECIALTY', 'faith-spirituality', 'Faith & spirituality', 370),
  ('SPECIALTY', 'migration', 'Migration & relocation', 380),
  ('SPECIALTY', 'financial-stress', 'Financial stress', 390),
  ('SPECIALTY', 'phobias', 'Phobias', 400),
  ('SPECIALTY', 'panic', 'Panic attacks', 410),
  ('SPECIALTY', 'divorce-separation', 'Divorce & separation', 420),
  ('MODALITY', 'cbt', 'Cognitive behavioural therapy (CBT)', 10),
  ('MODALITY', 'dbt', 'Dialectical behaviour therapy (DBT)', 20),
  ('MODALITY', 'act', 'Acceptance and commitment therapy (ACT)', 30),
  ('MODALITY', 'emdr', 'EMDR', 40),
  ('MODALITY', 'psychodynamic', 'Psychodynamic', 50),
  ('MODALITY', 'person-centred', 'Person-centred', 60),
  ('MODALITY', 'solution-focused', 'Solution-focused', 70),
  ('MODALITY', 'narrative', 'Narrative therapy', 80),
  ('MODALITY', 'family-systems', 'Family systems', 90),
  ('MODALITY', 'gottman', 'Gottman method', 100),
  ('MODALITY', 'eft', 'Emotionally focused therapy (EFT)', 110),
  ('MODALITY', 'mindfulness', 'Mindfulness-based', 120),
  ('MODALITY', 'motivational-interviewing', 'Motivational interviewing', 130),
  ('MODALITY', 'schema', 'Schema therapy', 140),
  ('MODALITY', 'tf-cbt', 'Trauma-focused CBT', 150),
  ('MODALITY', 'play-therapy', 'Play therapy', 160),
  ('MODALITY', 'art-therapy', 'Art therapy', 170),
  ('MODALITY', 'integrative', 'Integrative', 180),
  ('POPULATION', 'children', 'Children', 10),
  ('POPULATION', 'adolescents', 'Teenagers', 20),
  ('POPULATION', 'young-adults', 'Young adults', 30),
  ('POPULATION', 'adults', 'Adults', 40),
  ('POPULATION', 'older-adults', 'Older adults', 50),
  ('POPULATION', 'couples', 'Couples', 60),
  ('POPULATION', 'families', 'Families', 70),
  ('POPULATION', 'groups', 'Groups', 80),
  ('POPULATION', 'students', 'Students', 90),
  ('POPULATION', 'professionals', 'Professionals', 100),
  ('POPULATION', 'parents', 'Parents', 110),
  ('POPULATION', 'healthcare-workers', 'Healthcare workers', 120),
  ('LANGUAGE', 'english', 'English', 10),
  ('LANGUAGE', 'yoruba', 'Yoruba', 20),
  ('LANGUAGE', 'igbo', 'Igbo', 30),
  ('LANGUAGE', 'hausa', 'Hausa', 40),
  ('LANGUAGE', 'pidgin', 'Nigerian Pidgin', 50),
  ('LANGUAGE', 'french', 'French', 60),
  ('LANGUAGE', 'twi', 'Twi', 70),
  ('LANGUAGE', 'swahili', 'Swahili', 80)
ON CONFLICT ("kind", "key") DO NOTHING;
