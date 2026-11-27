import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { StorageMutationCoordinator } from "../src/storage-maintenance/storage-mutation-coordinator.service";

type Request = { id: string; backupClass: "daily" | "weekly" | "monthly"; status: "pending" | "maintenance_draining" | "blocked_recovery" | "ready" | "cancelled"; authorizedCoordinatorPrincipalId?: string | null };
type Job = { id: string; requestId: string; backupClass: Request["backupClass"]; leaseId: string; leaseGeneration: number; status: string };

function harness(options: { failure?: "job" | "state" | "coordinator-audit" | "admin-audit" } = {}) {
  const state: any = { id: "storage", mode: "quiescent", generation: 7, captureLeaseId: null, captureGeneration: null, captureJobId: null, captureOutcome: null, captureAcquiredAt: null, captureAcquiredBy: null, captureOutcomeAt: null, captureOutcomeBy: null, captureOutcomeReason: null };
  const requests: Request[] = [
    { id: "daily-request", backupClass: "daily", status: "pending", authorizedCoordinatorPrincipalId: "backup-vps" },
    { id: "weekly-request", backupClass: "weekly", status: "pending", authorizedCoordinatorPrincipalId: "backup-vps" },
    { id: "cancelled-request", backupClass: "daily", status: "cancelled" },
  ];
  const jobs: Job[] = []; const events: any[] = []; const coordinatorAudits: any[] = []; const adminAudits: any[] = [];
  let jobNumber = 0; let transactionTail = Promise.resolve();
  const snapshot = () => structuredClone({ state, requests, jobs, events, coordinatorAudits, adminAudits, jobNumber });
  const restore = (saved: ReturnType<typeof snapshot>) => {
    Object.assign(state, saved.state);
    requests.splice(0, requests.length, ...saved.requests); jobs.splice(0, jobs.length, ...saved.jobs);
    events.splice(0, events.length, ...saved.events); coordinatorAudits.splice(0, coordinatorAudits.length, ...saved.coordinatorAudits); adminAudits.splice(0, adminAudits.length, ...saved.adminAudits); jobNumber = saved.jobNumber;
  };
  const tx: any = {
    $queryRaw: async () => undefined,
    user: { findUnique: async () => ({ role: "admin", status: "active" }) },
    storageMaintenanceState: {
      findUniqueOrThrow: async () => state,
      update: async ({ data }: any) => { if (options.failure === "state") throw new Error("state write failed"); if (data.generation?.increment) state.generation += data.generation.increment; Object.assign(state, Object.fromEntries(Object.entries(data).filter(([key]) => key !== "generation"))); return state; },
    },
    storageMaintenanceOperation: { count: async () => 0 },
    backupCoordinatorPrincipal: { findUnique: async ({ where }: any) => where.id === "backup-vps" ? { id: "backup-vps", active: true, certificates: [{ status: "active", notBefore: null, notAfter: null }] } : null },
    backupCaptureRequest: {
      findUniqueOrThrow: async ({ where }: any) => { const request = requests.find(candidate => candidate.id === where.id); if (!request) throw new Error("request missing"); return request; },
      findUnique: async ({ where }: any) => where.id ? requests.find(candidate => candidate.id === where.id) ?? null : requests.find((candidate: any) => candidate.scheduleKey === where.scheduleKey_scheduledFor.scheduleKey && candidate.scheduledFor?.getTime?.() === where.scheduleKey_scheduledFor.scheduledFor.getTime()) ?? null,
      create: async ({ data }: any) => { const request: any = { id: `request-${requests.length + 1}`, ...data }; requests.push(request); return request; },
      update: async ({ where, data }: any) => { const request = requests.find(candidate => candidate.id === where.id)!; Object.assign(request, data); return request; },
      updateMany: async ({ where, data }: any) => { const selected = requests.filter(candidate => where.status?.in ? where.status.in.includes(candidate.status) : candidate.status === where.status); selected.forEach(candidate => Object.assign(candidate, data)); return { count: selected.length }; },
    },
    backupCaptureJob: {
      findUnique: async ({ where }: any) => jobs.find(candidate => candidate.requestId === where.requestId) ?? null,
      findFirst: async ({ where }: any) => jobs.find(candidate => where?.status?.not ? candidate.status !== where.status.not : true) ?? null,
      create: async ({ data }: any) => { if (options.failure === "job") throw new Error("job insert failed"); const job = { id: `job-${++jobNumber}`, ...data }; jobs.push(job); return job; },
    },
    storageMaintenanceEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
    backupCoordinatorActionLog: { create: async ({ data }: any) => { if (options.failure === "coordinator-audit") throw new Error("coordinator audit failed"); coordinatorAudits.push(data); return data; } },
    adminActionLog: { create: async ({ data }: any) => { if (options.failure === "admin-audit") throw new Error("admin audit failed"); adminAudits.push(data); return data; } },
  };
  const db: any = {
    ...tx,
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => {
      let unlock!: () => void; const next = new Promise<void>(resolve => { unlock = resolve; }); const prior = transactionTail; transactionTail = next;
      await prior; const saved = snapshot();
      try { return await callback(tx); } catch (error) { restore(saved); throw error; } finally { unlock(); }
    },
  };
  return { coordinator: new StorageMutationCoordinator({ db } as never), state, requests, jobs, events, coordinatorAudits, adminAudits };
}

