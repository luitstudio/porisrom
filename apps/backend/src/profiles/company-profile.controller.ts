import { Body, Controller, Get, Param, Patch, Post, Res, StreamableFile, UploadedFile, UploadedFiles, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileFieldsInterceptor, FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { createReadStream } from "fs";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { CompanyDocumentService } from "./company-document.service";
import { CompanyProfileService } from "./company-profile.service";
import { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";

@Controller("companies")
export class CompanyProfileController {
  constructor(
    private readonly companyProfileService: CompanyProfileService,
    private readonly companyDocumentService: CompanyDocumentService,
  ) {}

  @Get("me")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("client")
  getOwn(@CurrentUser() user: CurrentUserPayload) {
    return this.companyProfileService.getOwnProfile(user.userId);
  }

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

  @Post("me/logo")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("client")
  @UseInterceptors(FileInterceptor("photo", { limits: { fileSize: 2 * 1024 * 1024 + 1 } }))
  uploadLogo(@CurrentUser() user: CurrentUserPayload, @UploadedFile() file?: Express.Multer.File) {
    return this.companyProfileService.uploadLogo(user.userId, file);
  }

  @Get("me/documents")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("client")
  listDocuments(@CurrentUser() user: CurrentUserPayload) {
    return this.companyDocumentService.listForOwner(user.userId);
  }

  @Post("me/documents")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("client")
  @UseInterceptors(FileFieldsInterceptor([
    { name: "certificate", maxCount: 1 },
    { name: "aadhaar", maxCount: 4 },
  ], { limits: { fileSize: 1024 * 1024 + 1, files: 5 } }))
  uploadDocuments(
    @CurrentUser() user: CurrentUserPayload,
    @UploadedFiles() files?: { certificate?: Express.Multer.File[]; aadhaar?: Express.Multer.File[] },
  ) {
    return this.companyDocumentService.uploadForClient(user.userId, files ?? {});
  }

  @Get("me/documents/:documentId/file")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles("client")
  async getDocumentFile(
    @CurrentUser() user: CurrentUserPayload,
    @Param("documentId") documentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const document = await this.companyDocumentService.fileForOwner(user.userId, documentId);
    res.set("Cache-Control", "private, no-store");
    if (document.kind === "redirect") {
      res.redirect(document.url);
      return undefined;
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=\"company-document.pdf\"",
      "Cache-Control": "private, no-store",
    });
    return new StreamableFile(createReadStream(document.path));
  }
}
