ALTER TABLE "Profile"
  ADD COLUMN "accountTokenHash" TEXT,
  ADD COLUMN "accountTokenExpiresAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "Profile_accountTokenHash_key" ON "Profile"("accountTokenHash");