describe("request-bound capture authorization", () => {
  it("atomically creates one generation-bound job, state lease, event, and both audit records", async () => {
    const test = harness();
    const result = await test.coordinator.authorizeBackupCaptureRequest("active-admin", "daily-request", "daily capture");
    expect(result).toMatchObject({ generation: 7, idempotent: false, job: { requestId: "daily-request", backupClass: "daily", leaseGeneration: 7 } });
    expect(test.state).toMatchObject({ captureLeaseId: result.leaseId, captureGeneration: 7, captureJobId: result.job.id });
    expect(test.requests[0]).toMatchObject({ status: "ready" });
    expect(test.events).toEqual([expect.objectContaining({ action: "backup_capture_job_authorized", generation: 7, operationId: result.leaseId })]);
    expect(test.coordinatorAudits).toEqual([expect.objectContaining({ requestId: "daily-request", jobId: result.job.id, leaseId: result.leaseId, generation: 7 })]);
    expect(test.adminAudits).toEqual([expect.objectContaining({ action: "authorize_backup_capture_request", adminId: "active-admin" })]);
  });

  it("serializes same-request retries and competing requests without rebinding the lease", async () => {
    const test = harness();
    const [one, two] = await Promise.all([test.coordinator.authorizeSystemBackupCaptureRequest("scheduler-a", "daily-request", "occurrence"), test.coordinator.authorizeSystemBackupCaptureRequest("scheduler-b", "daily-request", "retry")]);
    expect(one.job.id).toBe(two.job.id); expect(test.jobs).toHaveLength(1);
    await expect(test.coordinator.authorizeSystemBackupCaptureRequest("scheduler-b", "weekly-request", "competing occurrence")).rejects.toBeInstanceOf(ConflictException);
    await expect(test.coordinator.authorizeSystemBackupCaptureRequest("scheduler-b", "cancelled-request", "cancelled occurrence")).rejects.toBeInstanceOf(ConflictException);
  });

  it.each(["job", "state", "coordinator-audit", "admin-audit"] as const)("rolls back every write when %s creation fails", async failure => {
    const test = harness({ failure });
    await expect(test.coordinator.authorizeBackupCaptureRequest("active-admin", "daily-request", "must rollback")).rejects.toThrow();
    expect(test.jobs).toHaveLength(0); expect(test.state.captureLeaseId).toBeNull(); expect(test.state.captureJobId).toBeNull();
    expect(test.requests[0].status).toBe("pending"); expect(test.events).toHaveLength(0); expect(test.coordinatorAudits).toHaveLength(0); expect(test.adminAudits).toHaveLength(0);
  });

  it("creates a duplicate-safe schedule occurrence and authorizes it through the existing immediate-quiescence path", async () => {
    const test = harness(); test.state.mode = "inactive";
    const input = { scheduleKey: "daily", scheduledFor: new Date("2026-11-16T02:00:00.000Z"), backupClass: "daily" as const };
    const [first, duplicate] = await Promise.all([test.coordinator.createSystemBackupCaptureRequest("scheduler-a", input, "scheduled"), test.coordinator.createSystemBackupCaptureRequest("scheduler-b", input, "retry")]);
    expect(first.request.id).toBe(duplicate.request.id); expect(test.requests.filter((request: any) => request.scheduleKey === "daily")).toHaveLength(1);
    await test.coordinator.assignBackupCaptureCoordinator("active-admin", first.request.id, "backup-vps", "assign");
    const advanced = await test.coordinator.advanceSystemBackupCaptureRequest("scheduler-a", first.request.id, "begin");
    expect(advanced).toMatchObject({ request: { status: "ready" }, job: { backupClass: "daily", leaseGeneration: 8 } });
    expect(test.state).toMatchObject({ mode: "quiescent", generation: 8, captureJobId: advanced.job.id, captureLeaseId: advanced.leaseId });
  });

  it("rejects legacy unassigned authorization and audits an explicit active-principal assignment", async () => {
    const test = harness(); test.requests[0].authorizedCoordinatorPrincipalId = null;
    await expect(test.coordinator.authorizeBackupCaptureRequest("active-admin", "daily-request", "legacy")).rejects.toBeInstanceOf(ConflictException);
    await test.coordinator.assignBackupCaptureCoordinator("active-admin", "daily-request", "backup-vps", "approved");
    expect(test.requests[0].authorizedCoordinatorPrincipalId).toBe("backup-vps");
    expect(test.coordinatorAudits).toEqual([expect.objectContaining({ action: "backup_capture_coordinator_assigned" })]);
  });
});
