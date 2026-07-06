import { Body, Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CompanyProfileService } from "./company-profile.service";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";

@Controller("companies")
export class CompanyProfileController {
  constructor(private readonly companyProfileService: CompanyProfileService) {}

  @Get(":id")
  getPublic(@Param("id") id: string) {
    return this.companyProfileService.getPublicProfile(id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("client")
  updateOwn(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateCompanyProfileDto) {
    return this.companyProfileService.upsertOwn(user.userId, dto);
  }
}
