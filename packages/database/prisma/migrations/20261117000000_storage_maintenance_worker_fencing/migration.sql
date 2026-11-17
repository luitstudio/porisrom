-- A maintenance worker is a single backend-process identity.  Its fence epoch
-- is part of each admitted operation's lease and is never inferred from age.
ALTER TYPE "StorageMutationStatus" ADD VALUE 'fenced';

CREATE TABLE "StorageMaintenanceWorker" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeatAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fenceEpoch" INTEGER NOT NULL DEFAULT 0,
    "fencedAt" TIMESTAMP(3),
    "fencedBy" TEXT,
    "fencingReason" TEXT,
    "stoppedAt" TIMESTAMP(3),
    CONSTRAINT "StorageMaintenanceWorker_pkey" PRIMARY KEY ("id")
);

-- Existing operations cannot be attributed to a live worker after this
-- upgrade.  They are assigned a durable legacy identity which an operator
-- must explicitly fence and reconcile; no timeout makes them safe.
INSERT INTO "StorageMaintenanceWorker" ("id", "fencedAt", "fencingReason")
VALUES ('legacy-unfenced-worker', CURRENT_TIMESTAMP, 'pre-fencing operation; explicit reconciliation required');

ALTER TABLE "StorageMaintenanceOperation"
    ADD COLUMN "workerId" TEXT,
    ADD COLUMN "workerFenceEpoch" INTEGER;

UPDATE "StorageMaintenanceOperation"
SET "workerId" = 'legacy-unfenced-worker', "workerFenceEpoch" = 0
WHERE "workerId" IS NULL;

ALTER TABLE "StorageMaintenanceOperation"
    ALTER COLUMN "workerId" SET NOT NULL,
    ALTER COLUMN "workerFenceEpoch" SET NOT NULL;

CREATE INDEX "StorageMaintenanceOperation_workerId_status_idx"
    ON "StorageMaintenanceOperation"("workerId", "status");

ALTER TABLE "StorageMaintenanceOperation"
    ADD CONSTRAINT "StorageMaintenanceOperation_workerId_fkey"
    FOREIGN KEY ("workerId") REFERENCES "StorageMaintenanceWorker"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
