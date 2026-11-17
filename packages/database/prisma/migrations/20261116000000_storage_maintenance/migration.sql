-- Durable, serialized storage-write maintenance gate.  A singleton row is
-- inserted by this migration so admission/activation can lock it with FOR UPDATE.
CREATE TYPE "StorageMaintenanceMode" AS ENUM ('inactive', 'draining', 'quiescent', 'recovery_required');
CREATE TYPE "StorageMutationKind" AS ENUM ('identity_document', 'company_document', 'profile_photo');
CREATE TYPE "StorageMutationStatus" AS ENUM ('active', 'completed', 'failed', 'reconciled');

CREATE TABLE "StorageMaintenanceState" (
    "id" TEXT NOT NULL,
    "mode" "StorageMaintenanceMode" NOT NULL DEFAULT 'inactive',
    "generation" INTEGER NOT NULL DEFAULT 0,
    "activatedAt" TIMESTAMP(3),
    "activatedBy" TEXT,
    "quiescentAt" TIMESTAMP(3),
    "disabledAt" TIMESTAMP(3),
    "disabledBy" TEXT,
    "recoveryRequiredAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StorageMaintenanceState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageMaintenanceOperation" (
    "id" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "kind" "StorageMutationKind" NOT NULL,
    "status" "StorageMutationStatus" NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "failureKind" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "reconciliationReason" TEXT,
    "reconciliationOutcome" TEXT,
    CONSTRAINT "StorageMaintenanceOperation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StorageMaintenanceEvent" (
    "id" TEXT NOT NULL,
    "generation" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "operatorId" TEXT,
    "operationId" TEXT,
    "reason" TEXT,
    "outcome" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StorageMaintenanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StorageMaintenanceOperation_status_generation_idx" ON "StorageMaintenanceOperation"("status", "generation");
CREATE INDEX "StorageMaintenanceEvent_generation_createdAt_idx" ON "StorageMaintenanceEvent"("generation", "createdAt");
CREATE INDEX "StorageMaintenanceEvent_operationId_idx" ON "StorageMaintenanceEvent"("operationId");

INSERT INTO "StorageMaintenanceState" ("id", "updatedAt") VALUES ('storage', CURRENT_TIMESTAMP);
