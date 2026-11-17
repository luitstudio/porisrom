-- Additive and intentionally nullable: legacy requests/jobs remain unassigned
-- and must not become eligible for a machine coordinator by migration alone.
ALTER TABLE "BackupCaptureRequest" ADD COLUMN "authorizedCoordinatorPrincipalId" TEXT;
ALTER TABLE "BackupCaptureJob" ADD COLUMN "authorizedCoordinatorPrincipalId" TEXT;

CREATE INDEX "BackupCaptureRequest_authorizedCoordinatorPrincipalId_statu_idx"
  ON "BackupCaptureRequest"("authorizedCoordinatorPrincipalId", "status");
CREATE INDEX "BackupCaptureJob_authorizedCoordinatorPrincipalId_status_idx"
  ON "BackupCaptureJob"("authorizedCoordinatorPrincipalId", "status");

ALTER TABLE "BackupCaptureRequest" ADD CONSTRAINT "BackupCaptureRequest_authorizedCoordinatorPrincipalId_fkey"
  FOREIGN KEY ("authorizedCoordinatorPrincipalId") REFERENCES "BackupCoordinatorPrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "BackupCaptureJob" ADD CONSTRAINT "BackupCaptureJob_authorizedCoordinatorPrincipalId_fkey"
  FOREIGN KEY ("authorizedCoordinatorPrincipalId") REFERENCES "BackupCoordinatorPrincipal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
