-- Profile layout (spec §6.5): chosen separately from the palette (themeKey).
-- Existing profiles get the default layout, classic.

-- AlterTable
ALTER TABLE "PractitionerProfile" ADD COLUMN     "layoutKey" TEXT NOT NULL DEFAULT 'classic';

