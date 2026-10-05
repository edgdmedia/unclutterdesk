-- BKG-13: a one-line tagline for the public profile hero, beside the longer bio.
ALTER TABLE "Tenant" ADD COLUMN "tagline" TEXT;
ALTER TABLE "ConsultTherapistProfile" ADD COLUMN "tagline" TEXT;
