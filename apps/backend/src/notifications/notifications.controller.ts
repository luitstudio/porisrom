import { Controller, Get, Param, Patch, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.notificationsService.listMine(user.userId);
  }

  @Patch(":id/read")
  markRead(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.notificationsService.markRead(user.userId, id);
  }
}
