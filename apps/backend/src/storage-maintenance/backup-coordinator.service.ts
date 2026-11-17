import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@porisrom/database";

import { auditedAdminMutation } from "../admin/audited-mutation";
import { PrismaService } from "../prisma/prisma.service";

const STATE_ID = "storage";
type Outcome = "succeeded" | "failed" | "uncertain";
type ClaimReference = { jobId: string; leaseId: string; generation: number; backupClass: "daily" | "weekly" | "monthly"; attemptId: string };

@Injectable()
export class BackupCoordinatorService {
  constructor(private readonly prisma: PrismaService) {}

  async createPrincipal(adminId: string, id: string, name: string) {
    return auditedAdminMutation(this.prisma.db, adminId, "create_backup_coordinator_principal", undefined, { id, name }, async tx =>
      tx.backupCoordinatorPrincipal.create({ data: { id, name } }),
    );
  }

  async addCertificate(adminId: string, principalId: string, fingerprint: string, notBefore?: Date, notAfter?: Date) {
    const normalized = normalizeFingerprint(fingerprint);
    return auditedAdminMutation(this.prisma.db, adminId, "add_backup_coordinator_certificate", undefined, { principalId, fingerprint: normalized }, async tx =>
      tx.backupCoordinatorCertificate.create({ data: { principalId, fingerprint: normalized, notBefore, notAfter } }),
    );
  }

  async revokeCertificate(adminId: string, fingerprint: string, reason: string) {
    const normalized = normalizeFingerprint(fingerprint);
    return auditedAdminMutation(this.prisma.db, adminId, "revoke_backup_coordinator_certificate", undefined, { fingerprint: normalized, reason }, async tx =>
      tx.backupCoordinatorCertificate.update({ where: { fingerprint: normalized }, data: { status: "revoked", revokedAt: new Date(), revokedBy: adminId, revokeReason: reason } }),
    );
  }

