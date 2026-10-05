-- SET-13: remember the Cloudflare custom hostname object and its last error.
ALTER TABLE "Tenant" ADD COLUMN "customHostnameId" VARCHAR(60);
ALTER TABLE "Tenant" ADD COLUMN "customHostnameError" TEXT;
