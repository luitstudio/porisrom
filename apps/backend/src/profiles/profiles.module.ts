import { Module } from "@nestjs/common";

import { CompanyProfileController } from "./company-profile.controller";
import { CompanyProfileService } from "./company-profile.service";
import { FreelancerProfileController } from "./freelancer-profile.controller";
import { FreelancerProfileService } from "./freelancer-profile.service";
import { KycModule } from "../kyc/kyc.module";

@Module({
  imports: [KycModule],
  controllers: [FreelancerProfileController, CompanyProfileController],
  providers: [FreelancerProfileService, CompanyProfileService],
})
export class ProfilesModule {}
