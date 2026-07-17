import { Body, Controller, Get, Param, Patch, Post, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CancelWorkAssignmentDto } from "./dto/cancel-work-assignment.dto";
import { CreateWorkAssignmentDto } from "./dto/create-work-assignment.dto";
import { RespondWorkAssignmentDto } from "./dto/respond-work-assignment.dto";
import { ReviseWorkAssignmentDto } from "./dto/revise-work-assignment.dto";
import { WorkAssignmentsService } from "./work-assignments.service";

@Controller()
@UseGuards(JwtAuthGuard)
export class WorkAssignmentsController {
  constructor(private readonly workAssignmentsService: WorkAssignmentsService) {}

  @Post("conversations/:conversationId/work-assignments")
  create(
    @CurrentUser() user: CurrentUserPayload,
    @Param("conversationId") conversationId: string,
    @Body() dto: CreateWorkAssignmentDto,
  ) {
    return this.workAssignmentsService.create(user.userId, conversationId, dto);
  }

  @Get("work-assignments/:id")
  findOne(@CurrentUser() user: CurrentUserPayload, @Param("id") id: string) {
    return this.workAssignmentsService.findOneForParticipant(user.userId, id);
  }

  @Get("conversations/:conversationId/work-assignments")
  listForConversation(
    @CurrentUser() user: CurrentUserPayload,
    @Param("conversationId") conversationId: string,
  ) {
    return this.workAssignmentsService.listForConversation(user.userId, conversationId);
  }

  @Patch("work-assignments/:id/respond")
  respond(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body() dto: RespondWorkAssignmentDto,
  ) {
    return this.workAssignmentsService.respond(user.userId, id, dto);
  }

  @Patch("work-assignments/:id/revise")
  revise(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body() dto: ReviseWorkAssignmentDto,
  ) {
    return this.workAssignmentsService.revise(user.userId, id, dto);
  }

  @Patch("work-assignments/:id/cancel")
  cancel(
    @CurrentUser() user: CurrentUserPayload,
    @Param("id") id: string,
    @Body() dto: CancelWorkAssignmentDto,
  ) {
    return this.workAssignmentsService.cancel(user.userId, id, dto.note);
  }
}
