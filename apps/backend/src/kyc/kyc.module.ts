import { Module } from "@nestjs/common";

import { IdentityDocumentService } from "./identity-document.service";
import { StorageMaintenanceModule } from "../storage-maintenance/storage-maintenance.module";

@Module({
  imports: [StorageMaintenanceModule],
  providers: [IdentityDocumentService],
  exports: [IdentityDocumentService],
})
export class KycModule {}
