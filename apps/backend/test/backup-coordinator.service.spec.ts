import { describe, expect, it } from "vitest";

import { BackupCoordinatorService } from "../src/storage-maintenance/backup-coordinator.service";

const reference = { jobId: "job-1", leaseId: "lease-1", generation: 7, backupClass: "daily" as const, attemptId: "123e4567-e89b-42d3-a456-426614174000" };

function harness(options: { assignment?: string | null; inactive?: boolean; revoked?: boolean; auditFailure?: boolean; ineligible?: boolean } = {}) {
  const job: any = { id: reference.jobId, requestId: "request-1", authorizedCoordinatorPrincipalId: options.assignment === undefined ? "principal-a" : options.assignment, leaseId: reference.leaseId, leaseGeneration: reference.generation, backupClass: reference.backupClass, status: options.ineligible ? "reported" : "authorized", claimedBy: null, coordinatorAttemptId: null, resultIdempotencyKey: null, resultOutcome: options.ineligible ? "succeeded" : null, authorizedAt: new Date("2026-11-17T00:00:00.000Z") };
  const state: any = { id: "storage", mode: "quiescent", generation: reference.generation, captureLeaseId: reference.leaseId, captureGeneration: reference.generation, captureJobId: reference.jobId, captureOutcome: null };
  const request: any = { id: "request-1", status: "ready" };
  const audits: any[] = []; const events: any[] = [];
  const principals: Record<string, any> = {
    "principal-a": { id: "principal-a", active: !options.inactive, certificates: options.revoked ? [] : [{ status: "active", notBefore: null, notAfter: null }] },
    "principal-b": { id: "principal-b", active: true, certificates: [{ status: "active", notBefore: null, notAfter: null }] },
  };
  const snapshot = () => structuredClone({ job, state, request, audits, events });
  const restore = (saved: ReturnType<typeof snapshot>) => { Object.assign(job, saved.job); Object.assign(state, saved.state); Object.assign(request, saved.request); audits.splice(0, audits.length, ...saved.audits); events.splice(0, events.length, ...saved.events); };
  const tx: any = {
    $queryRaw: async () => undefined,
    storageMaintenanceState: { findUniqueOrThrow: async () => state, update: async ({ data }: any) => Object.assign(state, data) },
    backupCaptureJob: { findUniqueOrThrow: async () => job, findUnique: async () => job, findMany: async ({ where }: any) => job.id === where.id && job.authorizedCoordinatorPrincipalId === where.authorizedCoordinatorPrincipalId && job.status === where.status && job.claimedBy === where.claimedBy && job.coordinatorAttemptId === where.coordinatorAttemptId && job.resultOutcome === where.resultOutcome ? [job] : [], update: async ({ data }: any) => Object.assign(job, data) },
    backupCaptureRequest: { findUniqueOrThrow: async () => request },
    storageMaintenanceOperation: { count: async () => 0 },
    backupCoordinatorPrincipal: { findUnique: async ({ where }: any) => principals[where.id] ?? null },
    backupCoordinatorActionLog: { create: async ({ data }: any) => { if (options.auditFailure) throw new Error("audit failed"); audits.push(data); return data; } },
    storageMaintenanceEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
  };
  const db: any = { ...tx, $transaction: async (callback: (transaction: any) => Promise<unknown>) => { const saved = snapshot(); try { return await callback(tx); } catch (error) { restore(saved); throw error; } } };
  return { coordinator: new BackupCoordinatorService({ db } as never), job, state, audits, events };
}

