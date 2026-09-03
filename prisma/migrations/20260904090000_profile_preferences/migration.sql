-- The account preferences page offered language, timezone, currency and
-- date/time/number formats behind a "Save preferences" button that had no
-- handler and no column to write to. Nothing the user chose survived a refresh.
ALTER TABLE "Profile" ADD COLUMN "locale" TEXT NOT NULL DEFAULT 'en-NG';
ALTER TABLE "Profile" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Africa/Lagos';
ALTER TABLE "Profile" ADD COLUMN "dateFormat" TEXT NOT NULL DEFAULT 'DD/MM/YYYY';
ALTER TABLE "Profile" ADD COLUMN "timeFormat" TEXT NOT NULL DEFAULT '24-hour';
ALTER TABLE "Profile" ADD COLUMN "weekStartsOn" TEXT NOT NULL DEFAULT 'Monday';
ALTER TABLE "Profile" ADD COLUMN "numberFormat" TEXT NOT NULL DEFAULT '1,234.56';
