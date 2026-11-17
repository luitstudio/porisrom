CREATE TYPE "BackupCoordinatorCertificateStatus" AS ENUM ('active', 'revoked');

ALTER TABLE "BackupCaptureJob"
  ADD COLUMN "resultOutcome" "StorageCaptureOutcome",
  ADD COLUMN "resultReason" TEXT;

CREATE TABLE "BackupCoordinatorPrincipal" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "disabledAt" TIMESTAMP(3),
  CONSTRAINT "BackupCoordinatorPrincipal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupCoordinatorCertificate" (
  "id" TEXT NOT NULL,
  "principalId" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "status" "BackupCoordinatorCertificateStatus" NOT NULL DEFAULT 'active',
  "notBefore" TIMESTAMP(3),
  "notAfter" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "revokedBy" TEXT,
  "revokeReason" TEXT,
  CONSTRAINT "BackupCoordinatorCertificate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BackupCoordinatorCertificate_fingerprint_key" ON "BackupCoordinatorCertificate"("fingerprint");
CREATE INDEX "BackupCoordinatorCertificate_principalId_status_idx" ON "BackupCoordinatorCertificate"("principalId", "status");
ALTER TABLE "BackupCoordinatorCertificate" ADD CONSTRAINT "BackupCoordinatorCertificate_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "BackupCoordinatorPrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
