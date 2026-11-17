import { Module } from "@nestjs/common";

import { CompanyDocumentService } from "./company-document.service";
import { CompanyProfileController } from "./company-profile.controller";
import { CompanyProfileService } from "./company-profile.service";
import { FreelancerProfileController } from "./freelancer-profile.controller";
import { FreelancerProfileService } from "./freelancer-profile.service";
import { KycModule } from "../kyc/kyc.module";
import { ProfilePhotoStorageService } from "./profile-photo-storage.service";
import { StorageMaintenanceModule } from "../storage-maintenance/storage-maintenance.module";

@Module({
  imports: [KycModule, StorageMaintenanceModule],
  controllers: [FreelancerProfileController, CompanyProfileController],
  providers: [FreelancerProfileService, CompanyProfileService, CompanyDocumentService, ProfilePhotoStorageService],
  exports: [CompanyDocumentService],
})
export class ProfilesModule {}
