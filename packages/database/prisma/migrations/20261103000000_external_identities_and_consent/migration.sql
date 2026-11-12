-- Preserve existing password hashes and users. Consent is intentionally not
-- backfilled: the application has no durable evidence of historic acceptance.
ALTER TABLE "User"
  ADD COLUMN "termsAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "privacyPolicyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "privacyPolicyVersion" TEXT;

CREATE TYPE "ExternalIdentityProvider" AS ENUM ('google');

CREATE TABLE "ExternalIdentity" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "provider" "ExternalIdentityProvider" NOT NULL,
  "providerSubject" TEXT NOT NULL,
  "emailAtLink" TEXT NOT NULL,
  "emailVerifiedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "ExternalIdentity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExternalIdentity_provider_providerSubject_key"
  ON "ExternalIdentity"("provider", "providerSubject");
CREATE INDEX "ExternalIdentity_userId_idx" ON "ExternalIdentity"("userId");

ALTER TABLE "ExternalIdentity" ADD CONSTRAINT "ExternalIdentity_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
