import { ConflictException, Injectable, OnModuleDestroy, OnModuleInit, ServiceUnavailableException } from "@nestjs/common";
import type { BackupCaptureRequest, Prisma, StorageMaintenanceState } from "@porisrom/database";
import { randomUUID } from "node:crypto";

import { auditedAdminMutation } from "../admin/audited-mutation";
import { PrismaService, type PrismaDb } from "../prisma/prisma.service";

const STATE_ID = "storage";
type MutationKind = "identity_document" | "company_document" | "profile_photo";
type ReconciliationOutcome = "confirmed_complete" | "confirmed_not_started" | "provider_reconciled";
type CaptureOutcome = "succeeded" | "failed" | "uncertain";
type BackupCapturePrincipal = { id: string; type: "admin" | "system" };
type BackupCaptureRequestInput = { scheduleKey: string; scheduledFor: Date; backupClass: "daily" | "weekly" | "monthly" };
type Tx = Prisma.TransactionClient;

/** A lease is checked immediately before every external storage side effect. */
export type StorageMutationLease = { operationId: string; assertNotFenced(): Promise<void> };

/** A sanitized, durable recovery payload for storage work with uncertain I/O. */
export class StorageMutationReconciliationRequiredError extends ServiceUnavailableException {
  constructor(
    readonly failureKind: string,
    readonly failureContext: Prisma.InputJsonValue,
  ) {
    super("Storage mutation requires operator reconciliation");
  }
}

@Injectable()
export class StorageMutationCoordinator implements OnModuleInit, OnModuleDestroy {
  private readonly workerId = randomUUID();
  private workerReady?: Promise<void>;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() { await this.ensureWorker(); }

  async onModuleDestroy() {
    // Stopping a process never releases maintenance or finishes its operations.
    if (!this.workerReady) return;
    await this.workerReady;
    await this.prisma.db.storageMaintenanceWorker.update({ where: { id: this.workerId }, data: { stoppedAt: new Date(), heartbeatAt: new Date() } }).catch(() => undefined);
  }

  /** Admission commits an operation and its worker fence token before any I/O. */
  async run<T>(kind: MutationKind, mutate: (lease: StorageMutationLease) => Promise<T>): Promise<T> {
    await this.ensureWorker();
    const operation = await this.prisma.db.$transaction(async tx => {
      const state = await this.lockState(tx);
      if (state.mode !== "inactive") throw new ServiceUnavailableException("Storage updates are temporarily unavailable for maintenance");
      const worker = await this.lockWorker(tx, this.workerId);
      if (worker.fencedAt) throw new ServiceUnavailableException("This storage worker has been fenced");
      await tx.storageMaintenanceWorker.update({ where: { id: worker.id }, data: { heartbeatAt: new Date() } });
      return tx.storageMaintenanceOperation.create({ data: { generation: state.generation + 1, kind, status: "active", workerId: worker.id, workerFenceEpoch: worker.fenceEpoch } });
    });
    const lease: StorageMutationLease = { operationId: operation.id, assertNotFenced: () => this.assertLease(operation.id) };
    try {
      const result = await mutate(lease);
      if (!await this.finish(operation.id, true)) {
        throw new ServiceUnavailableException("Storage worker was fenced before completion");
      }
      return result;
    } catch (error) {
      const reconciliation = error instanceof StorageMutationReconciliationRequiredError ? error : undefined;
      await this.finish(operation.id, false, reconciliation);
      throw error;
    }
  }

