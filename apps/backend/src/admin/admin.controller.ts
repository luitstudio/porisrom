import { Body, Controller, Get, Param, Patch, Query, UseGuards, UseInterceptors } from "@nestjs/common";

import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { AdminService } from "./admin.service";
import { LogAdminAction } from "./decorators/log-admin-action.decorator";
import { SetBadgeDto } from "./dto/set-badge.dto";
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

  @Get("action-log")
  actionLog() {
    return this.adminService.listActionLog();
  }

  @Get("payments")
  listPayments() {
    return this.adminService.listPayments();
  }
}
