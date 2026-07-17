import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ConnectionsService } from "./connections.service";
import { CreateConnectionDto } from "./dto/create-connection.dto";

@Controller("connections")
@UseGuards(JwtAuthGuard)
export class ConnectionsController {
  constructor(private readonly connectionsService: ConnectionsService) {}

  @Post()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateConnectionDto) {
    return this.connectionsService.create(user.userId, dto.receiverId);
  }

  @Get()
  listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.connectionsService.listMine(user.userId);
  }

  @Patch(":id/accept")
  accept(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.connectionsService.accept(user.userId, id);
  }

  @Patch(":id/decline")
  decline(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.connectionsService.decline(user.userId, id);
  }
}
