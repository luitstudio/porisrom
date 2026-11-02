import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { Roles } from "../auth/decorators/roles.decorator";
import { PaymentIdParamsDto } from "../admin/dto/payment-id-params.dto";
import { BlockUserDto, ReportUserDto, ReviewSafetyCaseDto, SafetyCaseQueryDto, SafetyReasonDto, SupportCaseDto } from "./safety.dto";
import { SafetyService } from "./safety.service";

@Controller("safety")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("client", "freelancer")
export class SafetyController {
  constructor(private readonly safety: SafetyService) {}
  @Get("blocks") listBlocks(@CurrentUser() actor: CurrentUserPayload) { return this.safety.listBlocks(actor.userId); }
  @Post("blocks") block(@CurrentUser() actor: CurrentUserPayload, @Body() dto: BlockUserDto) { return this.safety.block(actor.userId, dto.blockedUserId); }
  @Delete("blocks/:id") unblock(@CurrentUser() actor: CurrentUserPayload, @Param() params: PaymentIdParamsDto) { return this.safety.unblock(actor.userId, params.id); }
  @Post("reports") report(@CurrentUser() actor: CurrentUserPayload, @Body() dto: ReportUserDto) { return this.safety.report(actor.userId, dto); }
  @Post("support") support(@CurrentUser() actor: CurrentUserPayload, @Body() dto: SupportCaseDto) { return this.safety.support(actor.userId, dto); }
  @Post("assignments/:id/escalate-cancellation") escalate(@CurrentUser() actor: CurrentUserPayload, @Param() params: PaymentIdParamsDto, @Body() dto: SafetyReasonDto) { return this.safety.escalate(actor.userId, params.id, dto.reason); }
  @Get("cases") mine(@CurrentUser() actor: CurrentUserPayload) { return this.safety.listMine(actor.userId); }
}

@Controller("admin/safety/cases")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class AdminSafetyController {
  constructor(private readonly safety: SafetyService) {}
  @Get() list(@Query() query: SafetyCaseQueryDto) { return this.safety.listAdmin(query.kind); }
  @Get(":id") detail(@Param() params: PaymentIdParamsDto) { return this.safety.detailAdmin(params.id); }
  @Post(":id/review") review(@CurrentUser() actor: CurrentUserPayload, @Param() params: PaymentIdParamsDto, @Body() dto: ReviewSafetyCaseDto) { return this.safety.review(actor.userId, params.id, dto); }
}