describe("principal-scoped backup coordinator authorization", () => {
  it("permits only the assigned active principal and preserves same-principal claim idempotency", async () => {
    const test = harness();
    await expect(test.coordinator.claim("principal-a", reference)).resolves.toMatchObject({ status: "claimed", idempotent: false });
    await expect(test.coordinator.claim("principal-a", reference)).resolves.toMatchObject({ status: "claimed", idempotent: true });
    await expect(test.coordinator.claim("principal-b", reference)).rejects.toMatchObject({ status: 403 });
    expect(test.job).toMatchObject({ authorizedCoordinatorPrincipalId: "principal-a", claimedBy: "principal-a", coordinatorAttemptId: reference.attemptId });
  });

  it("delivers only the exact active principal's eligible job with a server-bound attempt", async () => {
    const test = harness();
    await expect(test.coordinator.deliver("principal-b", 1)).resolves.toEqual({ jobs: [] });
    const delivered = await test.coordinator.deliver("principal-a", 1);
    expect(delivered.jobs).toHaveLength(1);
    expect(delivered.jobs[0]).toMatchObject({ jobId: reference.jobId, leaseId: reference.leaseId, generation: reference.generation, backupClass: "daily", status: "claimed", idempotent: false });
    expect(delivered.jobs[0].attemptId).toMatch(/^[0-9a-f-]{36}$/i);
    await expect(test.coordinator.deliver("principal-a", 1)).resolves.toEqual({ jobs: [] });
    expect(test.audits).toEqual([expect.objectContaining({ action: "backup_capture_job_delivered", principalId: "principal-a" })]);
  });

  it.each([
    ["unassigned", { assignment: null }],
    ["inactive", { inactive: true }],
    ["revoked", { revoked: true }],
  ])("fails closed delivery for %s principals or jobs", async (_label, options) => {
    const test = harness(options);
    if ("assignment" in options && options.assignment === null) await expect(test.coordinator.deliver("principal-a", 1)).resolves.toEqual({ jobs: [] });
    else await expect(test.coordinator.deliver("principal-a", 1)).rejects.toMatchObject({ status: 403 });
    expect(test.job.status).toBe("authorized");
  });

  it("excludes ineligible jobs, bounds the limit, and rolls delivery back when its audit fails", async () => {
    await expect(harness({ ineligible: true }).coordinator.deliver("principal-a", 1)).resolves.toEqual({ jobs: [] });
    await expect(harness().coordinator.deliver("principal-a", 11)).rejects.toMatchObject({ status: 409 });
    const rollback = harness({ auditFailure: true });
    await expect(rollback.coordinator.deliver("principal-a", 1)).rejects.toThrow("audit failed");
    expect(rollback.job).toMatchObject({ status: "authorized", claimedBy: null, coordinatorAttemptId: null });
  });

  it("rejects cross-principal validation, reporting, and status without changing the lease", async () => {
    const test = harness();
    await test.coordinator.claim("principal-a", reference);
    await expect(test.coordinator.validate("principal-b", reference)).rejects.toMatchObject({ status: 403 });
    await expect(test.coordinator.report("principal-b", reference, "succeeded", "result-1", "cross-principal")).rejects.toMatchObject({ status: 403 });
    await expect(test.coordinator.status("principal-b", reference.jobId)).rejects.toMatchObject({ status: 403 });
    expect(test.state).toMatchObject({ captureLeaseId: reference.leaseId, captureGeneration: reference.generation, captureJobId: reference.jobId, captureOutcome: null });
    expect(test.audits).toHaveLength(1);
  });

  it.each([
    ["unassigned", { assignment: null }],
    ["inactive", { inactive: true }],
    ["revoked", { revoked: true }],
  ])("fails closed for %s assigned-principal state", async (_label, options) => {
    const test = harness(options);
    await expect(test.coordinator.claim("principal-a", reference)).rejects.toMatchObject({ status: 403 });
    expect(test.job.status).toBe("authorized"); expect(test.audits).toHaveLength(0);
  });

  it("keeps result idempotency for the assigned principal and rolls report writes back with its audit", async () => {
    const successful = harness();
    await successful.coordinator.claim("principal-a", reference);
    await successful.coordinator.validate("principal-a", reference);
    await expect(successful.coordinator.report("principal-a", reference, "succeeded", "result-1", "complete")).resolves.toMatchObject({ status: "reported", idempotent: false });
    await expect(successful.coordinator.report("principal-a", reference, "succeeded", "result-1", "retry")).resolves.toMatchObject({ idempotent: true });
    expect(successful.state).toMatchObject({ captureLeaseId: reference.leaseId, captureOutcome: "succeeded" });

    const rollback = harness({ auditFailure: true });
    await rollback.coordinator.claim("principal-a", reference).catch(() => undefined);
    rollback.job.status = "claimed"; rollback.job.claimedBy = "principal-a"; rollback.job.coordinatorAttemptId = reference.attemptId;
    await expect(rollback.coordinator.report("principal-a", reference, "failed", "result-2", "audit rollback")).rejects.toThrow("audit failed");
    expect(rollback.job).toMatchObject({ status: "claimed", resultIdempotencyKey: null, resultOutcome: null });
    expect(rollback.state.captureOutcome).toBeNull(); expect(rollback.events).toHaveLength(0);
  });
});
