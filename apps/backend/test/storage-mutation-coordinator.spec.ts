import { ServiceUnavailableException } from "@nestjs/common";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { StorageMutationCoordinator, StorageMutationReconciliationRequiredError } from "../src/storage-maintenance/storage-mutation-coordinator.service";

type State = { id: string; mode: "inactive" | "draining" | "quiescent" | "recovery_required"; generation: number; activatedAt: Date | null; activatedBy: string | null; quiescentAt: Date | null; disabledAt: Date | null; disabledBy: string | null; recoveryRequiredAt: Date | null; captureLeaseId: string | null; captureGeneration: number | null; captureAcquiredAt: Date | null; captureAcquiredBy: string | null; captureOutcome: "succeeded" | "failed" | "uncertain" | null; captureOutcomeAt: Date | null; captureOutcomeBy: string | null; captureOutcomeReason: string | null; updatedAt: Date };
type Operation = { id: string; generation: number; kind: string; status: "active" | "fenced" | "completed" | "failed" | "reconciled"; startedAt: Date; completedAt: Date | null; failureKind: string | null; reconciledAt: Date | null; reconciledBy: string | null; reconciliationReason: string | null; reconciliationOutcome: string | null; workerId: string; workerFenceEpoch: number };
type Worker = { id: string; heartbeatAt: Date; fenceEpoch: number; fencedAt: Date | null; fencedBy: string | null; fencingReason: string | null; stoppedAt: Date | null };

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function harness() {
  const state: State = { id: "storage", mode: "inactive", generation: 0, activatedAt: null, activatedBy: null, quiescentAt: null, disabledAt: null, disabledBy: null, recoveryRequiredAt: null, captureLeaseId: null, captureGeneration: null, captureAcquiredAt: null, captureAcquiredBy: null, captureOutcome: null, captureOutcomeAt: null, captureOutcomeBy: null, captureOutcomeReason: null, updatedAt: new Date() };
  const operations: Operation[] = [];
  const workers = new Map<string, Worker>();
  const events: Record<string, unknown>[] = [];
  const audits: Record<string, unknown>[] = [];
  let operationNumber = 0;
  let tail = Promise.resolve();

  const matches = (operation: Operation, where: any = {}) => {
    if (where.status) {
      if (typeof where.status === "string" && operation.status !== where.status) return false;
      if (where.status.in && !where.status.in.includes(operation.status)) return false;
    }
    return where.generation === undefined || operation.generation === where.generation;
  };
  const operationsApi = {
    create: async ({ data }: any) => {
      const operation: Operation = { id: `op-${++operationNumber}`, generation: data.generation, kind: data.kind, status: data.status, startedAt: new Date(), completedAt: null, failureKind: null, reconciledAt: null, reconciledBy: null, reconciliationReason: null, reconciliationOutcome: null, workerId: data.workerId, workerFenceEpoch: data.workerFenceEpoch };
      operations.push(operation);
      return operation;
    },
    count: async ({ where }: any = {}) => operations.filter(operation => matches(operation, where)).length,
    findUnique: async ({ where }: any) => operations.find(operation => operation.id === where.id) ?? null,
    update: async ({ where, data }: any) => {
      const operation = operations.find(candidate => candidate.id === where.id)!;
      Object.assign(operation, data);
      return operation;
    },
    updateMany: async ({ where, data }: any) => {
      const selected = operations.filter(operation => matches(operation, where) && (!where.workerId || operation.workerId === where.workerId));
      selected.forEach(operation => Object.assign(operation, data));
      return { count: selected.length };
    },
    findMany: async ({ where }: any = {}) => operations.filter(operation => matches(operation, where)),
  };
  const workersApi = {
    upsert: async ({ where, create, update }: any) => {
      const current = workers.get(where.id);
      if (!current) {
        const worker: Worker = { id: create.id, heartbeatAt: new Date(), fenceEpoch: 0, fencedAt: null, fencedBy: null, fencingReason: null, stoppedAt: null };
        workers.set(worker.id, worker); return worker;
      }
      Object.assign(current, update); return current;
    },
    findUniqueOrThrow: async ({ where }: any) => {
      const worker = workers.get(where.id); if (!worker) throw new Error("worker missing"); return worker;
    },
    update: async ({ where, data }: any) => {
      const worker = workers.get(where.id)!;
      if (data.fenceEpoch?.increment) worker.fenceEpoch += data.fenceEpoch.increment;
      Object.assign(worker, Object.fromEntries(Object.entries(data).filter(([key]) => key !== "fenceEpoch")));
      return worker;
    },
  };
  const stateApi = {
    findUniqueOrThrow: async () => state,
    update: async ({ data }: any) => {
      if (data.generation?.increment) state.generation += data.generation.increment;
      Object.assign(state, Object.fromEntries(Object.entries(data).filter(([key]) => key !== "generation")), { updatedAt: new Date() });
      return state;
    },
  };
  const tx: any = {
    $queryRaw: async () => [{ id: "storage" }],
    user: { findUnique: async () => ({ role: "admin", status: "active" }) },
    adminActionLog: { create: async ({ data }: any) => { audits.push(data); return data; } },
    storageMaintenanceState: stateApi,
    storageMaintenanceOperation: operationsApi,
    backupCaptureRequest: { updateMany: async () => ({ count: 0 }) },
    backupCaptureJob: { findFirst: async () => null },
    storageMaintenanceWorker: workersApi,
    storageMaintenanceEvent: { create: async ({ data }: any) => { events.push(data); return data; } },
  };
  const db: any = {
    ...tx,
    $transaction: async (callback: (transaction: any) => Promise<unknown>) => {
      let unlock!: () => void;
      const next = new Promise<void>(resolve => { unlock = resolve; });
      const previous = tail;
      tail = next;
      await previous;
      try { return await callback(tx); } finally { unlock(); }
    },
  };
  return { coordinator: new StorageMutationCoordinator({ db } as never), state, operations, workers, events, audits };
}

