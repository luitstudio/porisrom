import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";

import { StorageMaintenanceController } from "./storage-maintenance.controller";
import { BackupCoordinatorController } from "./backup-coordinator.controller";
import { BackupCoordinatorMtlsGuard } from "./backup-coordinator-mtls.guard";
import { BackupCoordinatorService } from "./backup-coordinator.service";
import { StorageMutationCoordinator } from "./storage-mutation-coordinator.service";
import { StorageMaintenanceGuard } from "./storage-maintenance.guard";

@Module({
  controllers: [StorageMaintenanceController, BackupCoordinatorController],
  providers: [StorageMutationCoordinator, BackupCoordinatorService, BackupCoordinatorMtlsGuard, { provide: APP_GUARD, useClass: StorageMaintenanceGuard }],
  exports: [StorageMutationCoordinator, BackupCoordinatorService],
})
export class StorageMaintenanceModule {}
