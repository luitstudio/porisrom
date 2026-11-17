import { Body, Controller, Get, Param, Post, Req, UseGuards } from "@nestjs/common";

import { BackupCoordinatorMtlsGuard } from "./backup-coordinator-mtls.guard";
import { BackupCoordinatorService } from "./backup-coordinator.service";
import { BackupCoordinatorDeliveryDto, BackupCoordinatorReferenceDto, BackupCoordinatorReportDto } from "./dto/backup-coordinator.dto";

@Controller("internal/backup-coordinator/jobs")
@UseGuards(BackupCoordinatorMtlsGuard)
export class BackupCoordinatorController {
  constructor(private readonly coordinator: BackupCoordinatorService) {}

  @Post("delivery")
  delivery(@Req() req: any, @Body() dto: BackupCoordinatorDeliveryDto) {
    return this.coordinator.deliver(req.coordinatorPrincipal.id, dto.limit);
  }

  @Post(":jobId/claim")
  claim(@Req() req: any, @Param("jobId") jobId: string, @Body() dto: BackupCoordinatorReferenceDto) {
    return this.coordinator.claim(req.coordinatorPrincipal.id, { ...dto, jobId });
  }

  @Post(":jobId/validate")
  validate(@Req() req: any, @Param("jobId") jobId: string, @Body() dto: BackupCoordinatorReferenceDto) {
    return this.coordinator.validate(req.coordinatorPrincipal.id, { ...dto, jobId });
  }

  @Post(":jobId/report")
  report(@Req() req: any, @Param("jobId") jobId: string, @Body() dto: BackupCoordinatorReportDto) {
    return this.coordinator.report(req.coordinatorPrincipal.id, { ...dto, jobId }, dto.outcome, dto.resultIdempotencyKey, dto.reason, dto.resultSetId, dto.resultManifestSha256);
  }

  @Get(":jobId")
  status(@Req() req: any, @Param("jobId") jobId: string) {
    return this.coordinator.status(req.coordinatorPrincipal.id, jobId);
  }
}
