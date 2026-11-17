import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";

import { CurrentUser, type CurrentUserPayload } from "../auth/decorators/current-user.decorator";
import { Roles } from "../auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { RolesGuard } from "../auth/guards/roles.guard";
import { MaintenanceReasonDto } from "./dto/maintenance-reason.dto";
import { CaptureLeaseReferenceDto, CaptureOutcomeDto } from "./dto/capture-lease.dto";
import { ReconcileStorageOperationDto } from "./dto/reconcile-storage-operation.dto";
import { StorageMutationCoordinator } from "./storage-mutation-coordinator.service";

@Controller("admin/storage-maintenance")
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles("admin")
export class StorageMaintenanceController {
  constructor(private readonly maintenance: StorageMutationCoordinator) {}

  @Post("enable")
  enable(@CurrentUser() user: CurrentUserPayload) {
    return this.maintenance.enable(user.userId);
  }

  @Get()
  status() {
    return this.maintenance.status();
  }

  @Post("disable")
  disable(@CurrentUser() user: CurrentUserPayload, @Body() dto: MaintenanceReasonDto) {
    return this.maintenance.disable(user.userId, dto.reason);
  }

  @Post("capture/acquire")
  acquireCaptureLease(@CurrentUser() user: CurrentUserPayload, @Body() dto: MaintenanceReasonDto) {
    return this.maintenance.acquireCaptureLease(user.userId, dto.reason);
  }

  @Post("capture/outcome")
  recordCaptureOutcome(@CurrentUser() user: CurrentUserPayload, @Body() dto: CaptureOutcomeDto) {
    return this.maintenance.recordCaptureOutcome(user.userId, dto.leaseId, dto.generation, dto.outcome, dto.reason);
  }

  @Post("capture/release")
  releaseCaptureLease(@CurrentUser() user: CurrentUserPayload, @Body() dto: CaptureLeaseReferenceDto) {
    return this.maintenance.releaseCaptureLease(user.userId, dto.leaseId, dto.generation, dto.reason);
  }

  @Post("capture/recover")
  recoverCaptureLease(@CurrentUser() user: CurrentUserPayload, @Body() dto: CaptureLeaseReferenceDto) {
    return this.maintenance.recoverCaptureLease(user.userId, dto.leaseId, dto.generation, dto.reason);
  }

  @Post("operations/:operationId/reconcile")
  reconcile(
    @CurrentUser() user: CurrentUserPayload,
    @Param("operationId") operationId: string,
    @Body() dto: ReconcileStorageOperationDto,
  ) {
    return this.maintenance.reconcile(user.userId, operationId, dto.reason, dto.outcome);
  }

  @Post("operations/:operationId/fence")
  fence(
    @CurrentUser() user: CurrentUserPayload,
    @Param("operationId") operationId: string,
    @Body() dto: MaintenanceReasonDto,
  ) {
    return this.maintenance.fenceOperation(user.userId, operationId, dto.reason);
  }

  @Post("acknowledge-quiescent")
  acknowledgeQuiescent(@CurrentUser() user: CurrentUserPayload, @Body() dto: MaintenanceReasonDto) {
    return this.maintenance.acknowledgeQuiescent(user.userId, dto.reason);
  }
}
