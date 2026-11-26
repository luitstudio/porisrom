import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { StorageMaintenanceController } from "./storage-maintenance.controller";
import { BackupCoordinatorController } from "./backup-coordinator.controller";
import { BackupCoordinatorMtlsGuard } from "./backup-coordinator-mtls.guard";
import { BackupCoordinatorService } from "./backup-coordinator.service";
import { BackupArtifactVerifierController, BackupRestoreVerifierController } from "./backup-verifier.controller";
import { BackupVerifierEvidenceService } from "./backup-verifier-evidence.service";
import { BackupArtifactProofService } from "./backup-artifact-proof.service";
import { ArtifactVerifierMtlsGuard, BackupVerifierMtlsAuthenticator, RestoreVerifierMtlsGuard } from "./backup-verifier-mtls.guard";
import { BackupSchedulerService } from "./backup-scheduler.service";
import { StorageMutationCoordinator } from "./storage-mutation-coordinator.service";
import { StorageMaintenanceGuard } from "./storage-maintenance.guard";

@Module({
  controllers: [StorageMaintenanceController, BackupCoordinatorController, BackupArtifactVerifierController, BackupRestoreVerifierController],
  providers: [StorageMutationCoordinator, BackupCoordinatorService, BackupSchedulerService, BackupCoordinatorMtlsGuard, BackupVerifierMtlsAuthenticator, ArtifactVerifierMtlsGuard, RestoreVerifierMtlsGuard, BackupArtifactProofService, BackupVerifierEvidenceService, { provide: APP_GUARD, useClass: StorageMaintenanceGuard }],
  exports: [StorageMutationCoordinator, BackupCoordinatorService],
})
export class StorageMaintenanceModule {}
