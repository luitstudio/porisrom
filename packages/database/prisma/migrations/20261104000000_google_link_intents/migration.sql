CREATE TABLE "GoogleLinkIntent" (
    "nonce" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GoogleLinkIntent_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "GoogleLinkIntent_userId_sessionId_idx" ON "GoogleLinkIntent"("userId", "sessionId");
CREATE INDEX "GoogleLinkIntent_expiresAt_idx" ON "GoogleLinkIntent"("expiresAt");

ALTER TABLE "GoogleLinkIntent" ADD CONSTRAINT "GoogleLinkIntent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
