CREATE TYPE "StorageCaptureOutcome" AS ENUM ('succeeded', 'failed', 'uncertain');

ALTER TABLE "StorageMaintenanceState"
  ADD COLUMN "captureLeaseId" TEXT,
  ADD COLUMN "captureGeneration" INTEGER,
  ADD COLUMN "captureAcquiredAt" TIMESTAMP(3),
  ADD COLUMN "captureAcquiredBy" TEXT,
  ADD COLUMN "captureOutcome" "StorageCaptureOutcome",
  ADD COLUMN "captureOutcomeAt" TIMESTAMP(3),
  ADD COLUMN "captureOutcomeBy" TEXT,
  ADD COLUMN "captureOutcomeReason" TEXT;
