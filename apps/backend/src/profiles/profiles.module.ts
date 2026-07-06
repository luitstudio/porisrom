import { Module } from "@nestjs/common";

import { CompanyProfileController } from "./company-profile.controller";
import { CompanyProfileService } from "./company-profile.service";
import { FreelancerProfileController } from "./freelancer-profile.controller";
import { FreelancerProfileService } from "./freelancer-profile.service";

@Module({
  controllers: [FreelancerProfileController, CompanyProfileController],
  providers: [FreelancerProfileService, CompanyProfileService],
})
export class ProfilesModule {}