async function waitFor(check: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt++) {
    if (check()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error("condition was not reached");
}

describe("StorageMutationCoordinator", () => {
  it("serializes admission/activation, drains concurrent storage mutations, and rejects later writes", async () => {
    const test = harness();
    const a = deferred(); const b = deferred(); const c = deferred();
    const first = test.coordinator.run("identity_document", async () => { await a.promise; });
    const second = test.coordinator.run("company_document", async () => { await b.promise; });
    const third = test.coordinator.run("profile_photo", async () => { await c.promise; });
    await waitFor(() => test.operations.filter(operation => operation.status === "active").length === 3);

    await expect(test.coordinator.enable("admin-1")).resolves.toMatchObject({ mode: "draining", activeOperations: 3, backupSafe: false });
    await expect(test.coordinator.run("profile_photo", async () => undefined)).rejects.toBeInstanceOf(ServiceUnavailableException);

    b.resolve(); await second;
    expect((await test.coordinator.status()).mode).toBe("draining");
    a.resolve(); c.resolve(); await Promise.all([first, third]);
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "quiescent", activeOperations: 0, failedOperations: 0, backupSafe: true });
    expect(test.audits.map(entry => entry.action)).toContain("enable_storage_maintenance");
  });

  it("requires explicit reconciliation and acknowledgement after an admitted mutation fails during draining", async () => {
    const test = harness();
    const failure = deferred<void>();
    const mutation = test.coordinator.run("identity_document", async () => failure.promise);
    await waitFor(() => test.operations.length === 1);
    await test.coordinator.enable("admin-1");
    failure.reject(new Error("provider timeout"));
    await expect(mutation).rejects.toThrow("provider timeout");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "recovery_required", backupSafe: false, failedOperations: 1 });
    await expect(test.coordinator.acknowledgeQuiescent("admin-2", "not yet")).rejects.toMatchObject({ status: 409 });
    await test.coordinator.reconcile("admin-2", test.operations[0].id, "provider and database state compared", "provider_reconciled");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "recovery_required", failedOperations: 0, backupSafe: false });
    await test.coordinator.acknowledgeQuiescent("admin-2", "reconciliation complete");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
    expect(test.audits.map(entry => entry.action)).toEqual(expect.arrayContaining(["reconcile_storage_maintenance_operation", "acknowledge_storage_maintenance_quiescent"]));
  });

  it("rejects ordinary reconciliation of an operation left active across a backend restart", async () => {
    const test = harness();
    test.workers.set("dead-worker", { id: "dead-worker", heartbeatAt: new Date(0), fenceEpoch: 0, fencedAt: null, fencedBy: null, fencingReason: null, stoppedAt: new Date() });
    test.operations.push({ id: "op-stale", generation: 1, kind: "company_document", status: "active", startedAt: new Date(), completedAt: null, failureKind: null, reconciledAt: null, reconciledBy: null, reconciliationReason: null, reconciliationOutcome: null, workerId: "dead-worker", workerFenceEpoch: 0 });
    await expect(test.coordinator.enable("admin-1")).resolves.toMatchObject({ mode: "draining", backupSafe: false });
    await expect(test.coordinator.disable("admin-1", "unsafe")).rejects.toMatchObject({ status: 409 });
    await expect(test.coordinator.reconcile("admin-1", "op-stale", "heartbeat is old", "confirmed_not_started")).rejects.toMatchObject({ status: 409 });
    await test.coordinator.fenceOperation("admin-1", "op-stale", "process termination is not proof of provider cancellation");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "recovery_required", fencedOperations: 1, backupSafe: false });
    await test.coordinator.reconcile("admin-1", "op-stale", "provider state checked", "confirmed_not_started");
    await expect(test.coordinator.acknowledgeQuiescent("admin-1", "stale operation reconciled")).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
  });

  it("keeps a slow provider operation in recovery after its worker is fenced", async () => {
    const test = harness();
    const entered = deferred<void>(); const continueProvider = deferred<void>();
    const mutation = test.coordinator.run("identity_document", async lease => {
      await lease.assertNotFenced();
      entered.resolve();
      await continueProvider.promise;
      await lease.assertNotFenced(); // must run before a subsequent provider/local mutation
    });
    await entered.promise;
    await test.coordinator.enable("admin-1");
    await test.coordinator.fenceOperation("admin-1", test.operations[0].id, "provider request exceeded maintenance drain");
    continueProvider.resolve();
    await expect(mutation).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "recovery_required", fencedOperations: 1, backupSafe: false });
    await expect(test.coordinator.acknowledgeQuiescent("admin-1", "unsafe")).rejects.toMatchObject({ status: 409 });
  });

  it("serializes concurrent fencing and completion without a false quiescent transition", async () => {
    const test = harness();
    const provider = deferred<void>();
    const mutation = test.coordinator.run("profile_photo", async lease => { await lease.assertNotFenced(); await provider.promise; });
    await waitFor(() => test.operations.length === 1);
    await test.coordinator.enable("admin-1");
    const fence = test.coordinator.fenceOperation("admin-1", test.operations[0].id, "operator intervention");
    provider.resolve();
    const result = await Promise.allSettled([fence, mutation]);
    expect(result[1].status).toBe("rejected");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "recovery_required", fencedOperations: 1, backupSafe: false });
  });

  it("rejects reconciliation racing a live operation completion", async () => {
    const test = harness();
    const provider = deferred<void>();
    const mutation = test.coordinator.run("company_document", async lease => { await lease.assertNotFenced(); await provider.promise; });
    await waitFor(() => test.operations.length === 1);
    await test.coordinator.enable("admin-1");
    const reconcile = test.coordinator.reconcile("admin-2", test.operations[0].id, "operation may still be executing", "confirmed_not_started");
    provider.resolve();
    await expect(reconcile).rejects.toMatchObject({ status: 409 });
    await mutation;
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true, fencedOperations: 0 });
  });

  it("stays draining while an admitted photo operation waits for its database reference update", async () => {
    const test = harness();
    const providerUploaded = deferred<void>(); const databaseUpdated = deferred<void>();
    const mutation = test.coordinator.run("profile_photo", async lease => {
      await lease.assertNotFenced(); // provider upload admission
      providerUploaded.resolve();
      await databaseUpdated.promise; // outer mutation boundary includes profile update
    });
    await providerUploaded.promise;
    await expect(test.coordinator.enable("admin-1")).resolves.toMatchObject({ mode: "draining", activeOperations: 1, backupSafe: false });
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "draining", backupSafe: false });
    databaseUpdated.resolve();
    await mutation;
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
  });

  it("persists sanitized cleanup context, requires reconciliation, and cannot become backup-safe first", async () => {
    const test = harness();
    const failure = deferred<void>();
    const mutation = test.coordinator.run("company_document", async () => failure.promise);
    await waitFor(() => test.operations.length === 1);
    await test.coordinator.enable("admin-1");
    failure.reject(new StorageMutationReconciliationRequiredError("company_document_old_cleanup_uncertain", { phase: "old_document_cleanup", storagePublicIds: ["private-local:company-documents/client/certificate.pdf"] }));
    await expect(mutation).rejects.toBeInstanceOf(StorageMutationReconciliationRequiredError);
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "recovery_required", failedOperations: 1, backupSafe: false, operations: [expect.objectContaining({ failureKind: "company_document_old_cleanup_uncertain", failureContext: { phase: "old_document_cleanup", storagePublicIds: ["private-local:company-documents/client/certificate.pdf"] } })] });
    await test.coordinator.reconcile("admin-2", test.operations[0].id, "local storage identity inspected", "provider_reconciled");
    await test.coordinator.acknowledgeQuiescent("admin-2", "cleanup reconciled");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
  });

  it("stays draining during a company-document replacement until old-object cleanup completes", async () => {
    const test = harness();
    const databaseCommitted = deferred<void>(); const oldCleanupDone = deferred<void>();
    const mutation = test.coordinator.run("company_document", async lease => {
      await lease.assertNotFenced(); // new private document upload
      databaseCommitted.resolve(); // new reference is now committed
      await oldCleanupDone.promise; // old private object cleanup remains part of this operation
      await lease.assertNotFenced();
    });
    await databaseCommitted.promise;
    await test.coordinator.enable("admin-1");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "draining", activeOperations: 1, backupSafe: false });
    oldCleanupDone.resolve();
    await mutation;
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
  });

  it("acquires a durable generation-bound capture lease and releases it only after a successful outcome", async () => {
    const test = harness();
    await test.coordinator.enable("admin-1");
    const captured = await test.coordinator.acquireCaptureLease("admin-1", "approved local backup capture");
    expect(captured).toMatchObject({ mode: "quiescent", backupSafe: false, captureGeneration: 1, captureOutcome: null, captureLeaseId: expect.any(String) });
    await expect(test.coordinator.disable("admin-1", "unsafe during capture")).rejects.toMatchObject({ status: 409 });
    await expect(test.coordinator.run("profile_photo", async () => undefined)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(test.coordinator.releaseCaptureLease("admin-1", captured.captureLeaseId!, captured.captureGeneration!, "too early")).rejects.toMatchObject({ status: 409 });
    await test.coordinator.recordCaptureOutcome("admin-1", captured.captureLeaseId!, captured.captureGeneration!, "succeeded", "manifest verified");
    await expect(test.coordinator.releaseCaptureLease("admin-1", captured.captureLeaseId!, captured.captureGeneration!, "capture recorded")).resolves.toMatchObject({ backupSafe: true, captureLeaseId: null });
    expect(test.audits.map(entry => entry.action)).toEqual(expect.arrayContaining(["acquire_storage_capture_lease", "record_storage_capture_outcome", "release_storage_capture_lease"]));
  });

  it("rejects capture outside quiescence and serializes concurrent acquisition", async () => {
    const test = harness();
    await expect(test.coordinator.acquireCaptureLease("admin-1", "not enabled")).rejects.toMatchObject({ status: 409 });
    await test.coordinator.enable("admin-1");
    const attempts = await Promise.allSettled([test.coordinator.acquireCaptureLease("admin-1", "capture one"), test.coordinator.acquireCaptureLease("admin-2", "capture two")]);
    expect(attempts.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(attempts.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it("rejects wrong lease generation/token and preserves an active lease across backend restart", async () => {
    const test = harness();
    await test.coordinator.enable("admin-1");
    const captured = await test.coordinator.acquireCaptureLease("admin-1", "backup capture");
    await expect(test.coordinator.recordCaptureOutcome("admin-1", "00000000-0000-4000-8000-000000000000", captured.captureGeneration!, "succeeded", "wrong token")).rejects.toMatchObject({ status: 409 });
    await expect(test.coordinator.recordCaptureOutcome("admin-1", captured.captureLeaseId!, captured.captureGeneration! + 1, "succeeded", "wrong generation")).rejects.toMatchObject({ status: 409 });
    const restarted = new StorageMutationCoordinator((test.coordinator as any).prisma);
    await expect(restarted.status()).resolves.toMatchObject({ captureLeaseId: captured.captureLeaseId, backupSafe: false });
    await expect(restarted.acquireCaptureLease("admin-2", "second capture")).rejects.toMatchObject({ status: 409 });
  });

  it("keeps failed capture held until audited recovery and serializes release against disable", async () => {
    const test = harness();
    await test.coordinator.enable("admin-1");
    const captured = await test.coordinator.acquireCaptureLease("admin-1", "backup capture");
    await test.coordinator.recordCaptureOutcome("admin-1", captured.captureLeaseId!, captured.captureGeneration!, "failed", "backup process exited without a verified set");
    await expect(test.coordinator.releaseCaptureLease("admin-1", captured.captureLeaseId!, captured.captureGeneration!, "unsafe normal release")).rejects.toMatchObject({ status: 409 });
    const recovered = test.coordinator.recoverCaptureLease("admin-2", captured.captureLeaseId!, captured.captureGeneration!, "incident reviewed; no capture trusted");
    const disabled = test.coordinator.disable("admin-1", "race capture recovery");
    const results = await Promise.allSettled([recovered, disabled]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(2);
    await expect(test.coordinator.status()).resolves.toMatchObject({ captureLeaseId: null, mode: "inactive" });
  });

  it("does not treat a previously failed operation as backup-safe until reconciled", async () => {
    const test = harness();
    await expect(test.coordinator.run("profile_photo", async () => { throw new Error("local write failed"); })).rejects.toThrow("local write failed");
    await expect(test.coordinator.enable("admin-1")).resolves.toMatchObject({ mode: "recovery_required", backupSafe: false, failedOperations: 1 });
    await test.coordinator.reconcile("admin-1", test.operations[0].id, "local path inspected", "confirmed_not_started");
    await test.coordinator.acknowledgeQuiescent("admin-1", "failure reconciled");
    await expect(test.coordinator.status()).resolves.toMatchObject({ mode: "quiescent", backupSafe: true });
  });

  it("keeps authenticated download/read handlers outside the storage mutation gate", async () => {
    const root = resolve(__dirname, "..");
    const [freelancers, companies, identity, company] = await Promise.all([
      readFile(resolve(root, "src/profiles/freelancer-profile.controller.ts"), "utf8"),
      readFile(resolve(root, "src/profiles/company-profile.controller.ts"), "utf8"),
      readFile(resolve(root, "src/kyc/identity-document.service.ts"), "utf8"),
      readFile(resolve(root, "src/profiles/company-document.service.ts"), "utf8"),
    ]);
    expect(freelancers).toMatch(/@Post\("me\/identity-document"\)\s+@StorageMutation\(\)/);
    expect(freelancers).toMatch(/@Post\("me\/profile-photo"\)\s+@StorageMutation\(\)/);
    expect(companies).toMatch(/@Post\("me\/logo"\)\s+@StorageMutation\(\)/);
    expect(companies).toMatch(/@Post\("me\/documents"\)\s+@StorageMutation\(\)/);
    expect(freelancers).toMatch(/@Get\("me\/identity-document\/file"\)[\s\S]*?identityDocumentService\.fileForOwner/);
    expect(companies).toMatch(/@Get\("me\/documents\/:documentId\/file"\)[\s\S]*?companyDocumentService\.fileForOwner/);
    expect(identity).toMatch(/async fileForOwner[\s\S]*?fileForDocument/);
    expect(company).toMatch(/async fileForOwner[\s\S]*?fileForDocument/);
  });
});
