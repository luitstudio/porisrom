import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { ConversationsService } from "./conversations.service";
import { SendMessageDto } from "./dto/send-message.dto";

@Controller("conversations")
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  @Get()
  listMine(@CurrentUser() user: CurrentUserPayload) {
    return this.conversationsService.listMine(user.userId);
  }

  @Get(":id/messages")
  listMessages(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.conversationsService.listMessages(user.userId, id);
  }

  @Post(":id/messages")
  sendMessage(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body() dto: SendMessageDto,
  ) {
    return this.conversationsService.sendMessage(user.userId, id, dto.body);
  }
}