  /**
   * Atomically delivers at most one current capture job.  The singleton state
   * lease means no later job can be eligible while this job is live; `limit`
   * remains bounded for a stable forward-compatible discovery contract.
   */
  async deliver(principalId: string, limit = 1) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ConflictException("Delivery limit must be between 1 and 10");
    return this.prisma.db.$transaction(async tx => {
      const state = await this.lockState(tx);
      await this.assertActivePrincipal(tx, principalId);
      if (state.mode !== "quiescent" || state.captureOutcome || !state.captureJobId || !state.captureLeaseId || state.captureGeneration === null) return { jobs: [] };
      const candidates = await tx.backupCaptureJob.findMany({
        where: { id: state.captureJobId, authorizedCoordinatorPrincipalId: principalId, status: "authorized", claimedBy: null, coordinatorAttemptId: null, resultOutcome: null },
        orderBy: [{ authorizedAt: "asc" }, { id: "asc" }],
        take: limit,
      });
      const delivered = [];
      for (const candidate of candidates) {
        await tx.$queryRaw`SELECT "id" FROM "BackupCaptureJob" WHERE "id" = ${candidate.id} FOR UPDATE`;
        const job = await tx.backupCaptureJob.findUniqueOrThrow({ where: { id: candidate.id } });
        await tx.$queryRaw`SELECT "id" FROM "BackupCaptureRequest" WHERE "id" = ${job.requestId} FOR UPDATE`;
        const request = await tx.backupCaptureRequest.findUniqueOrThrow({ where: { id: job.requestId } });
        const unresolved = await tx.storageMaintenanceOperation.count({ where: { status: { in: ["active", "failed", "fenced"] } } });
        if (request.status !== "ready" || unresolved !== 0 || !this.isLiveBinding(state, job) ||
            job.authorizedCoordinatorPrincipalId !== principalId || job.status !== "authorized" || job.claimedBy || job.coordinatorAttemptId || job.resultOutcome) continue;
        const next = await tx.backupCaptureJob.update({ where: { id: job.id }, data: { status: "claimed", claimedBy: principalId, coordinatorAttemptId: randomUUID(), claimedAt: new Date() } });
        await this.audit(tx, principalId, "backup_capture_job_delivered", next, next.leaseGeneration, { deliveryLimit: limit });
        delivered.push(this.view(next, false));
      }
      return { jobs: delivered };
    });
  }

  async claim(principalId: string, reference: ClaimReference) {
    this.assertReference(reference);
    return this.prisma.db.$transaction(async tx => {
      const { state, job } = await this.lockAndValidate(tx, reference);
      await this.assertAuthorizedPrincipal(tx, job, principalId);
      if (job.status === "claimed" || job.status === "running") {
        if (job.claimedBy === principalId && job.coordinatorAttemptId === reference.attemptId) return this.view(job, true);
        throw new ConflictException("Backup capture job is already claimed");
      }
      if (job.status !== "authorized" || job.claimedBy || job.coordinatorAttemptId || job.resultOutcome) throw new ConflictException("Backup capture job is not claimable");
      const next = await tx.backupCaptureJob.update({ where: { id: job.id }, data: { status: "claimed", claimedBy: principalId, coordinatorAttemptId: reference.attemptId, claimedAt: new Date() } });
      await this.audit(tx, principalId, "backup_capture_job_claimed", next, reference.generation);
      return this.view(next, false);
    });
  }

  async validate(principalId: string, reference: ClaimReference) {
    this.assertReference(reference);
    return this.prisma.db.$transaction(async tx => {
      const { job } = await this.lockAndValidate(tx, reference);
      await this.assertAuthorizedPrincipal(tx, job, principalId);
      this.assertClaim(job, principalId, reference.attemptId);
      if (job.status !== "claimed" && job.status !== "running") throw new ConflictException("Backup capture job is not executable");
      const next = job.status === "running" ? job : await tx.backupCaptureJob.update({ where: { id: job.id }, data: { status: "running" } });
      await this.audit(tx, principalId, "backup_capture_job_validated", next, reference.generation);
      return this.view(next, false);
    });
  }

  async report(principalId: string, reference: ClaimReference, outcome: Outcome, resultIdempotencyKey: string, reason: string, resultSetId?: string, manifestSha256?: string) {
    this.assertReference(reference);
    if (!resultIdempotencyKey || !reason.trim()) throw new ConflictException("Result idempotency key and sanitized outcome reason are required");
    return this.prisma.db.$transaction(async tx => {
      const { state, job } = await this.lockAndValidate(tx, reference, true);
      await this.assertAuthorizedPrincipal(tx, job, principalId);
      this.assertClaim(job, principalId, reference.attemptId);
      if (job.resultIdempotencyKey) {
        if (job.resultIdempotencyKey === resultIdempotencyKey && job.resultOutcome === outcome) return this.view(job, true);
        throw new ConflictException("Backup capture result has already been reported");
      }
      if (job.status !== "claimed" && job.status !== "running") throw new ConflictException("Backup capture job is not reportable");
      const next = await tx.backupCaptureJob.update({ where: { id: job.id }, data: { status: "reported", resultIdempotencyKey, resultOutcome: outcome, resultReason: reason, resultSetId: resultSetId ?? null, resultManifestSha256: manifestSha256 ?? null, reportedAt: new Date() } });
      await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { captureOutcome: outcome, captureOutcomeAt: new Date(), captureOutcomeBy: principalId, captureOutcomeReason: reason } });
      await tx.storageMaintenanceEvent.create({ data: { generation: state.generation, action: "backup_capture_job_reported", operatorId: principalId, operationId: job.id, reason, outcome } });
      await this.audit(tx, principalId, "backup_capture_job_reported", next, reference.generation, { outcome, resultIdempotencyKey });
      return this.view(next, false);
    });
  }

  async status(principalId: string, jobId: string) {
    return this.prisma.db.$transaction(async tx => {
      const job = await tx.backupCaptureJob.findUnique({ where: { id: jobId } });
      if (!job) throw new ForbiddenException("Coordinator may read only its assigned job");
      await this.assertAuthorizedPrincipal(tx, job, principalId);
      await this.audit(tx, principalId, "backup_capture_job_status_read", job, job.leaseGeneration);
      return this.view(job, true);
    });
  }

  private async lockState(tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT "id" FROM "StorageMaintenanceState" WHERE "id" = ${STATE_ID} FOR UPDATE`;
    return tx.storageMaintenanceState.findUniqueOrThrow({ where: { id: STATE_ID } });
  }

  private async lockAndValidate(tx: Prisma.TransactionClient, reference: ClaimReference, allowRecordedOutcome = false) {
    const state = await this.lockState(tx);
    await tx.$queryRaw`SELECT "id" FROM "BackupCaptureJob" WHERE "id" = ${reference.jobId} FOR UPDATE`;
    const job = await tx.backupCaptureJob.findUniqueOrThrow({ where: { id: reference.jobId } });
    const unresolved = await tx.storageMaintenanceOperation.count({ where: { status: { in: ["active", "failed", "fenced"] } } });
    if (state.mode !== "quiescent" || (!allowRecordedOutcome && state.captureOutcome) || unresolved !== 0 || !this.isLiveBinding(state, job) || job.leaseId !== reference.leaseId || job.leaseGeneration !== reference.generation || job.backupClass !== reference.backupClass) {
      throw new ConflictException("Backup capture lease binding is no longer valid");
    }
    return { state, job };
  }

  private assertClaim(job: { claimedBy: string | null; coordinatorAttemptId: string | null }, principalId: string, attemptId: string) {
    if (job.claimedBy !== principalId || job.coordinatorAttemptId !== attemptId) throw new ForbiddenException("Backup capture job claim binding is invalid");
  }

  private async assertAuthorizedPrincipal(tx: Prisma.TransactionClient, job: { authorizedCoordinatorPrincipalId: string | null }, principalId: string) {
    if (!job.authorizedCoordinatorPrincipalId || job.authorizedCoordinatorPrincipalId !== principalId) {
      throw new ForbiddenException("Coordinator may operate only its assigned job");
    }
    await this.assertActivePrincipal(tx, principalId);
  }

  private async assertActivePrincipal(tx: Prisma.TransactionClient, principalId: string) {
    const now = new Date();
    const principal = await tx.backupCoordinatorPrincipal.findUnique({ where: { id: principalId }, include: { certificates: { where: { status: "active" } } } });
    if (!principal?.active || !principal.certificates.some(certificate => (!certificate.notBefore || certificate.notBefore <= now) && (!certificate.notAfter || certificate.notAfter > now))) {
      throw new ForbiddenException("Coordinator principal is inactive or has no active certificate");
    }
  }

  private isLiveBinding(state: { captureLeaseId: string | null; captureGeneration: number | null; generation: number; captureJobId: string | null }, job: { id: string; leaseId: string; leaseGeneration: number }) {
    return state.captureLeaseId === job.leaseId && state.captureGeneration === job.leaseGeneration && state.generation === job.leaseGeneration && state.captureJobId === job.id;
  }

  private async audit(tx: Prisma.TransactionClient, principalId: string, action: string, job: { id: string; requestId: string; leaseId: string }, generation: number, metadata?: Prisma.InputJsonValue) {
    await tx.backupCoordinatorActionLog.create({ data: { principalId, action, requestId: job.requestId, jobId: job.id, leaseId: job.leaseId, generation, metadata } });
  }

  private view(job: any, idempotent: boolean) {
    return { jobId: job.id, leaseId: job.leaseId, generation: job.leaseGeneration, backupClass: job.backupClass, status: job.status, attemptId: job.coordinatorAttemptId, outcome: job.resultOutcome, idempotent };
  }

  private assertReference(reference: ClaimReference) {
    if (!reference.jobId || !reference.leaseId || !Number.isInteger(reference.generation) || reference.generation < 1 || !["daily", "weekly", "monthly"].includes(reference.backupClass) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference.attemptId)) {
      throw new ConflictException("Invalid backup capture job reference");
    }
  }
}

export function normalizeFingerprint(value: string) {
  const normalized = value.replace(/:/g, "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new ConflictException("Certificate fingerprint must be a SHA-256 value");
  return normalized;
}
