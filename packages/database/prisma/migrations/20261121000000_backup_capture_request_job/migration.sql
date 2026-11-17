CREATE TYPE "BackupCaptureClass" AS ENUM ('daily', 'weekly', 'monthly');
CREATE TYPE "BackupCaptureRequestStatus" AS ENUM ('pending', 'maintenance_draining', 'blocked_recovery', 'ready', 'cancelled');
CREATE TYPE "BackupCaptureJobStatus" AS ENUM ('authorized', 'claimed', 'running', 'result_pending', 'reported');

CREATE TABLE "BackupCaptureRequest" (
    "id" TEXT NOT NULL,
    "scheduleKey" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "backupClass" "BackupCaptureClass" NOT NULL,
    "status" "BackupCaptureRequestStatus" NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BackupCaptureRequest_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupCaptureJob" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "backupClass" "BackupCaptureClass" NOT NULL,
    "leaseId" TEXT NOT NULL,
    "leaseGeneration" INTEGER NOT NULL,
    "status" "BackupCaptureJobStatus" NOT NULL DEFAULT 'authorized',
    "authorizedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3),
    "claimedBy" TEXT,
    "coordinatorAttemptId" TEXT,
    "resultIdempotencyKey" TEXT,
    "resultSetId" TEXT,
    "resultManifestSha256" TEXT,
    "reportedAt" TIMESTAMP(3),
    CONSTRAINT "BackupCaptureJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BackupCoordinatorActionLog" (
    "id" TEXT NOT NULL,
    "principalId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "requestId" TEXT,
    "jobId" TEXT,
    "leaseId" TEXT,
    "generation" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupCoordinatorActionLog_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StorageMaintenanceState" ADD COLUMN "captureJobId" TEXT;

CREATE UNIQUE INDEX "BackupCaptureRequest_scheduleKey_scheduledFor_key" ON "BackupCaptureRequest"("scheduleKey", "scheduledFor");
CREATE INDEX "BackupCaptureRequest_status_scheduledFor_idx" ON "BackupCaptureRequest"("status", "scheduledFor");
CREATE UNIQUE INDEX "BackupCaptureJob_requestId_key" ON "BackupCaptureJob"("requestId");
CREATE UNIQUE INDEX "BackupCaptureJob_leaseId_key" ON "BackupCaptureJob"("leaseId");
CREATE UNIQUE INDEX "BackupCaptureJob_leaseId_leaseGeneration_key" ON "BackupCaptureJob"("leaseId", "leaseGeneration");
CREATE UNIQUE INDEX "BackupCaptureJob_coordinatorAttemptId_key" ON "BackupCaptureJob"("coordinatorAttemptId");
CREATE UNIQUE INDEX "BackupCaptureJob_resultIdempotencyKey_key" ON "BackupCaptureJob"("resultIdempotencyKey");
CREATE INDEX "BackupCaptureJob_status_authorizedAt_idx" ON "BackupCaptureJob"("status", "authorizedAt");
CREATE UNIQUE INDEX "StorageMaintenanceState_captureJobId_key" ON "StorageMaintenanceState"("captureJobId");
CREATE INDEX "BackupCoordinatorActionLog_principalId_createdAt_idx" ON "BackupCoordinatorActionLog"("principalId", "createdAt");
CREATE INDEX "BackupCoordinatorActionLog_requestId_idx" ON "BackupCoordinatorActionLog"("requestId");
CREATE INDEX "BackupCoordinatorActionLog_jobId_idx" ON "BackupCoordinatorActionLog"("jobId");
CREATE INDEX "BackupCoordinatorActionLog_leaseId_createdAt_idx" ON "BackupCoordinatorActionLog"("leaseId", "createdAt");

ALTER TABLE "BackupCaptureJob" ADD CONSTRAINT "BackupCaptureJob_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BackupCaptureRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StorageMaintenanceState" ADD CONSTRAINT "StorageMaintenanceState_captureJobId_fkey" FOREIGN KEY ("captureJobId") REFERENCES "BackupCaptureJob"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackupCoordinatorActionLog" ADD CONSTRAINT "BackupCoordinatorActionLog_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BackupCaptureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "BackupCoordinatorActionLog" ADD CONSTRAINT "BackupCoordinatorActionLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "BackupCaptureJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
