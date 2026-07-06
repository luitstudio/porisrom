import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreatePortfolioItemDto } from "./dto/create-portfolio-item.dto";
import { UpdateFreelancerProfileDto } from "./dto/update-freelancer-profile.dto";
import { FreelancerProfileService } from "./freelancer-profile.service";

@Controller("freelancers")
export class FreelancerProfileController {
  constructor(private readonly freelancerProfileService: FreelancerProfileService) {}

  @Get(":id")
  getPublic(@Param("id") id: string) {
    return this.freelancerProfileService.getPublicProfile(id);
  }

  @Patch("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("freelancer")
  updateOwn(@CurrentUser() user: CurrentUserPayload, @Body() dto: UpdateFreelancerProfileDto) {
    return this.freelancerProfileService.upsertOwn(user.userId, dto);
  }

  @Post("me/portfolio")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("freelancer")
  addPortfolio(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreatePortfolioItemDto) {
    return this.freelancerProfileService.addPortfolioItem(user.userId, dto);
  }

  @Delete("me/portfolio/:itemId")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("freelancer")
  removePortfolio(@CurrentUser() user: CurrentUserPayload, @Param("itemId") itemId: string) {
    return this.freelancerProfileService.removePortfolioItem(user.userId, itemId);
  }
}
