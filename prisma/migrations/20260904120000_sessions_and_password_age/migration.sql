-- Refresh tokens were stateless JWTs: signed, handed out, and never recorded.
-- Nothing could be revoked. Logout only cleared the browser's cookies, so a
-- stolen refresh token stayed valid for its full 30 days with no way to kill
-- it, "sign out everywhere" was impossible, and closing a practice — which
-- deletes Token rows believing it ends every session — actually ended none.
--
-- The Token table already carried userAgent, ipAddress, lastUsedAt and
-- revokedAt for exactly this. Only the label is new.
CREATE INDEX IF NOT EXISTS "Token_userId_type_revokedAt_idx"
  ON "Token" ("userId", "type", "revokedAt");

-- So the account page can say when the password last changed instead of
-- claiming "3 months ago" for everyone. Null means never changed since this
-- shipped, which is the truth for existing accounts.
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" TIMESTAMP(3);
