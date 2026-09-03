-- Create the persistent synthetic workspace used for product demonstrations.
-- This migration intentionally does not contain a usable password. Provision it
-- with scripts/provision-demo-account.mjs using a server-side DEMO_PASSWORD.

ALTER TABLE "Tenant" ADD COLUMN "isDemo" BOOLEAN NOT NULL DEFAULT false;

DO $$
DECLARE
  demo_tenant_id BIGINT;
  demo_user_id BIGINT;
  demo_profile_id BIGINT;
  demo_client_id BIGINT;
  demo_service_id BIGINT;
  demo_availability_id BIGINT;
  demo_booking_id BIGINT;
  demo_form_id BIGINT;
BEGIN
  INSERT INTO "Tenant" (
    "name", "shortName", "slug", "isDemo", "primaryColor", "secondaryColor",
    "welcomeTitle", "welcomeMessage", "publicEmail", "city", "category",
    "subscriptionTier", "isActive", "createdAt", "updatedAt"
  ) VALUES (
    'Unclutter Desk Demo Practice', 'Demo Practice', 'demo', true, '#0F3A53', '#E3B341',
    'Unclutter Desk Demo', 'Synthetic workspace for demonstrating Unclutter Desk features.',
    'demo@unclutterdesk.com', 'Lagos', 'Demonstration', 'PRO', true, NOW(), NOW()
  )
  ON CONFLICT ("slug") DO UPDATE SET "isDemo" = true, "isActive" = true
  RETURNING "id" INTO demo_tenant_id;

  IF demo_tenant_id IS NULL THEN
    SELECT "id" INTO demo_tenant_id FROM "Tenant" WHERE "slug" = 'demo';
  END IF;

  INSERT INTO "User" ("email", "username", "password", "createdAt", "updatedAt")
  VALUES ('demo.owner@unclutterdesk.com', 'demo-owner', '__DEMO_PASSWORD_NOT_PROVISIONED__', NOW(), NOW())
  ON CONFLICT ("email") DO UPDATE SET "username" = 'demo-owner'
  RETURNING "id" INTO demo_user_id;

  IF demo_user_id IS NULL THEN
    SELECT "id" INTO demo_user_id FROM "User" WHERE "email" = 'demo.owner@unclutterdesk.com';
  END IF;

  INSERT INTO "Profile" (
    "tenantId", "userId", "username", "email", "type", "role", "firstName",
    "lastName", "status", "emailVerified", "emailVerifiedAt", "createdAt", "updatedAt"
  ) VALUES (
    demo_tenant_id, demo_user_id, 'demo-owner', 'demo.owner@unclutterdesk.com',
    'therapist', 'OWNER', 'Demo', 'Owner', 'active', true, NOW(), NOW(), NOW()
  )
  ON CONFLICT ("tenantId", "email") DO UPDATE SET
    "userId" = demo_user_id, "role" = 'OWNER', "status" = 'active', "emailVerified" = true
  RETURNING "id" INTO demo_profile_id;

  IF demo_profile_id IS NULL THEN
    SELECT "id" INTO demo_profile_id FROM "Profile"
    WHERE "tenantId" = demo_tenant_id AND "email" = 'demo.owner@unclutterdesk.com';
  END IF;

  INSERT INTO "ConsultTherapistProfile" (
    "profileId", "tenantId", "publicUsername", "bookingEmail", "notificationEmail",
    "welcomeMessage", "specialty", "credentials", "yearsExperience", "isPublic",
    "acceptsGeneralBooking", "isVerified", "createdAt", "updatedAt"
  ) VALUES (
    demo_profile_id, demo_tenant_id, 'demo-therapist', 'demo.owner@unclutterdesk.com',
    'demo@unclutterdesk.com', 'A safe synthetic practice for product demonstrations.',
    'Clinical Psychology', 'Demonstration profile', 8, true, true, true, NOW(), NOW()
  )
  ON CONFLICT ("profileId") DO NOTHING;

  INSERT INTO "Profile" (
    "tenantId", "username", "email", "type", "role", "firstName", "lastName", "status", "createdAt", "updatedAt"
  ) VALUES (
    demo_tenant_id, 'demo-client', 'demo.client@example.invalid', 'user', 'CLIENT',
    'Demo', 'Client', 'active', NOW(), NOW()
  )
  ON CONFLICT ("tenantId", "email") DO UPDATE SET "status" = 'active'
  RETURNING "id" INTO demo_client_id;

  IF demo_client_id IS NULL THEN
    SELECT "id" INTO demo_client_id FROM "Profile"
    WHERE "tenantId" = demo_tenant_id AND "email" = 'demo.client@example.invalid';
  END IF;

  SELECT "id" INTO demo_service_id FROM "ConsultService"
  WHERE "tenantId" = demo_tenant_id AND "title" = 'Demonstration Therapy Session'
  LIMIT 1;
  IF demo_service_id IS NULL THEN
    INSERT INTO "ConsultService" (
      "tenantId", "title", "description", "durationMinutes", "priceKobo", "isActive", "createdAt"
    ) VALUES (
      demo_tenant_id, 'Demonstration Therapy Session', 'Synthetic service for demos.',
      50, 3500000, true, NOW()
    ) RETURNING "id" INTO demo_service_id;
  END IF;

  SELECT "id" INTO demo_availability_id FROM "ConsultAvailability"
  WHERE "tenantId" = demo_tenant_id AND "providerProfileId" = demo_profile_id
    AND "serviceId" = demo_service_id AND "isActive" = true
  ORDER BY "id" DESC LIMIT 1;
  IF demo_availability_id IS NULL THEN
    INSERT INTO "ConsultAvailability" (
      "tenantId", "providerProfileId", "serviceId", "startsAt", "endsAt", "channel", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      demo_tenant_id, demo_profile_id, demo_service_id,
      NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day 50 minutes', 'VIDEO', true, NOW(), NOW()
    ) RETURNING "id" INTO demo_availability_id;
  END IF;

  SELECT "id" INTO demo_booking_id FROM "ConsultBooking"
  WHERE "tenantId" = demo_tenant_id AND "availabilityId" = demo_availability_id
  LIMIT 1;
  IF demo_booking_id IS NULL THEN
    INSERT INTO "ConsultBooking" (
      "tenantId", "serviceId", "availabilityId", "clientProfileId", "status", "paidAt", "videoRoomName", "createdAt"
    ) VALUES (
      demo_tenant_id, demo_service_id, demo_availability_id, demo_client_id,
      'CONFIRMED', NOW(), 'unclutter-demo-session', NOW()
    ) RETURNING "id" INTO demo_booking_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "ClinicalNote" WHERE "tenantId" = demo_tenant_id AND "bookingId" = demo_booking_id) THEN
    INSERT INTO "ClinicalNote" (
      "tenantId", "bookingId", "clientProfileId", "authorProfileId", "subjective",
      "objective", "assessment", "plan", "isLocked", "createdAt", "updatedAt"
    ) VALUES (
      demo_tenant_id, demo_booking_id, demo_client_id, demo_profile_id,
      'Synthetic client reports improved sleep and reduced anxiety.',
      'Synthetic observation: calm presentation and engaged participation.',
      'Synthetic assessment for demonstration only.',
      'Continue demonstration workflow; do not use this record for care.', true, NOW(), NOW()
    );
  END IF;

  SELECT "id" INTO demo_form_id FROM "UniversalForm"
  WHERE "tenantId" = demo_tenant_id AND "slug" = 'demo-phq-9' LIMIT 1;
  IF demo_form_id IS NULL THEN
    INSERT INTO "UniversalForm" (
      "tenantId", "title", "slug", "systemKey", "description", "targetType", "schemaJson", "isDefault", "isActive", "createdAt", "updatedAt"
    ) VALUES (
      demo_tenant_id, 'PHQ-9 Demo', 'demo-phq-9', 'PHQ_9', 'Synthetic assessment for demonstrations.',
      'ASSESSMENT', '[{"id":"phq9_1","label":"Little interest or pleasure in doing things","type":"single_choice","options":["0","1","2","3"],"required":true}]'::jsonb,
      true, true, NOW(), NOW()
    ) RETURNING "id" INTO demo_form_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "UniversalFormSubmission" WHERE "tenantId" = demo_tenant_id AND "bookingId" = demo_booking_id AND "formId" = demo_form_id) THEN
    INSERT INTO "UniversalFormSubmission" (
      "tenantId", "formId", "bookingId", "clientProfileId", "targetType", "status", "answersJson", "derivedJson"
    ) VALUES (
      demo_tenant_id, demo_form_id, demo_booking_id, demo_client_id, 'ASSESSMENT', 'REVIEWED',
      '{"phq9_1":"1"}'::jsonb, '{"instrument":"PHQ_9","totalScore":1,"severity":"Minimal","item9Risk":false}'::jsonb
    );
  END IF;
END $$;
