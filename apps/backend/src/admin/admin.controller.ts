import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards, UseInterceptors } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminService } from "./admin.service";
import { LogAdminAction } from "./decorators/log-admin-action.decorator";
import { BroadcastNotificationDto } from "./dto/broadcast-notification.dto";
import { SendDirectMessageDto } from "./dto/send-direct-message.dto";
import { SetBadgeDto } from "./dto/set-badge.dto";
import { SetBlockedDto } from "./dto/set-blocked.dto";
import { AdminActionLogInterceptor } from "./interceptors/admin-action-log.interceptor";

@Controller("admin")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
@UseInterceptors(AdminActionLogInterceptor)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("users")
  listUsers(@Query("role") role?: string) {
    return this.adminService.listUsers({ role });
  }

  @Patch("users/:id/approve")
  @LogAdminAction("approve_profile")
  approve(@Param("id") id: string) {
    return this.adminService.approveProfile(id);
  }

  @Patch("users/:id/reject")
  @LogAdminAction("reject_profile")
  reject(@Param("id") id: string) {
    return this.adminService.rejectProfile(id);
  }

  @Patch("users/:id/badge")
  @LogAdminAction("set_badge")
  setBadge(@Param("id") id: string, @Body() dto: SetBadgeDto) {
    return this.adminService.setBadge(id, dto.isBadgeVerified);
  }

  @Patch("users/:id/block")
  @LogAdminAction("set_blocked")
  setBlocked(@Param("id") id: string, @Body() dto: SetBlockedDto) {
    return this.adminService.setBlocked(id, dto.blocked);
  }

  @Delete("users/:id")
  @LogAdminAction("soft_delete_user")
  softDelete(@Param("id") id: string) {
    return this.adminService.softDeleteUser(id);
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

  @Post("notifications/broadcast")
  @LogAdminAction("broadcast_notification")
  broadcast(@CurrentUser() user: CurrentUserPayload, @Body() dto: BroadcastNotificationDto) {
    return this.adminService.broadcastNotification(user.userId, dto.type, dto.message);
  }

  @Post("messages/direct")
  @LogAdminAction("send_direct_message")
  sendDirectMessage(@CurrentUser() user: CurrentUserPayload, @Body() dto: SendDirectMessageDto) {
    return this.adminService.sendDirectMessage(user.userId, dto.userId, dto.message);
  }
}
