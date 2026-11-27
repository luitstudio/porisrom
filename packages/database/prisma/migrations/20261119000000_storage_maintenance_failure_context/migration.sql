-- Sanitized provider/local storage identities required for audited recovery.
ALTER TABLE "StorageMaintenanceOperation" ADD COLUMN "failureContext" JSONB;
