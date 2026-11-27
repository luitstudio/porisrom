import { ConflictException, ForbiddenException, Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@porisrom/database";

import { auditedAdminMutation } from "../admin/audited-mutation";
import { PrismaService } from "../prisma/prisma.service";

const STATE_ID = "storage";
type Outcome = "succeeded" | "failed" | "uncertain";
type ClaimReference = { jobId: string; leaseId: string; generation: number; backupClass: "daily" | "weekly" | "monthly"; attemptId: string };
type CanonicalPublication = ClaimReference & { manifestSha256: string; manifestFormatVersion: number; canonicalStorageKey: string };

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
  async deliver(principalId: string, backupClass: "daily" | "weekly" | "monthly", limit = 1, recover = false) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 10) throw new ConflictException("Delivery limit must be between 1 and 10");
    return this.prisma.db.$transaction(async tx => {
      const state = await this.lockState(tx);
      await this.assertActivePrincipal(tx, principalId);
      if (state.mode !== "quiescent" || state.captureOutcome || !state.captureJobId || !state.captureLeaseId || state.captureGeneration === null) return { jobs: [] };
      const candidates = await tx.backupCaptureJob.findMany({
        where: { id: state.captureJobId, authorizedCoordinatorPrincipalId: principalId, backupClass, status: { in: recover ? ["claimed"] : ["authorized"] }, resultOutcome: null },
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
        if (request.status !== "ready" || unresolved !== 0 || !this.isLiveBinding(state, job) || job.authorizedCoordinatorPrincipalId !== principalId || job.resultOutcome) continue;
        if (job.status === "claimed") {
          if (job.claimedBy !== principalId || !job.coordinatorAttemptId) continue;
          await this.audit(tx, principalId, "backup_capture_job_delivery_recovered", job, job.leaseGeneration, { deliveryLimit: limit });
          delivered.push({ ...this.view(job, true), delivery: "recovered" });
          continue;
        }
        if (job.status !== "authorized" || job.claimedBy || job.coordinatorAttemptId) continue;
        const next = await tx.backupCaptureJob.update({ where: { id: job.id }, data: { status: "claimed", claimedBy: principalId, coordinatorAttemptId: randomUUID(), claimedAt: new Date() } });
        await this.audit(tx, principalId, "backup_capture_job_delivered", next, next.leaseGeneration, { deliveryLimit: limit });
        delivered.push({ ...this.view(next, false), delivery: "new" });
      }
      return { jobs: delivered };
    });
  }

  async claim(principalId: string, reference: ClaimReference) {
    this.assertReference(reference);
    return this.prisma.db.$transaction(async tx => {
      const { job } = await this.lockAndValidate(tx, reference);
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
      const next = await tx.backupCaptureJob.update({ where: { id: job.id }, data: { status: "reported", resultIdempotencyKey, resultOutcome: outcome, resultReason: reason, resultSetId: resultSetId ?? null, resultManifestSha256: manifestSha256 ? normalizeSha256(manifestSha256) : null, reportedAt: new Date() } });
      await tx.storageMaintenanceState.update({ where: { id: STATE_ID }, data: { captureOutcome: outcome, captureOutcomeAt: new Date(), captureOutcomeBy: principalId, captureOutcomeReason: reason } });
      await tx.storageMaintenanceEvent.create({ data: { generation: state.generation, action: "backup_capture_job_reported", operatorId: principalId, operationId: job.id, reason, outcome } });
      await this.audit(tx, principalId, "backup_capture_job_reported", next, reference.generation, { outcome, resultIdempotencyKey });
      return this.view(next, false);
    });
  }

  /**
   * Publishes the coordinator's candidate artifact as immutable canonical
   * identity. This deliberately does not create verifier evidence or mark an
   * artifact independently verified.
   */
  async publishCanonicalSet(principalId: string, publication: CanonicalPublication) {
    this.assertReference(publication);
    const manifestSha256 = normalizeSha256(publication.manifestSha256);
    if (!Number.isInteger(publication.manifestFormatVersion) || publication.manifestFormatVersion < 1 || !isCanonicalStorageKey(publication.canonicalStorageKey)) {
      throw new ConflictException("Invalid canonical publication descriptor");
    }
    return this.prisma.db.$transaction(async tx => {
      const state = await this.lockState(tx);
      await tx.$queryRaw`SELECT "id" FROM "BackupCaptureJob" WHERE "id" = ${publication.jobId} FOR UPDATE`;
      const job = await tx.backupCaptureJob.findUniqueOrThrow({ where: { id: publication.jobId } });
      await tx.$queryRaw`SELECT "id" FROM "BackupCaptureRequest" WHERE "id" = ${job.requestId} FOR UPDATE`;
      const request = await tx.backupCaptureRequest.findUniqueOrThrow({ where: { id: job.requestId } });
      await this.assertAuthorizedPrincipal(tx, job, principalId);

      if (!this.isLiveBinding(state, job) || request.status !== "ready" ||
          job.leaseId !== publication.leaseId || job.leaseGeneration !== publication.generation ||
          job.backupClass !== publication.backupClass || job.coordinatorAttemptId !== publication.attemptId ||
          job.claimedBy !== principalId || job.status !== "reported" || job.resultOutcome !== "succeeded") {
        throw new ConflictException("Backup capture job is not eligible for canonical publication");
      }
      if (!job.resultSetId || !job.resultManifestSha256 || job.resultSetId !== publication.canonicalStorageKey || job.resultManifestSha256 !== manifestSha256) {
        throw new ConflictException("Canonical publication does not match the recorded capture candidate");
      }

      // The job row serializes first publication. The canonical-set query
      // observes an existing immutable record for idempotent retries.
      await tx.$queryRaw`SELECT "id" FROM "BackupCanonicalSet" WHERE "captureJobId" = ${job.id} FOR UPDATE`;
      const existing = await tx.backupCanonicalSet.findUnique({ where: { captureJobId: job.id } });
      if (existing) {
        if (existing.captureRequestId === job.requestId && existing.captureAttemptId === job.coordinatorAttemptId &&
            existing.leaseId === job.leaseId && existing.generation === job.leaseGeneration &&
            existing.backupClass === job.backupClass && existing.manifestSha256 === manifestSha256 &&
            existing.manifestFormatVersion === publication.manifestFormatVersion && existing.canonicalStorageKey === publication.canonicalStorageKey) {
          return this.canonicalView(existing, true);
        }
        throw new ConflictException("A conflicting canonical set is already published for this capture job");
      }

      const canonical = await tx.backupCanonicalSet.create({
        data: {
          captureJobId: job.id,
          captureRequestId: job.requestId,
          captureAttemptId: job.coordinatorAttemptId,
          leaseId: job.leaseId,
          generation: job.leaseGeneration,
          backupClass: job.backupClass,
          manifestSha256,
          manifestFormatVersion: publication.manifestFormatVersion,
          canonicalStorageKey: publication.canonicalStorageKey,
        },
      });
      await this.audit(tx, principalId, "backup_canonical_set_published", job, publication.generation, { canonicalSetId: canonical.id, manifestSha256, manifestFormatVersion: publication.manifestFormatVersion, canonicalStorageKey: publication.canonicalStorageKey });
      // This is the transactional verifier-dispatch intent.  It is committed
      // with immutable publication, so a crash cannot lose or fabricate work.
      await tx.$executeRaw`INSERT INTO "BackupWorkflowOutbox" ("id","eventType","aggregateId","payload","deduplicationKey")
        VALUES (${`outbox:canonical:${canonical.id}`}, 'backup.canonical-published', ${canonical.id}, ${JSON.stringify({ canonicalSetId: canonical.id, captureJobId: job.id, captureRequestId: job.requestId, captureAttemptId: job.coordinatorAttemptId, leaseId: job.leaseId, generation: job.leaseGeneration, backupClass: job.backupClass, manifestSha256: canonical.manifestSha256, manifestFormatVersion: canonical.manifestFormatVersion, canonicalStorageKey: canonical.canonicalStorageKey })}::jsonb, ${canonical.id})`;
      await this.audit(tx, principalId, "backup_verifier_notification_pending", job, publication.generation, { canonicalSetId: canonical.id });
      return this.canonicalView(canonical, false);
    });
  }

  /** Only a successful, acknowledged capture may clear its exact active lease. */
  async finalize(principalId: string, reference: ClaimReference) {
    this.assertReference(reference);
    return this.prisma.db.$transaction(async tx => {
      const state = await this.lockState(tx);
      await tx.$queryRaw`SELECT "id" FROM "BackupCaptureJob" WHERE "id" = ${reference.jobId} FOR UPDATE`;
      const job = await tx.backupCaptureJob.findUniqueOrThrow({ where: { id: reference.jobId } });
      await tx.$queryRaw`SELECT "id" FROM "BackupCaptureRequest" WHERE "id" = ${job.requestId} FOR UPDATE`;
      const request = await tx.backupCaptureRequest.findUniqueOrThrow({ where: { id: job.requestId } });
      await this.assertAuthorizedPrincipal(tx, job, principalId);
      if (request.status !== "ready" || job.leaseId !== reference.leaseId || job.leaseGeneration !== reference.generation || job.backupClass !== reference.backupClass || job.coordinatorAttemptId !== reference.attemptId || job.claimedBy !== principalId) throw new ConflictException("Backup capture job is not finalizable");
      if (job.status === "finalized" && !state.captureJobId && !state.captureLeaseId && !state.captureGeneration) return { ...this.view(job, true), finalized: true };
      // A coordinator never clears a successful lease.  The restricted Step 6
      // finalizer does so only after it locks and validates authenticated v2
      // evidence in the same transaction.
      throw new ConflictException("Verified evidence finalization is pending");
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

  private canonicalView(canonical: any, idempotent: boolean) {
    return {
      canonicalSetId: canonical.id,
      jobId: canonical.captureJobId,
      requestId: canonical.captureRequestId,
      attemptId: canonical.captureAttemptId,
      leaseId: canonical.leaseId,
      generation: canonical.generation,
      backupClass: canonical.backupClass,
      manifestSha256: canonical.manifestSha256,
      manifestFormatVersion: canonical.manifestFormatVersion,
      canonicalStorageKey: canonical.canonicalStorageKey,
      publishedAt: canonical.publishedAt,
      idempotent,
    };
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

function normalizeSha256(value: string) {
  const normalized = value.toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new ConflictException("Manifest digest must be a SHA-256 value");
  return normalized;
}

function isCanonicalStorageKey(value: string) {
  return /^backup-canonical\/[A-Za-z0-9][A-Za-z0-9._/-]{0,511}$/.test(value) && !value.includes("..") && !value.includes("\\");
}
