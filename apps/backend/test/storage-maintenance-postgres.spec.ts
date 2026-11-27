import { createRequire } from "node:module";
import { resolve } from "node:path";
import { PrismaClient } from "@porisrom/database";
import { ConfigService } from "@nestjs/config";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { auditedAdminMutation } from "../src/admin/audited-mutation";
import { LocalDocumentStorage } from "../src/document-storage";
import { CompanyDocumentService } from "../src/profiles/company-document.service";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";
import { ProfilePhotoStorageService } from "../src/profiles/profile-photo-storage.service";
import { StorageMutationCoordinator, StorageMutationReconciliationRequiredError } from "../src/storage-maintenance/storage-mutation-coordinator.service";
import { BackupCoordinatorService } from "../src/storage-maintenance/backup-coordinator.service";

const url = process.env.PORISROM_STORAGE_MAINTENANCE_TEST_DATABASE_URL;
const adminId = "storage-it-admin"; const adminTwoId = "storage-it-admin-two"; const clientId = "storage-it-client";
describe.skipIf(!url)("isolated PostgreSQL 18.2 storage maintenance", () => {
  let first: PrismaClient; let second: PrismaClient; let a: StorageMutationCoordinator; let b: StorageMutationCoordinator; let backupCoordinator: BackupCoordinatorService;
  let configuredUrl: URL;
  const localConfig = () => new ConfigService({ KYC_LOCAL_FALLBACK_ENABLED: "true", NODE_ENV: "test", PRIVATE_DOCUMENT_UPLOAD_DIR: process.env.PRIVATE_DOCUMENT_UPLOAD_DIR, KYC_DOCUMENT_UPLOAD_DIR: process.env.KYC_DOCUMENT_UPLOAD_DIR, PROFILE_PHOTO_UPLOAD_DIR: process.env.PROFILE_PHOTO_UPLOAD_DIR, CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "", BACKEND_PUBLIC_URL: "http://storage-it.test" });
  const client = (connectionString: string) => {
    const PrismaPg = createRequire(resolve(process.cwd(), "../../packages/database/package.json"))("@prisma/adapter-pg").PrismaPg;
    return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
  };
  const deferred = <T = void>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; }); return { promise, resolve, reject }; };

  beforeAll(async () => {
    configuredUrl = new URL(url!);
    if (configuredUrl.hostname !== "127.0.0.1" || !configuredUrl.pathname.endsWith("_test")) throw Error("Storage integration tests require generated loopback _test database");
    first = client(url!); second = client(url!); await Promise.all([first.$connect(), second.$connect()]);
    a = new StorageMutationCoordinator({ db: first } as never); b = new StorageMutationCoordinator({ db: second } as never);
    backupCoordinator = new BackupCoordinatorService({ db: first } as never);
    await first.user.createMany({ data: [
      { id: adminId, name: "Storage IT admin", email: "storage-it-admin@example.test", passwordHash: "x", role: "admin", status: "active" },
      { id: adminTwoId, name: "Storage IT admin two", email: "storage-it-admin-two@example.test", passwordHash: "x", role: "admin", status: "active" },
      { id: clientId, name: "Storage IT client", email: "storage-it-client@example.test", passwordHash: "x", role: "client", status: "active" },
    ], skipDuplicates: true });
  });

  beforeEach(async () => {
    await first.user.updateMany({ where: { id: { in: [adminId, adminTwoId] } }, data: { status: "active" } });
    await first.storageMaintenanceState.update({ where: { id: "storage" }, data: { captureJobId: null, captureLeaseId: null, captureGeneration: null, captureAcquiredAt: null, captureAcquiredBy: null, captureOutcome: null, captureOutcomeAt: null, captureOutcomeBy: null, captureOutcomeReason: null } });
    await first.backupCoordinatorActionLog.deleteMany(); await first.backupCaptureJob.deleteMany(); await first.backupCaptureRequest.deleteMany();
    await first.backupCoordinatorCertificate.deleteMany(); await first.backupCoordinatorPrincipal.deleteMany();
    await first.backupCoordinatorPrincipal.create({ data: { id: "backup-vps", name: "Backup VPS" } });
    await first.backupCoordinatorCertificate.create({ data: { principalId: "backup-vps", fingerprint: "b".repeat(64) } });
    await first.storageMaintenanceOperation.deleteMany(); await first.storageMaintenanceEvent.deleteMany(); await first.adminActionLog.deleteMany();
    await first.companyDocument.deleteMany(); await first.companyProfile.deleteMany({ where: { userId: clientId } }); await first.freelancerProfile.deleteMany({ where: { userId: clientId } });
    await first.storageMaintenanceState.update({ where: { id: "storage" }, data: { mode: "inactive", generation: 0, activatedAt: null, activatedBy: null, quiescentAt: null, disabledAt: null, disabledBy: null, recoveryRequiredAt: null, captureLeaseId: null, captureGeneration: null, captureJobId: null, captureAcquiredAt: null, captureAcquiredBy: null, captureOutcome: null, captureOutcomeAt: null, captureOutcomeBy: null, captureOutcomeReason: null } });
    // Each integration case represents a fresh backend process. A worker that
    // was deliberately fenced in another case must never be reused.
    a = new StorageMutationCoordinator({ db: first } as never);
    b = new StorageMutationCoordinator({ db: second } as never);
    backupCoordinator = new BackupCoordinatorService({ db: first } as never);
  });

  afterAll(async () => { await Promise.all([first.$disconnect(), second.$disconnect()]); });
  const quiescent = () => a.enable(adminId);
  const assign = (requestId: string) => a.assignBackupCaptureCoordinator(adminId, requestId, "backup-vps", "integration assignment");

  it("serializes mutation admission racing maintenance activation", async () => {
    const entered = deferred(); const finish = deferred();
    const mutation = a.run("profile_photo", async lease => { await lease.assertNotFenced(); entered.resolve(); await finish.promise; });
    await entered.promise;
    const activation = b.enable(adminTwoId);
    finish.resolve();
    await Promise.all([mutation, activation]);
    await expect(a.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
  });

  it("serializes concurrent completion and refuses a new mutation after activation", async () => {
    const one = deferred(); const two = deferred();
    const firstOp = a.run("identity_document", async () => one.promise); const secondOp = b.run("company_document", async () => two.promise);
    await expect.poll(async () => first.storageMaintenanceOperation.count({ where: { status: "active" } })).toBe(2);
    await a.enable(adminId); one.resolve(); two.resolve(); await Promise.all([firstOp, secondOp]);
    await expect(b.run("profile_photo", async () => undefined)).rejects.toMatchObject({ status: 503 });
    await expect(a.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
  });

  it("fences a live worker: an already-dispatched action may finish, but no later action, completion, or backup safety is allowed", async () => {
    const dispatched = deferred(); const continueAfterFence = deferred(); let afterFenceStarted = false;
    const op = a.run("company_document", async lease => { await lease.assertNotFenced(); dispatched.resolve(); await continueAfterFence.promise; await lease.assertNotFenced(); afterFenceStarted = true; });
    await dispatched.promise; await b.enable(adminTwoId);
    const active = await first.storageMaintenanceOperation.findFirstOrThrow({ where: { status: "active" } });
    await b.fenceOperation(adminTwoId, active.id, "provider request already dispatched");
    continueAfterFence.resolve(); await expect(op).rejects.toMatchObject({ status: 503 });
    expect(afterFenceStarted).toBe(false);
    await expect(a.status()).resolves.toMatchObject({ mode: "recovery_required", backupSafe: false, fencedOperations: 1 });
    await b.reconcile(adminTwoId, active.id, "provider state inspected", "provider_reconciled");
    await b.acknowledgeQuiescent(adminTwoId, "fenced provider reconciled");
  });

  it("persists outstanding work across coordinator restart and rejects stale worker completion", async () => {
    const pending = deferred(); const old = a.run("profile_photo", async () => pending.promise);
    await expect.poll(async () => first.storageMaintenanceOperation.count({ where: { status: "active" } })).toBe(1);
    await b.enable(adminTwoId); const active = await first.storageMaintenanceOperation.findFirstOrThrow({ where: { status: "active" } });
    const restarted = new StorageMutationCoordinator({ db: second } as never);
    await restarted.fenceOperation(adminTwoId, active.id, "backend restart cannot prove provider cancellation");
    pending.resolve(); await expect(old).rejects.toMatchObject({ status: 503 });
    await expect(restarted.status()).resolves.toMatchObject({ backupSafe: false, fencedOperations: 1 });
  });

  it("fails a real profile-photo operation after database update failure and compensates its local asset", async () => {
    await first.freelancerProfile.create({ data: { userId: clientId } });
    const failingDb = new Proxy(first, { get(target, property, receiver) {
      if (property !== "freelancerProfile") return Reflect.get(target, property, receiver);
      return new Proxy(target.freelancerProfile, { get(model, method, modelReceiver) { return method === "update" ? async () => { throw new Error("profile database update failed"); } : Reflect.get(model, method, modelReceiver); } });
    } });
    const photos = new ProfilePhotoStorageService(localConfig());
    const profiles = new FreelancerProfileService({ db: failingDb } as never, photos, a);
    const photo = profiles.uploadProfilePhoto(clientId, { size: 4, buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]), mimetype: "image/jpeg" } as Express.Multer.File);
    await expect(photo).rejects.toThrow("profile database update failed");
    await expect(a.status()).resolves.toMatchObject({ failedOperations: 1, backupSafe: false });
    await first.storageMaintenanceOperation.deleteMany();
    await first.companyProfile.create({ data: { userId: clientId, companyName: "IT Company" } });
    const documents = new CompanyDocumentService({ db: first } as never, localConfig(), a);
    const pdf = { fieldname: "certificate", originalname: "it.pdf", encoding: "7bit", mimetype: "application/pdf", size: 12, buffer: Buffer.from("%PDF-1.4\nEOF") } as Express.Multer.File;
    await documents.uploadForClient(clientId, { certificate: [pdf] });
    const remove = vi.spyOn(LocalDocumentStorage.prototype, "remove").mockRejectedValueOnce(new Error("local cleanup failed"));
    try { await expect(documents.uploadForClient(clientId, { certificate: [pdf] })).rejects.toBeInstanceOf(StorageMutationReconciliationRequiredError); }
    finally { remove.mockRestore(); }
    await a.enable(adminId);
    await expect(a.status()).resolves.toMatchObject({ mode: "recovery_required", backupSafe: false, operations: expect.arrayContaining([expect.objectContaining({ failureKind: "company_document_old_cleanup_uncertain" })]) });
  });

  it("serializes capture lease acquisition, blocks disable, persists across restart, and requires outcome/recovery", async () => {
    await quiescent();
    const attempts = await Promise.allSettled([a.acquireCaptureLease(adminId, "capture"), b.acquireCaptureLease(adminTwoId, "capture")]);
    const acquired = attempts.find((result): result is PromiseFulfilledResult<any> => result.status === "fulfilled")!.value;
    await expect(a.disable(adminId, "blocked during capture")).rejects.toMatchObject({ status: 409 });
    const restarted = new StorageMutationCoordinator({ db: second } as never);
    await expect(restarted.status()).resolves.toMatchObject({ captureLeaseId: acquired.captureLeaseId, backupSafe: false });
    await expect(restarted.recordCaptureOutcome(adminTwoId, acquired.captureLeaseId, acquired.captureGeneration + 1, "failed", "wrong generation")).rejects.toMatchObject({ status: 409 });
    await restarted.recordCaptureOutcome(adminTwoId, acquired.captureLeaseId, acquired.captureGeneration, "failed", "backup crashed");
    await expect(restarted.releaseCaptureLease(adminTwoId, acquired.captureLeaseId, acquired.captureGeneration, "unsafe")).rejects.toMatchObject({ status: 409 });
    await restarted.recoverCaptureLease(adminTwoId, acquired.captureLeaseId, acquired.captureGeneration, "incident reviewed");
  });

  it("rolls back audited state mutation and audit log together", async () => {
    await expect(auditedAdminMutation(first as never, adminId, "storage_it_rollback", undefined, undefined, async tx => {
      await tx.storageMaintenanceState.update({ where: { id: "storage" }, data: { mode: "quiescent" } });
      throw new Error("force rollback");
    })).rejects.toThrow("force rollback");
    await expect(first.storageMaintenanceState.findUniqueOrThrow({ where: { id: "storage" } })).resolves.toMatchObject({ mode: "inactive" });
    await expect(first.adminActionLog.count({ where: { action: "storage_it_rollback" } })).resolves.toBe(0);
  });

  async function request(id: string, backupClass: "daily" | "weekly" | "monthly" = "daily") {
    return first.backupCaptureRequest.create({ data: { id, scheduleKey: `schedule-${id}`, scheduledFor: new Date(`2026-11-16T00:00:00.${id.length.toString().padStart(3, "0")}Z`), backupClass, authorizedCoordinatorPrincipalId: "backup-vps" } });
  }

  function failingCoordinator(model: "backupCaptureRequest" | "backupCaptureJob" | "storageMaintenanceState" | "backupCoordinatorActionLog" | "adminActionLog") {
    const db = new Proxy(first as any, { get(target, property, receiver) {
      if (property !== "$transaction") return Reflect.get(target, property, receiver);
      return async (callback: (tx: any) => Promise<unknown>) => target.$transaction(async (actualTx: any) => callback(new Proxy(actualTx, { get(txTarget, txProperty, txReceiver) {
        const value = Reflect.get(txTarget, txProperty, txReceiver);
        if (txProperty !== model) return value;
        return new Proxy(value, { get(modelTarget, method, modelReceiver) {
          if (method === "create" || (model === "storageMaintenanceState" && method === "update")) return async () => { throw new Error(`${model} injected failure`); };
          return Reflect.get(modelTarget, method, modelReceiver);
        } });
      } })));
    } });
    return new StorageMutationCoordinator({ db } as never);
  }

  it("audits a valid assignment and atomically binds the assigned principal to its job", async () => {
    const assigned = await first.backupCaptureRequest.create({ data: { id: "assignment-audit", scheduleKey: "assignment-audit", scheduledFor: new Date("2026-11-16T08:00:00.000Z"), backupClass: "daily" } });
    await a.assignBackupCaptureCoordinator(adminId, assigned.id, "backup-vps", "approved coordinator");
    await quiescent();
    const authorized = await a.authorizeBackupCaptureRequest(adminId, assigned.id, "authorize assigned coordinator");
    const [requestAfter, job, state] = await Promise.all([
      first.backupCaptureRequest.findUniqueOrThrow({ where: { id: assigned.id } }),
      first.backupCaptureJob.findUniqueOrThrow({ where: { id: authorized.job.id } }),
      first.storageMaintenanceState.findUniqueOrThrow({ where: { id: "storage" } }),
    ]);
    expect(job.authorizedCoordinatorPrincipalId).toBe(requestAfter.authorizedCoordinatorPrincipalId);
    expect(state).toMatchObject({ captureJobId: job.id, captureLeaseId: job.leaseId, captureGeneration: job.leaseGeneration });
    await expect(first.backupCoordinatorActionLog.count({ where: { requestId: assigned.id, action: { in: ["backup_capture_coordinator_assigned", "backup_capture_job_authorized"] } } })).resolves.toBe(2);
  });

  it("rejects unknown, inactive, revoked, expired, not-yet-valid, and certificate-less assignment principals", async () => {
    const assigned = await first.backupCaptureRequest.create({ data: { id: "invalid-principals", scheduleKey: "invalid-principals", scheduledFor: new Date("2026-11-16T08:01:00.000Z"), backupClass: "daily" } });
    await first.backupCoordinatorPrincipal.createMany({ data: [
      { id: "inactive-principal", name: "Inactive", active: false },
      { id: "revoked-principal", name: "Revoked" },
      { id: "expired-principal", name: "Expired" },
      { id: "future-principal", name: "Future" },
      { id: "no-certificate-principal", name: "No certificate" },
    ] });
    await first.backupCoordinatorCertificate.createMany({ data: [
      { principalId: "inactive-principal", fingerprint: "1".repeat(64) },
      { principalId: "revoked-principal", fingerprint: "2".repeat(64), status: "revoked" },
      { principalId: "expired-principal", fingerprint: "3".repeat(64), notAfter: new Date("2020-01-01T00:00:00.000Z") },
      { principalId: "future-principal", fingerprint: "4".repeat(64), notBefore: new Date("2100-01-01T00:00:00.000Z") },
    ] });
    for (const principalId of ["missing-principal", "inactive-principal", "revoked-principal", "expired-principal", "future-principal", "no-certificate-principal"]) {
      await expect(a.assignBackupCaptureCoordinator(adminId, assigned.id, principalId, "must reject")).rejects.toMatchObject({ status: 409 });
    }
    await expect(first.backupCaptureRequest.findUniqueOrThrow({ where: { id: assigned.id } })).resolves.toMatchObject({ authorizedCoordinatorPrincipalId: null });
    await expect(first.backupCoordinatorActionLog.count({ where: { requestId: assigned.id } })).resolves.toBe(0);
  });

  it("rechecks admin and assigned-principal activity, serializes assignment/authorization, and rejects mismatched retry bindings", async () => {
    const requestId = "assignment-race";
    await first.backupCaptureRequest.create({ data: { id: requestId, scheduleKey: requestId, scheduledFor: new Date("2026-11-16T08:02:00.000Z"), backupClass: "daily" } });
    await quiescent();
    const raced = await Promise.allSettled([
      a.assignBackupCaptureCoordinator(adminId, requestId, "backup-vps", "race assignment"),
      b.authorizeBackupCaptureRequest(adminTwoId, requestId, "race authorization"),
    ]);
    expect(raced.filter(result => result.status === "rejected").length).toBeLessThanOrEqual(1);
    const authorized = await a.authorizeBackupCaptureRequest(adminId, requestId, "post-race retry");
    await expect(first.backupCaptureJob.count({ where: { requestId } })).resolves.toBe(1);
    await first.backupCoordinatorPrincipal.update({ where: { id: "backup-vps" }, data: { active: false } });
    await expect(b.authorizeBackupCaptureRequest(adminTwoId, requestId, "inactive retry")).rejects.toMatchObject({ status: 409 });
    await first.backupCoordinatorPrincipal.update({ where: { id: "backup-vps" }, data: { active: true } });
    await first.backupCoordinatorPrincipal.create({ data: { id: "backup-vps-other", name: "Other Backup VPS" } });
    await first.backupCoordinatorCertificate.create({ data: { principalId: "backup-vps-other", fingerprint: "5".repeat(64) } });
    await first.backupCaptureJob.update({ where: { id: authorized.job.id }, data: { authorizedCoordinatorPrincipalId: "backup-vps-other" } });
    await expect(a.authorizeBackupCaptureRequest(adminId, requestId, "mismatched binding retry")).rejects.toMatchObject({ status: 409 });
    await expect(first.backupCaptureJob.count({ where: { requestId } })).resolves.toBe(1);
    const assignmentAuditsBefore = await first.adminActionLog.count({ where: { action: "assign_backup_capture_coordinator" } });
    await first.user.update({ where: { id: adminId }, data: { status: "blocked" } });
    const blockedRequest = await first.backupCaptureRequest.create({ data: { id: "blocked-admin", scheduleKey: "blocked-admin", scheduledFor: new Date("2026-11-16T08:03:00.000Z"), backupClass: "daily" } });
    await expect(a.assignBackupCaptureCoordinator(adminId, blockedRequest.id, "backup-vps", "blocked admin")).rejects.toMatchObject({ status: 403 });
    await expect(first.adminActionLog.count({ where: { action: "assign_backup_capture_coordinator" } })).resolves.toBe(assignmentAuditsBefore);
  });

  it("uses real row locks to serialize same-request retries and competing capture requests", async () => {
    await request("daily-one", "daily"); await request("weekly-one", "weekly"); await quiescent();
    const same = await Promise.all([a.authorizeSystemBackupCaptureRequest("scheduler-one", "daily-one", "first"), b.authorizeSystemBackupCaptureRequest("scheduler-two", "daily-one", "retry")]);
    expect(same[0].job.id).toBe(same[1].job.id);
    await expect(first.backupCaptureJob.count()).resolves.toBe(1);
    await expect(first.backupCoordinatorActionLog.count({ where: { requestId: "daily-one" } })).resolves.toBe(1);
    const competing = await Promise.allSettled([a.authorizeSystemBackupCaptureRequest("scheduler-one", "weekly-one", "weekly"), b.authorizeBackupCaptureRequest(adminTwoId, "weekly-one", "operator")]);
    expect(competing.filter(result => result.status === "fulfilled")).toHaveLength(0);
    await expect(first.backupCaptureRequest.findUniqueOrThrow({ where: { id: "weekly-one" } })).resolves.toMatchObject({ status: "pending" });
  });

  it("makes concurrent active-admin authorization idempotent and writes both human and coordinator audits", async () => {
    await request("operator-one"); await quiescent();
    const results = await Promise.all([a.authorizeBackupCaptureRequest(adminId, "operator-one", "operator one"), b.authorizeBackupCaptureRequest(adminTwoId, "operator-one", "operator two")]);
    expect(results[0].job.id).toBe(results[1].job.id);
    await expect(first.backupCaptureJob.count({ where: { requestId: "operator-one" } })).resolves.toBe(1);
    await expect(first.adminActionLog.count({ where: { action: "authorize_backup_capture_request" } })).resolves.toBe(2);
    await expect(first.backupCoordinatorActionLog.count({ where: { requestId: "operator-one", action: "backup_capture_job_authorized" } })).resolves.toBe(1);
  });

  it.each(["backupCaptureJob", "storageMaintenanceState", "backupCoordinatorActionLog", "adminActionLog"] as const)("rolls back job, lease, request, event, and audits when %s fails", async model => {
    await request(`rollback-${model}`); await quiescent();
    await expect(failingCoordinator(model).authorizeBackupCaptureRequest(adminId, `rollback-${model}`, "injected rollback")).rejects.toThrow(`${model} injected failure`);
    await expect(first.backupCaptureJob.count({ where: { requestId: `rollback-${model}` } })).resolves.toBe(0);
    await expect(first.backupCaptureRequest.findUniqueOrThrow({ where: { id: `rollback-${model}` } })).resolves.toMatchObject({ status: "pending" });
    await expect(first.storageMaintenanceState.findUniqueOrThrow({ where: { id: "storage" } })).resolves.toMatchObject({ captureLeaseId: null, captureGeneration: null, captureJobId: null });
    await expect(first.storageMaintenanceEvent.count({ where: { action: "backup_capture_job_authorized" } })).resolves.toBe(0);
    await expect(first.backupCoordinatorActionLog.count({ where: { requestId: `rollback-${model}` } })).resolves.toBe(0);
    await expect(first.adminActionLog.count({ where: { action: "authorize_backup_capture_request" } })).resolves.toBe(0);
  });

  it("rejects a stale state generation on retry and never treats a request-bound lease as backup-safe", async () => {
    await request("stale-generation"); await quiescent();
    const authorized = await a.authorizeSystemBackupCaptureRequest("scheduler", "stale-generation", "authorize");
    await expect(a.status()).resolves.toMatchObject({ captureLeaseId: authorized.leaseId, captureJobId: authorized.job.id, backupSafe: false });
    await first.storageMaintenanceState.update({ where: { id: "storage" }, data: { captureGeneration: authorized.generation + 1 } });
    await expect(b.authorizeSystemBackupCaptureRequest("scheduler", "stale-generation", "stale retry")).rejects.toMatchObject({ status: 409 });
  });

  it("creates idempotent durable schedule occurrences and rolls back a failed request creation", async () => {
    const input = { scheduleKey: "nightly", scheduledFor: new Date("2026-11-16T02:00:00.000Z"), backupClass: "daily" as const };
    const created = await Promise.all([a.createSystemBackupCaptureRequest("scheduler-one", input, "nightly"), b.createSystemBackupCaptureRequest("scheduler-two", input, "duplicate")]);
    await assign(created[0].request.id);
    expect(created[0].request.id).toBe(created[1].request.id);
    await expect(first.backupCaptureRequest.count()).resolves.toBe(1);
    await expect(first.backupCoordinatorActionLog.count({ where: { action: "backup_capture_request_created" } })).resolves.toBe(1);
    await expect(failingCoordinator("backupCaptureRequest").createBackupCaptureRequest(adminId, { scheduleKey: "failed", scheduledFor: new Date("2026-11-16T03:00:00.000Z"), backupClass: "weekly" }, "failure")).rejects.toThrow("backupCaptureRequest injected failure");
    await expect(first.backupCaptureRequest.count({ where: { scheduleKey: "failed" } })).resolves.toBe(0);
    await expect(first.backupCoordinatorActionLog.count({ where: { action: "backup_capture_request_created", request: { is: { scheduleKey: "failed" } } } })).resolves.toBe(0);
  });

  it("enters draining through the existing gate, then explicitly authorizes only after the last admitted write completes", async () => {
    const entered = deferred(); const finish = deferred();
    const mutation = a.run("company_document", async () => { entered.resolve(); await finish.promise; });
    await entered.promise;
    const created = await a.createSystemBackupCaptureRequest("scheduler", { scheduleKey: "drain", scheduledFor: new Date("2026-11-16T04:00:00.000Z"), backupClass: "daily" }, "scheduled");
    await assign(created.request.id);
    const draining = await b.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "start maintenance");
    expect(draining).toMatchObject({ maintenanceMode: "draining", job: null, request: { status: "maintenance_draining" } });
    await expect(a.status()).resolves.toMatchObject({ mode: "draining", backupSafe: false });
    await expect(b.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "overdue drain remains blocked")).resolves.toMatchObject({ maintenanceMode: "draining", job: null });
    finish.resolve(); await mutation;
    await expect(first.backupCaptureRequest.findUniqueOrThrow({ where: { id: created.request.id } })).resolves.toMatchObject({ status: "pending" });
    const authorized = await b.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "drained");
    expect(authorized).toMatchObject({ idempotent: false, request: { status: "ready" }, job: { backupClass: "daily" } });
    await expect(a.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: false, captureJobId: authorized.job.id });
  });

  it("blocks every pending/draining request on drain failure and never creates its lease", async () => {
    const entered = deferred(); const fail = deferred<void>();
    const mutation = a.run("identity_document", async () => { entered.resolve(); await fail.promise; });
    await entered.promise;
    const created = await a.createSystemBackupCaptureRequest("scheduler", { scheduleKey: "failure", scheduledFor: new Date("2026-11-16T05:00:00.000Z"), backupClass: "weekly" }, "scheduled");
    await assign(created.request.id);
    await b.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "start maintenance");
    fail.reject(new Error("provider failed while draining")); await expect(mutation).rejects.toThrow("provider failed while draining");
    await expect(first.backupCaptureRequest.findUniqueOrThrow({ where: { id: created.request.id } })).resolves.toMatchObject({ status: "blocked_recovery" });
    await expect(b.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "must not resume")).rejects.toMatchObject({ status: 409 });
    await expect(first.backupCaptureJob.count({ where: { requestId: created.request.id } })).resolves.toBe(0);
    await expect(a.status()).resolves.toMatchObject({ mode: "recovery_required", backupSafe: false });
  });

  it("blocks a request when maintenance activation discovers unresolved work and persists draining across restart", async () => {
    const pending = deferred(); const mutation = a.run("profile_photo", async () => pending.promise);
    await expect.poll(async () => first.storageMaintenanceOperation.count({ where: { status: "active" } })).toBe(1);
    const created = await a.createSystemBackupCaptureRequest("scheduler", { scheduleKey: "restart", scheduledFor: new Date("2026-11-16T06:00:00.000Z"), backupClass: "monthly" }, "scheduled");
    await assign(created.request.id);
    await b.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "start drain");
    const restarted = new StorageMutationCoordinator({ db: second } as never);
    await expect(restarted.status()).resolves.toMatchObject({ mode: "draining", backupSafe: false });
    await expect(restarted.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "restart sees active work")).resolves.toMatchObject({ maintenanceMode: "draining", job: null });
    pending.reject(new Error("restart operation uncertain")); await expect(mutation).rejects.toThrow("restart operation uncertain");
    await expect(first.backupCaptureRequest.findUniqueOrThrow({ where: { id: created.request.id } })).resolves.toMatchObject({ status: "blocked_recovery" });
  });

  it("rolls back maintenance activation when its state write fails", async () => {
    const created = await a.createSystemBackupCaptureRequest("scheduler", { scheduleKey: "enable-rollback", scheduledFor: new Date("2026-11-16T07:00:00.000Z"), backupClass: "daily" }, "scheduled");
    await assign(created.request.id);
    await expect(failingCoordinator("storageMaintenanceState").advanceBackupCaptureRequest(adminId, created.request.id, "state failure")).rejects.toThrow("storageMaintenanceState injected failure");
    await expect(first.storageMaintenanceState.findUniqueOrThrow({ where: { id: "storage" } })).resolves.toMatchObject({ mode: "inactive", captureLeaseId: null, captureJobId: null });
    await expect(first.backupCaptureRequest.findUniqueOrThrow({ where: { id: created.request.id } })).resolves.toMatchObject({ status: "pending" });
    await expect(first.backupCaptureJob.count({ where: { requestId: created.request.id } })).resolves.toBe(0);
  });

  async function coordinatorJob(id: string, backupClass: "daily" | "weekly" | "monthly" = "daily") {
    const created = await a.createSystemBackupCaptureRequest("scheduler", { scheduleKey: id, scheduledFor: new Date(`2026-11-17T08:00:00.${id.length.toString().padStart(3, "0")}Z`), backupClass }, "scheduled");
    await assign(created.request.id);
    const authorized: any = await a.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "quiescent");
    return { jobId: authorized.job.id, leaseId: authorized.leaseId, generation: authorized.generation, backupClass, attemptId: "123e4567-e89b-42d3-a456-426614174000" };
  }

  it("serializes claims, validates exact lease bindings, and reports idempotently without releasing the lease", async () => {
    const reference = await coordinatorJob("coordinator-claim");
    const secondCoordinator = new BackupCoordinatorService({ db: second } as never);
    const claims = await Promise.allSettled([backupCoordinator.claim("backup-vps", reference), secondCoordinator.claim("backup-vps", reference)]);
    expect(claims.filter(result => result.status === "fulfilled")).toHaveLength(2); // same principal/attempt is idempotent
    await expect(backupCoordinator.validate("backup-vps", { ...reference, leaseId: "123e4567-e89b-42d3-a456-426614174999" })).rejects.toMatchObject({ status: 409 });
    await backupCoordinator.validate("backup-vps", reference);
    const reported = await backupCoordinator.report("backup-vps", reference, "succeeded", "result-1", "integrity verified", "set-1", "c".repeat(64));
    const repeated = await backupCoordinator.report("backup-vps", reference, "succeeded", "result-1", "ignored duplicate");
    expect(reported).toMatchObject({ status: "reported", outcome: "succeeded", idempotent: false }); expect(repeated).toMatchObject({ idempotent: true });
    await expect(first.storageMaintenanceState.findUniqueOrThrow({ where: { id: "storage" } })).resolves.toMatchObject({ captureLeaseId: reference.leaseId, captureOutcome: "succeeded", captureJobId: reference.jobId });
    await expect(backupCoordinator.status("other-principal", reference.jobId)).rejects.toMatchObject({ status: 403 });
  });

  it("atomically delivers only the assigned principal's live job without duplicate delivery", async () => {
    const reference = await coordinatorJob("delivery-a");
    await first.backupCoordinatorPrincipal.create({ data: { id: "backup-vps-b", name: "Backup VPS B" } });
    await first.backupCoordinatorCertificate.create({ data: { principalId: "backup-vps-b", fingerprint: "a".repeat(64) } });
    const other = new BackupCoordinatorService({ db: second } as never);
    const concurrent = await Promise.all([backupCoordinator.deliver("backup-vps", "daily", 10), other.deliver("backup-vps", "daily", 1)]);
    expect(concurrent.flatMap(result => result.jobs)).toHaveLength(1);
    expect(concurrent.flatMap(result => result.jobs)[0]).toMatchObject({ jobId: reference.jobId, leaseId: reference.leaseId, generation: reference.generation, backupClass: reference.backupClass, status: "claimed" });
    await expect(backupCoordinator.deliver("backup-vps-b", "daily", 1)).resolves.toEqual({ jobs: [] });
    await expect(first.backupCaptureJob.findUniqueOrThrow({ where: { id: reference.jobId } })).resolves.toMatchObject({ authorizedCoordinatorPrincipalId: "backup-vps", claimedBy: "backup-vps" });
    await expect(first.backupCoordinatorActionLog.count({ where: { jobId: reference.jobId, action: "backup_capture_job_delivered" } })).resolves.toBe(1);
  });

  it("delivers B's assigned job only to B and excludes unassigned or ineligible bindings", async () => {
    await first.backupCoordinatorPrincipal.create({ data: { id: "backup-vps-b", name: "Backup VPS B" } });
    await first.backupCoordinatorCertificate.create({ data: { principalId: "backup-vps-b", fingerprint: "9".repeat(64) } });
    const created = await a.createSystemBackupCaptureRequest("scheduler", { scheduleKey: "delivery-b", scheduledFor: new Date("2026-11-17T09:00:00.000Z"), backupClass: "weekly" }, "scheduled");
    await a.assignBackupCaptureCoordinator(adminId, created.request.id, "backup-vps-b", "B assignment");
    const authorized: any = await a.advanceSystemBackupCaptureRequest("scheduler", created.request.id, "quiescent");
    const bCoordinator = new BackupCoordinatorService({ db: second } as never);
    await expect(backupCoordinator.deliver("backup-vps", "weekly", 1)).resolves.toEqual({ jobs: [] });
    await expect(bCoordinator.deliver("backup-vps-b", "weekly", 1)).resolves.toMatchObject({ jobs: [expect.objectContaining({ jobId: authorized.job.id, leaseId: authorized.leaseId, generation: authorized.generation, backupClass: "weekly" })] });
    await first.backupCaptureJob.update({ where: { id: authorized.job.id }, data: { authorizedCoordinatorPrincipalId: null, status: "authorized", claimedBy: null, coordinatorAttemptId: null } });
    await expect(bCoordinator.deliver("backup-vps-b", "weekly", 1)).resolves.toEqual({ jobs: [] });
  });

  it("fails closed delivery for inactive or revoked principals without changing the job binding", async () => {
    const reference = await coordinatorJob("delivery-fail-closed");
    await first.backupCoordinatorPrincipal.update({ where: { id: "backup-vps" }, data: { active: false } });
    await expect(backupCoordinator.deliver("backup-vps", "daily", 1)).rejects.toMatchObject({ status: 403 });
    await first.backupCoordinatorPrincipal.update({ where: { id: "backup-vps" }, data: { active: true } });
    await first.backupCoordinatorCertificate.update({ where: { fingerprint: "b".repeat(64) }, data: { status: "revoked" } });
    await expect(backupCoordinator.deliver("backup-vps", "daily", 1)).rejects.toMatchObject({ status: 403 });
    await expect(first.backupCaptureJob.findUniqueOrThrow({ where: { id: reference.jobId } })).resolves.toMatchObject({ status: "authorized", claimedBy: null, authorizedCoordinatorPrincipalId: "backup-vps" });
  });

  it("rejects competing attempts, stale generations, and preserves claims across a service restart", async () => {
    const reference = await coordinatorJob("coordinator-restart", "weekly");
    await backupCoordinator.claim("backup-vps", reference);
    await expect(backupCoordinator.claim("backup-vps", { ...reference, attemptId: "123e4567-e89b-42d3-a456-426614174001" })).rejects.toMatchObject({ status: 409 });
    const restarted = new BackupCoordinatorService({ db: second } as never);
    await expect(restarted.status("backup-vps", reference.jobId)).resolves.toMatchObject({ attemptId: reference.attemptId, status: "claimed" });
    await first.storageMaintenanceState.update({ where: { id: "storage" }, data: { generation: reference.generation + 1 } });
    await expect(restarted.validate("backup-vps", reference)).rejects.toMatchObject({ status: 409 });
  });

  it("scopes claim, validation, reporting, and status to the assigned active principal without reassignment", async () => {
    const reference = await coordinatorJob("coordinator-binding", "daily");
    await first.backupCoordinatorPrincipal.create({ data: { id: "backup-vps-rotated", name: "Second Backup VPS" } });
    await first.backupCoordinatorCertificate.create({ data: { principalId: "backup-vps-rotated", fingerprint: "f".repeat(64) } });
    await backupCoordinator.claim("backup-vps", reference);
    const [jobBefore, stateBefore, auditsBefore] = await Promise.all([
      first.backupCaptureJob.findUniqueOrThrow({ where: { id: reference.jobId } }),
      first.storageMaintenanceState.findUniqueOrThrow({ where: { id: "storage" } }),
      first.backupCoordinatorActionLog.count({ where: { jobId: reference.jobId } }),
    ]);
    await expect(backupCoordinator.claim("backup-vps-rotated", { ...reference, attemptId: "123e4567-e89b-42d3-a456-426614174002" })).rejects.toMatchObject({ status: 403 });
    await expect(backupCoordinator.validate("backup-vps-rotated", reference)).rejects.toMatchObject({ status: 403 });
    await expect(backupCoordinator.report("backup-vps-rotated", reference, "succeeded", "cross-principal", "must not report")).rejects.toMatchObject({ status: 403 });
    await expect(backupCoordinator.status("backup-vps-rotated", reference.jobId)).rejects.toMatchObject({ status: 403 });
    await expect(backupCoordinator.validate("backup-vps", { ...reference, backupClass: "monthly" })).rejects.toMatchObject({ status: 409 });
    await first.backupCaptureJob.update({ where: { id: reference.jobId }, data: { authorizedCoordinatorPrincipalId: null } });
    await expect(backupCoordinator.status("backup-vps", reference.jobId)).rejects.toMatchObject({ status: 403 });
    await first.backupCaptureJob.update({ where: { id: reference.jobId }, data: { authorizedCoordinatorPrincipalId: "backup-vps" } });
    await first.backupCoordinatorPrincipal.update({ where: { id: "backup-vps" }, data: { active: false } });
    await expect(backupCoordinator.status("backup-vps", reference.jobId)).rejects.toMatchObject({ status: 403 });
    await first.backupCoordinatorPrincipal.update({ where: { id: "backup-vps" }, data: { active: true } });
    await first.backupCoordinatorCertificate.update({ where: { fingerprint: "b".repeat(64) }, data: { status: "revoked" } });
    await expect(backupCoordinator.status("backup-vps", reference.jobId)).rejects.toMatchObject({ status: 403 });
    await expect(first.backupCaptureJob.findUniqueOrThrow({ where: { id: reference.jobId } })).resolves.toMatchObject({
      claimedBy: jobBefore.claimedBy, coordinatorAttemptId: jobBefore.coordinatorAttemptId, status: jobBefore.status, leaseId: jobBefore.leaseId, leaseGeneration: jobBefore.leaseGeneration, resultOutcome: null,
    });
    await expect(first.storageMaintenanceState.findUniqueOrThrow({ where: { id: "storage" } })).resolves.toMatchObject({
      captureLeaseId: stateBefore.captureLeaseId, captureGeneration: stateBefore.captureGeneration, captureJobId: stateBefore.captureJobId, captureOutcome: stateBefore.captureOutcome,
    });
    await expect(first.backupCoordinatorActionLog.count({ where: { jobId: reference.jobId } })).resolves.toBe(auditsBefore);
  });

  it("supports certificate rotation/revocation with audited admin actions", async () => {
    await backupCoordinator.createPrincipal(adminId, "rotating-vps", "Rotating VPS");
    await backupCoordinator.addCertificate(adminId, "rotating-vps", "d".repeat(64));
    await backupCoordinator.addCertificate(adminId, "rotating-vps", "e".repeat(64));
    await backupCoordinator.revokeCertificate(adminId, "d".repeat(64), "rotation complete");
    await expect(first.backupCoordinatorCertificate.findUniqueOrThrow({ where: { fingerprint: "d".repeat(64) } })).resolves.toMatchObject({ status: "revoked", revokedBy: adminId });
    await expect(first.adminActionLog.count({ where: { action: { in: ["create_backup_coordinator_principal", "add_backup_coordinator_certificate", "revoke_backup_coordinator_certificate"] } } })).resolves.toBe(4);
  });
});
