import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, StreamableFile, UseGuards } from "@nestjs/common";
import { createReadStream } from "fs";
import type { Response } from "express";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminService } from "./admin.service";
import { PaymentDisputesService } from "./payment-disputes.service";
import { ResolvePaymentDisputeDto } from "./dto/resolve-payment-dispute.dto";
import { PaymentIdParamsDto } from "./dto/payment-id-params.dto";
import { BroadcastNotificationDto } from "./dto/broadcast-notification.dto";
import { ListUsersQueryDto } from "./dto/list-users-query.dto";
import { SendDirectMessageDto } from "./dto/send-direct-message.dto";
import { SetBadgeDto } from "./dto/set-badge.dto";
import { SetBlockedDto } from "./dto/set-blocked.dto";
import { ReviewIdentityDocumentDto } from "./dto/review-identity-document.dto";
import { IdentityDocumentService } from "../kyc/identity-document.service";
import { CompanyDocumentService } from "../profiles/company-document.service";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly identityDocumentService: IdentityDocumentService,
    private readonly companyDocumentService: CompanyDocumentService,
    private readonly paymentDisputesService: PaymentDisputesService,
  ) {}

  @Get("users")
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers({ role: query.role });
  }

  @Get("users/:id/profile")
  getProfileForReview(@Param("id") id: string) {
    return this.adminService.getProfileForReview(id);
  }

  @Get("users/:id/identity-document")
  getIdentityDocument(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    res.set("Cache-Control", "private, no-store");
    return this.identityDocumentService.signedUrlForAdmin(id);
  }

  @Get("users/:id/identity-document/file")
  async getIdentityDocumentFile(@Param("id") id: string, @Res({ passthrough: true }) res: Response) {
    const document = await this.identityDocumentService.fileForAdmin(id);
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

  @Get("users/:id/company-documents")
  getCompanyDocuments(@Param("id") id: string) {
    return this.companyDocumentService.listForAdmin(id);
  }

  @Get("users/:id/company-documents/:documentId/file")
  async getCompanyDocumentFile(
    @Param("id") id: string,
    @Param("documentId") documentId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const document = await this.companyDocumentService.fileForAdmin(id, documentId);
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

  @Patch("users/:id/identity-document/review")
  reviewIdentityDocument(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body() dto: ReviewIdentityDocumentDto,
  ) {
    return this.identityDocumentService.reviewForAdmin(user.userId, id, dto.status);
  }

  @Patch("users/:id/approve")
  approve(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.adminService.approveProfile(id, user.userId);
  }

  @Patch("users/:id/reject")
  reject(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.adminService.rejectProfile(id, user.userId);
  }

  @Patch("users/:id/badge")
  setBadge(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string, @Body() dto: SetBadgeDto) {
    return this.adminService.setBadge(id, dto.isBadgeVerified, user.userId);
  }

  @Patch("users/:id/block")
  setBlocked(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string, @Body() dto: SetBlockedDto) {
    return this.adminService.setBlocked(id, dto.blocked, user.userId);
  }

  @Delete("users/:id")
  softDelete(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.adminService.softDeleteUser(id, user.userId);
  }

  @Get("reviews")
  listReviews() {
    return this.adminService.listReviews();
  }

  @Delete("reviews/:id")
  removeReview(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.adminService.removeReview(id, user.userId);
  }

  @Get("conversations")
  listConversations() {
    return this.adminService.listConversations();
  }

  @Get("work-assignments")
  listWorkAssignments() {
    return this.adminService.listWorkAssignments();
  }

  @Get("action-log")
  actionLog() {
    return this.adminService.listActionLog();
  }

  @Get("payments")
  listPayments() {
    return this.adminService.listPayments();
  }

  @Get("analytics")
  analytics() {
    return this.adminService.getAnalytics();
  }

  @Get("payments/:id")
  paymentDetails(@Param() params: PaymentIdParamsDto) {
    return this.paymentDisputesService.details(params.id);
  }

  // Audit persistence is part of the service transaction, not the best-effort interceptor.
  @Post("payments/:id/resolve")
  resolvePayment(@CurrentUser() user: CurrentUserPayload, @Param() params: PaymentIdParamsDto, @Body() dto: ResolvePaymentDisputeDto) {
    return this.paymentDisputesService.resolve(user.userId, params.id, dto);
  }

  @Post("notifications/broadcast")
  broadcast(@CurrentUser() user: CurrentUserPayload, @Body() dto: BroadcastNotificationDto) {
    return this.adminService.broadcastNotification(user.userId, dto.type, dto.message);
  }

  @Post("messages/direct")
  sendDirectMessage(@CurrentUser() user: CurrentUserPayload, @Body() dto: SendDirectMessageDto) {
    return this.adminService.sendDirectMessage(user.userId, dto.userId, dto.message);
  }
}
