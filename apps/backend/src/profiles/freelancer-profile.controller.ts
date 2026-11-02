import { Body, Controller, Delete, Get, Param, Patch, Post, Res, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { createReadStream } from "fs";
import type { Response } from "express";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CreatePortfolioItemDto } from "./dto/create-portfolio-item.dto";
import { UpdateFreelancerProfileDto } from "./dto/update-freelancer-profile.dto";
import { FreelancerProfileService } from "./freelancer-profile.service";
import { IdentityDocumentService } from "../kyc/identity-document.service";

@Controller("freelancers")
export class FreelancerProfileController {
  constructor(
    private readonly freelancerProfileService: FreelancerProfileService,
    private readonly identityDocumentService: IdentityDocumentService,
  ) {}

  @Get("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("freelancer")
  getOwn(@CurrentUser() user: CurrentUserPayload) {
    return this.freelancerProfileService.getOwnProfile(user.userId);
  }

  @Get("me/identity-document/file")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("freelancer")
  async getOwnIdentityDocumentFile(@CurrentUser() user: CurrentUserPayload, @Res({ passthrough: true }) res: Response) {
    const document = await this.identityDocumentService.fileForOwner(user.userId);
    res.set("Cache-Control", "private, no-store");
    if (document.kind === "redirect") {
      res.redirect(document.url);
      return undefined;
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"identity-document.pdf\"",
      "Cache-Control": "private, no-store",
    });
    return new StreamableFile(createReadStream(document.path));
  }

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

  @Post("me/identity-document")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("freelancer")
  @UseInterceptors(FileInterceptor("document", { limits: { fileSize: 1024 * 1024 + 1 } }))
  uploadIdentityDocument(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file?: Express.Multer.File) {
    return this.identityDocumentService.uploadForFreelancer(user.userId, file);
  }

  @Post("me/profile-photo")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("freelancer")
  @UseInterceptors(FileInterceptor("photo", { limits: { fileSize: 2 * 1024 * 1024 + 1 } }))
  uploadProfilePhoto(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file?: Express.Multer.File) {
    return this.freelancerProfileService.uploadProfilePhoto(user.userId, file);
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