  async enable(operatorId: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "enable_storage_maintenance", undefined, undefined, async tx =>
      this.statusFrom(tx, await this.enableMaintenanceInTransaction(tx, operatorId)),
    );
  }

  async disable(operatorId: string, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "disable_storage_maintenance", undefined, { reason }, async tx => {
      const state = await this.lockState(tx);
      if (state.mode !== "quiescent") throw new ConflictException("Only a quiescent maintenance window can be disabled");
      if (state.captureLeaseId || state.captureJobId) throw new ConflictException("An active backup capture lease or job must be released first");
      if (await this.unresolvedCount(tx)) throw new ConflictException("Storage operations require reconciliation");
      const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { mode: "inactive", disabledAt: new Date(), disabledBy: operatorId } });
      await this.event(tx, next.generation, "maintenance_disabled", operatorId, undefined, reason);
      return this.statusFrom(tx, next);
    });
  }

  /** Acquires the durable, generation-bound lock consumed by a future backup coordinator. */
  async acquireCaptureLease(operatorId: string, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "acquire_storage_capture_lease", undefined, { reason }, async tx => {
      const state = await this.lockState(tx);
      await this.assertCaptureAvailable(tx, state);
      const leaseId = randomUUID();
      const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: {
        captureLeaseId: leaseId,
        captureGeneration: state.generation,
        captureAcquiredAt: new Date(),
        captureAcquiredBy: operatorId,
        captureOutcome: null,
        captureOutcomeAt: null,
        captureOutcomeBy: null,
        captureOutcomeReason: null,
      } });
      await this.event(tx, next.generation, "storage_capture_lease_acquired", operatorId, leaseId, reason);
      return this.statusFrom(tx, next);
    });
  }

  /**
   * Atomically authorizes a scheduled request.  The state row is locked before
   * the request row so this follows the same global lock order as all storage
   * maintenance transitions.  It deliberately does not enable maintenance:
   * a caller may only authorize a request after the existing coordinator has
   * drained writes and reached quiescence.
   */
  async authorizeBackupCaptureRequest(operatorId: string, requestId: string, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "authorize_backup_capture_request", undefined, { requestId, reason }, tx =>
      this.authorizeBackupCaptureRequestInTransaction(tx, requestId, { id: operatorId, type: "admin" }, reason),
    );
  }

  /** Explicit human assignment only; unassigned legacy requests remain ineligible. */
  async assignBackupCaptureCoordinator(operatorId: string, requestId: string, principalId: string, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "assign_backup_capture_coordinator", undefined, { requestId, principalId, reason }, async tx => {
      await tx.$queryRaw`SELECT "id" FROM "BackupCaptureRequest" WHERE "id" = ${requestId} FOR UPDATE`;
      const request = await tx.backupCaptureRequest.findUniqueOrThrow({ where: { id: requestId }, include: { job: true } });
      if (request.job) throw new ConflictException("A capture request with a job cannot be reassigned");
      if (request.status === "cancelled" || request.status === "blocked_recovery") throw new ConflictException("Cancelled or recovery-blocked requests cannot be assigned");
      await this.assertAssignedPrincipalActive(tx, principalId);
      const next = await tx.backupCaptureRequest.update({ where: { id: request.id }, data: { authorizedCoordinatorPrincipalId: principalId } });
      await tx.backupCoordinatorActionLog.create({ data: { principalId: operatorId, action: "backup_capture_coordinator_assigned", requestId: request.id, metadata: { authorizedCoordinatorPrincipalId: principalId, reason } } });
      return next;
    });
  }

  /**
   * Reserved for the future authenticated backup scheduler.  It has no HTTP
   * route: machine authentication and authorization are intentionally added
   * in the coordinator-integration step.  Its durable audit record is kept
   * separate from human AdminActionLog records.
   */
  async authorizeSystemBackupCaptureRequest(principalId: string, requestId: string, reason: string) {
    return this.prisma.db.$transaction(tx =>
      this.authorizeBackupCaptureRequestInTransaction(tx, requestId, { id: principalId, type: "system" }, reason),
    );
  }

  /** Creates one durable schedule occurrence; duplicate occurrences are idempotent. */
  async createBackupCaptureRequest(operatorId: string, input: BackupCaptureRequestInput, reason: string) {
    return this.createBackupCaptureRequestForPrincipal(input, { id: operatorId, type: "admin" }, reason, true);
  }

  /** Internal-only until the future machine-authenticated coordinator exists. */
  async createSystemBackupCaptureRequest(principalId: string, input: BackupCaptureRequestInput, reason: string) {
    return this.createBackupCaptureRequestForPrincipal(input, { id: principalId, type: "system" }, reason, false);
  }

  /**
   * Starts (or resumes) the existing storage-maintenance lifecycle for a
   * durable request. It never fences, disables, releases, or bypasses storage
   * mutation admission. A draining request is advanced only by a later,
   * explicit call after the current admitted operations have completed.
   */
  async advanceBackupCaptureRequest(operatorId: string, requestId: string, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "advance_backup_capture_request", undefined, { requestId, reason }, tx =>
      this.advanceBackupCaptureRequestInTransaction(tx, requestId, { id: operatorId, type: "admin" }, reason),
    );
  }

  /** Internal-only until the future machine-authenticated coordinator exists. */
  async advanceSystemBackupCaptureRequest(principalId: string, requestId: string, reason: string) {
    return this.prisma.db.$transaction(tx =>
      this.advanceBackupCaptureRequestInTransaction(tx, requestId, { id: principalId, type: "system" }, reason),
    );
  }

  async recordCaptureOutcome(operatorId: string, leaseId: string, generation: number, outcome: CaptureOutcome, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "record_storage_capture_outcome", undefined, { leaseId, generation, outcome, reason }, async tx => {
      const state = await this.lockState(tx);
      this.assertCaptureLease(state, leaseId, generation);
      if (state.captureOutcome) throw new ConflictException("Backup capture outcome has already been recorded");
      const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { captureOutcome: outcome, captureOutcomeAt: new Date(), captureOutcomeBy: operatorId, captureOutcomeReason: reason } });
      await this.event(tx, next.generation, "storage_capture_outcome_recorded", operatorId, leaseId, reason, outcome);
      return this.statusFrom(tx, next);
    });
  }

  async releaseCaptureLease(operatorId: string, leaseId: string, generation: number, reason: string) {
    return this.clearCaptureLease(operatorId, leaseId, generation, reason, false);
  }

  /** Failed/uncertain capture releases require an explicit audited recovery action. */
  async recoverCaptureLease(operatorId: string, leaseId: string, generation: number, reason: string) {
    return this.clearCaptureLease(operatorId, leaseId, generation, reason, true);
  }

  /** Fencing is not cancellation. It makes every live lease recoverable, never safe. */
  async fenceOperation(operatorId: string, operationId: string, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "fence_storage_maintenance_worker", undefined, { operationId, reason }, async tx => {
      const state = await this.lockState(tx);
      if (state.mode !== "draining" && state.mode !== "recovery_required") throw new ConflictException("Storage maintenance is not awaiting recovery");
      const operation = await tx.storageMaintenanceOperation.findUnique({ where: { id: operationId } });
      if (!operation || operation.status !== "active") throw new ConflictException("Only an active operation can be fenced");
      const worker = await this.lockWorker(tx, operation.workerId);
      const now = new Date();
      await tx.storageMaintenanceWorker.update({ where: { id: worker.id }, data: { fenceEpoch: { increment: 1 }, fencedAt: worker.fencedAt ?? now, fencedBy: worker.fencedBy ?? operatorId, fencingReason: worker.fencingReason ?? reason } });
      await tx.storageMaintenanceOperation.updateMany({ where: { workerId: worker.id, status: "active" }, data: { status: "fenced", completedAt: now, failureKind: "worker_fenced_reconciliation_required" } });
      const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { mode: "recovery_required", recoveryRequiredAt: now, quiescentAt: null } });
      await this.event(tx, next.generation, "worker_fenced_reconciliation_required", operatorId, operationId, reason);
      return this.statusFrom(tx, next);
    });
  }

  async reconcile(operatorId: string, operationId: string, reason: string, outcome: ReconciliationOutcome) {
    return auditedAdminMutation(this.prisma.db, operatorId, "reconcile_storage_maintenance_operation", undefined, { operationId, reason, outcome }, async tx => {
      const state = await this.lockState(tx);
      if (state.mode !== "recovery_required") throw new ConflictException("Storage maintenance is not awaiting recovery reconciliation");
      const operation = await tx.storageMaintenanceOperation.findUnique({ where: { id: operationId } });
      if (!operation || (operation.status !== "failed" && operation.status !== "fenced")) throw new ConflictException("Only failed or fenced operations are eligible for reconciliation");
      await tx.storageMaintenanceOperation.update({ where: { id: operationId }, data: { status: "reconciled", completedAt: operation.completedAt ?? new Date(), reconciledAt: new Date(), reconciledBy: operatorId, reconciliationReason: reason, reconciliationOutcome: outcome } });
      await this.event(tx, state.generation, "operation_reconciled", operatorId, operationId, reason, outcome);
      return this.statusFrom(tx, state);
    });
  }

  async acknowledgeQuiescent(operatorId: string, reason: string) {
    return auditedAdminMutation(this.prisma.db, operatorId, "acknowledge_storage_maintenance_quiescent", undefined, { reason }, async tx => {
      const state = await this.lockState(tx);
      if (state.mode !== "recovery_required") throw new ConflictException("Recovery acknowledgement is required only after recovery is flagged");
      if (await this.unresolvedCount(tx)) throw new ConflictException("Every active, failed, or fenced storage operation must be reconciled first");
      const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { mode: "quiescent", quiescentAt: new Date() } });
      await this.event(tx, next.generation, "maintenance_quiescent_acknowledged", operatorId, undefined, reason);
      return this.statusFrom(tx, next);
    });
  }

  async status() { return this.statusFrom(this.prisma.db, await this.prisma.db.storageMaintenanceState.findUniqueOrThrow({ where: { id: STATE_ID } })); }

  async assertNewMutationsAllowed() {
    const state = await this.prisma.db.storageMaintenanceState.findUniqueOrThrow({ where: { id: STATE_ID } });
    if (state.mode !== "inactive") throw new ServiceUnavailableException("Storage updates are temporarily unavailable for maintenance");
  }

  private async authorizeBackupCaptureRequestInTransaction(tx: Tx, requestId: string, principal: BackupCapturePrincipal, reason: string) {
    const state = await this.lockState(tx);
    const request = await this.lockBackupCaptureRequest(tx, requestId);

    // A completed authorization is idempotent only while it still owns the
    // same live state lease.  Never create or rebind a second job on retry.
    if (request.status === "ready") {
      const job = await tx.backupCaptureJob.findUnique({ where: { requestId: request.id } });
      if (!job || job.backupClass !== request.backupClass || state.captureJobId !== job.id ||
          state.captureLeaseId !== job.leaseId || state.captureGeneration !== job.leaseGeneration ||
          state.generation !== job.leaseGeneration || !request.authorizedCoordinatorPrincipalId ||
          job.authorizedCoordinatorPrincipalId !== request.authorizedCoordinatorPrincipalId) {
        throw new ConflictException("Backup capture request is ready but its lease/job binding is not current");
      }
      await this.assertAssignedPrincipalActive(tx, request.authorizedCoordinatorPrincipalId);
      return { request, job, leaseId: job.leaseId, generation: job.leaseGeneration, idempotent: true };
    }
    if (request.status !== "pending" && request.status !== "maintenance_draining") {
      throw new ConflictException("Only a pending or fully-drained backup capture request can be authorized");
    }

    await this.assertCaptureAvailable(tx, state);
    if (!request.authorizedCoordinatorPrincipalId) throw new ConflictException("Backup capture request has no assigned coordinator principal");
    await this.assertAssignedPrincipalActive(tx, request.authorizedCoordinatorPrincipalId);
    const leaseId = randomUUID();
    const generation = state.generation;
    const job = await tx.backupCaptureJob.create({ data: {
      requestId: request.id,
      backupClass: request.backupClass,
      authorizedCoordinatorPrincipalId: request.authorizedCoordinatorPrincipalId,
      leaseId,
      leaseGeneration: generation,
      status: "authorized",
    } });
    const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: {
      captureLeaseId: leaseId,
      captureGeneration: generation,
      captureJobId: job.id,
      captureAcquiredAt: new Date(),
      captureAcquiredBy: principal.id,
      captureOutcome: null,
      captureOutcomeAt: null,
      captureOutcomeBy: null,
      captureOutcomeReason: null,
    } });
    const ready = await tx.backupCaptureRequest.update({ where: { id: request.id }, data: { status: "ready" } });
    await this.event(tx, next.generation, "backup_capture_job_authorized", principal.id, leaseId, reason);
    await tx.backupCoordinatorActionLog.create({ data: {
      principalId: principal.id,
      action: "backup_capture_job_authorized",
      requestId: ready.id,
      jobId: job.id,
      leaseId,
      generation,
      metadata: { principalType: principal.type, reason },
    } });
    return { request: ready, job, leaseId, generation, idempotent: false };
  }

  private async createBackupCaptureRequestForPrincipal(input: BackupCaptureRequestInput, principal: BackupCapturePrincipal, reason: string, asAdmin: boolean): Promise<{ request: BackupCaptureRequest; idempotent: boolean }> {
    this.assertBackupCaptureRequestInput(input);
    const create = async (tx: Tx) => {
      const existing = await tx.backupCaptureRequest.findUnique({ where: { scheduleKey_scheduledFor: { scheduleKey: input.scheduleKey, scheduledFor: input.scheduledFor } } });
      if (existing) return this.assertDuplicateRequest(existing, input);
      const request = await tx.backupCaptureRequest.create({ data: { ...input, requestedBy: principal.id, status: "pending" } });
      await tx.backupCoordinatorActionLog.create({ data: {
        principalId: principal.id,
        action: "backup_capture_request_created",
        requestId: request.id,
        metadata: { principalType: principal.type, scheduleKey: input.scheduleKey, backupClass: input.backupClass, reason },
      } });
      return { request, idempotent: false };
    };
    try {
      if (!asAdmin) return await this.prisma.db.$transaction(create);
      return await auditedAdminMutation(this.prisma.db, principal.id, "create_backup_capture_request", undefined, { scheduleKey: input.scheduleKey, scheduledFor: input.scheduledFor.toISOString(), backupClass: input.backupClass, reason }, create);
    } catch (error) {
      if (!this.isUniqueViolation(error)) throw error;
      const request = await this.prisma.db.backupCaptureRequest.findUniqueOrThrow({ where: { scheduleKey_scheduledFor: { scheduleKey: input.scheduleKey, scheduledFor: input.scheduledFor } } });
      return this.assertDuplicateRequest(request, input);
    }
  }

  private async advanceBackupCaptureRequestInTransaction(tx: Tx, requestId: string, principal: BackupCapturePrincipal, reason: string): Promise<any> {
    let state = await this.lockState(tx);
    let request = await this.lockBackupCaptureRequest(tx, requestId);
    if (request.status === "cancelled" || request.status === "blocked_recovery") {
      throw new ConflictException("Cancelled or recovery-blocked backup capture requests require a new scheduled occurrence");
    }
    if (request.status === "ready") return this.authorizeBackupCaptureRequestInTransaction(tx, requestId, principal, reason);

    if (state.mode === "inactive") {
      state = await this.enableMaintenanceInTransaction(tx, principal.id, state);
    }
    if (state.mode === "draining") {
      if (request.status === "pending") {
        request = await tx.backupCaptureRequest.update({ where: { id: request.id }, data: { status: "maintenance_draining" } });
        await this.event(tx, state.generation, "backup_capture_request_draining", principal.id, request.id, reason);
        await tx.backupCoordinatorActionLog.create({ data: { principalId: principal.id, action: "backup_capture_request_draining", requestId: request.id, generation: state.generation, metadata: { principalType: principal.type, reason } } });
      }
      return { request, maintenanceMode: "draining", job: null };
    }
    if (state.mode === "recovery_required") {
      request = await tx.backupCaptureRequest.update({ where: { id: request.id }, data: { status: "blocked_recovery" } });
      await this.event(tx, state.generation, "backup_capture_request_blocked_recovery", principal.id, request.id, reason);
      await tx.backupCoordinatorActionLog.create({ data: { principalId: principal.id, action: "backup_capture_request_blocked_recovery", requestId: request.id, generation: state.generation, metadata: { principalType: principal.type, reason } } });
      return { request, maintenanceMode: "recovery_required", job: null };
    }
    // Quiescence is rechecked by the Step 2 transaction before it creates the job.
    return this.authorizeBackupCaptureRequestInTransaction(tx, requestId, principal, reason);
  }

  private async clearCaptureLease(operatorId: string, leaseId: string, generation: number, reason: string, recovery: boolean) {
    const action = recovery ? "recover_storage_capture_lease" : "release_storage_capture_lease";
    return auditedAdminMutation(this.prisma.db, operatorId, action, undefined, { leaseId, generation, reason }, async tx => {
      const state = await this.lockState(tx);
      this.assertCaptureLease(state, leaseId, generation);
      if (state.captureJobId) throw new ConflictException("A request-bound backup capture job must be finalized by the backup coordinator");
      if (!state.captureOutcome) throw new ConflictException("Record the backup capture outcome before releasing its lease");
      if (recovery ? state.captureOutcome === "succeeded" : state.captureOutcome !== "succeeded") {
        throw new ConflictException(recovery ? "Successful capture must use normal lease release" : "Failed or uncertain capture requires audited recovery");
      }
      const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: {
        captureLeaseId: null,
        captureGeneration: null,
        captureAcquiredAt: null,
        captureAcquiredBy: null,
        captureOutcome: null,
        captureOutcomeAt: null,
        captureOutcomeBy: null,
        captureOutcomeReason: null,
      } });
      await this.event(tx, next.generation, recovery ? "storage_capture_lease_recovered" : "storage_capture_lease_released", operatorId, leaseId, reason);
      return this.statusFrom(tx, next);
    });
  }

  private async enableMaintenanceInTransaction(tx: Tx, operatorId: string, alreadyLocked?: StorageMaintenanceState): Promise<StorageMaintenanceState> {
    const state = alreadyLocked ?? await this.lockState(tx);
    if (state.mode !== "inactive") throw new ConflictException("Storage maintenance is already active or requires recovery");
    const [active, failed, fenced] = await Promise.all([tx.storageMaintenanceOperation.count({ where: { status: "active" } }), tx.storageMaintenanceOperation.count({ where: { status: "failed" } }), tx.storageMaintenanceOperation.count({ where: { status: "fenced" } })]);
    const mode = failed !== 0 || fenced !== 0 ? "recovery_required" : active === 0 ? "quiescent" : "draining";
    const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { mode, generation: { increment: 1 }, activatedAt: new Date(), activatedBy: operatorId, quiescentAt: mode === "quiescent" ? new Date() : null, disabledAt: null, disabledBy: null, recoveryRequiredAt: mode === "recovery_required" ? new Date() : null } });
    await this.event(tx, next.generation, mode === "quiescent" ? "maintenance_quiescent" : mode === "draining" ? "maintenance_draining" : "maintenance_recovery_required", operatorId);
    return next;
  }

  private assertCaptureLease(state: { mode: string; generation: number; captureLeaseId?: string | null; captureGeneration?: number | null; captureOutcome?: string | null }, leaseId: string, generation: number) {
    if (state.mode !== "quiescent" || state.captureLeaseId !== leaseId || state.captureGeneration !== generation || state.generation !== generation) {
      throw new ConflictException("Capture lease is not active for this maintenance generation");
    }
  }

  private async assertCaptureAvailable(tx: Tx, state: { mode: string; captureLeaseId?: string | null; captureJobId?: string | null }) {
    if (state.mode !== "quiescent" || state.captureLeaseId || state.captureJobId || await this.unresolvedCount(tx)) {
      throw new ConflictException("Storage maintenance is not safely available for backup capture");
    }
    const activeJob = await tx.backupCaptureJob.findFirst({ where: { status: { not: "reported" } }, select: { id: true } });
    if (activeJob) throw new ConflictException("An unresolved backup capture job must be recovered first");
  }

  private async assertAssignedPrincipalActive(tx: Tx, principalId: string) {
    const now = new Date();
    const principal = await tx.backupCoordinatorPrincipal.findUnique({ where: { id: principalId }, include: { certificates: { where: { status: "active" } } } });
    if (!principal?.active || !principal.certificates.some(certificate => (!certificate.notBefore || certificate.notBefore <= now) && (!certificate.notAfter || certificate.notAfter > now))) {
      throw new ConflictException("Assigned coordinator principal is unknown, inactive, or has no active certificate");
    }
  }

  private async ensureWorker() {
    this.workerReady ??= this.prisma.db.storageMaintenanceWorker.upsert({ where: { id: this.workerId }, create: { id: this.workerId }, update: { heartbeatAt: new Date(), stoppedAt: null } }).then(() => undefined);
    return this.workerReady;
  }

  private async assertLease(operationId: string) {
    await this.prisma.db.$transaction(async tx => {
      await this.lockState(tx);
      const operation = await tx.storageMaintenanceOperation.findUnique({ where: { id: operationId } });
      if (!operation || operation.status !== "active") throw new ServiceUnavailableException("Storage operation is fenced or no longer active");
      const worker = await this.lockWorker(tx, operation.workerId);
      if (worker.fencedAt || worker.fenceEpoch !== operation.workerFenceEpoch) throw new ServiceUnavailableException("Storage worker lease has been fenced");
      await tx.storageMaintenanceWorker.update({ where: { id: worker.id }, data: { heartbeatAt: new Date() } });
    });
  }

  private async finish(operationId: string, succeeded: boolean, reconciliation?: StorageMutationReconciliationRequiredError): Promise<boolean> {
    return this.prisma.db.$transaction(async tx => {
      const state = await this.lockState(tx);
      const operation = await tx.storageMaintenanceOperation.findUnique({ where: { id: operationId } });
      if (!operation) return false;
      const worker = await this.lockWorker(tx, operation.workerId);
      if (operation.status !== "active" || worker.fencedAt || worker.fenceEpoch !== operation.workerFenceEpoch) {
        if (state.mode !== "recovery_required") {
          const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { mode: "recovery_required", recoveryRequiredAt: new Date(), quiescentAt: null } });
          await this.event(tx, next.generation, "fenced_worker_completion_rejected", undefined, operationId);
        }
        return false;
      }
      await tx.storageMaintenanceOperation.update({ where: { id: operationId }, data: succeeded ? { status: "completed", completedAt: new Date() } : {
        status: "failed",
        completedAt: new Date(),
        failureKind: reconciliation?.failureKind ?? "storage_mutation_failed",
        failureContext: reconciliation?.failureContext,
      } });
      if (!succeeded && state.mode === "draining") {
        await tx.backupCaptureRequest.updateMany({ where: { status: { in: ["pending", "maintenance_draining"] } }, data: { status: "blocked_recovery" } });
        const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { mode: "recovery_required", recoveryRequiredAt: new Date(), quiescentAt: null } });
        await this.event(tx, next.generation, "operation_failed_during_maintenance", undefined, operationId, undefined, "reconciliation_required");
        return true;
      }
      if (succeeded && state.mode === "draining" && (await this.unresolvedCount(tx)) === 0) {
        await tx.backupCaptureRequest.updateMany({ where: { status: "maintenance_draining" }, data: { status: "pending" } });
        const next = await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { mode: "quiescent", quiescentAt: new Date() } });
        await this.event(tx, next.generation, "maintenance_quiescent");
      }
      return true;
    });
  }

  private async unresolvedCount(client: Tx) { return client.storageMaintenanceOperation.count({ where: { status: { in: ["active", "failed", "fenced"] } } }); }

  private async lockState(tx: Tx) {
    await tx.$queryRaw`SELECT "id" FROM "StorageMaintenanceState" WHERE "id" = ${STATE_ID} FOR UPDATE`;
    return tx.storageMaintenanceState.findUniqueOrThrow({ where: { id: STATE_ID } });
  }

  private async lockBackupCaptureRequest(tx: Tx, requestId: string) {
    await tx.$queryRaw`SELECT "id" FROM "BackupCaptureRequest" WHERE "id" = ${requestId} FOR UPDATE`;
    return tx.backupCaptureRequest.findUniqueOrThrow({ where: { id: requestId } });
  }

  private assertBackupCaptureRequestInput(input: BackupCaptureRequestInput) {
    if (!input.scheduleKey.trim() || !["daily", "weekly", "monthly"].includes(input.backupClass) || Number.isNaN(input.scheduledFor.getTime())) {
      throw new ConflictException("A valid backup class, schedule occurrence, and timestamp are required");
    }
  }

  private assertDuplicateRequest(request: BackupCaptureRequest, input: BackupCaptureRequestInput) {
    if (request.backupClass !== input.backupClass) throw new ConflictException("The existing schedule occurrence has a different backup class");
    return { request, idempotent: true };
  }

  private isUniqueViolation(error: unknown) {
    return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2002";
  }

  private async lockWorker(tx: Tx, workerId: string) {
    await tx.$queryRaw`SELECT "id" FROM "StorageMaintenanceWorker" WHERE "id" = ${workerId} FOR UPDATE`;
    return tx.storageMaintenanceWorker.findUniqueOrThrow({ where: { id: workerId } });
  }

  private event(tx: Tx, generation: number, action: string, operatorId?: string, operationId?: string, reason?: string, outcome?: string) { return tx.storageMaintenanceEvent.create({ data: { generation, action, operatorId, operationId, reason, outcome } }); }

  private async statusFrom(client: PrismaDb | Tx, state: { mode: string; generation: number; activatedAt: Date | null; activatedBy: string | null; quiescentAt: Date | null; disabledAt: Date | null; disabledBy: string | null; recoveryRequiredAt: Date | null; captureLeaseId?: string | null; captureGeneration?: number | null; captureJobId?: string | null; captureAcquiredAt?: Date | null; captureAcquiredBy?: string | null; captureOutcome?: string | null; captureOutcomeAt?: Date | null; captureOutcomeBy?: string | null; captureOutcomeReason?: string | null }) {
    const [activeOperations, failedOperations, fencedOperations, recentOperations] = await Promise.all([
      client.storageMaintenanceOperation.count({ where: { status: "active" } }),
      client.storageMaintenanceOperation.count({ where: { status: "failed" } }),
      client.storageMaintenanceOperation.count({ where: { status: "fenced" } }),
      client.storageMaintenanceOperation.findMany({ where: { status: { in: ["active", "failed", "fenced"] } }, select: { id: true, kind: true, status: true, generation: true, startedAt: true, completedAt: true, failureKind: true, failureContext: true, workerId: true, workerFenceEpoch: true }, orderBy: { startedAt: "asc" } }),
    ]);
    return { ...state, activeOperations, failedOperations, fencedOperations, operations: recentOperations, backupSafe: state.mode === "quiescent" && !state.captureLeaseId && !state.captureJobId && activeOperations === 0 && failedOperations === 0 && fencedOperations === 0 };
  }
}
