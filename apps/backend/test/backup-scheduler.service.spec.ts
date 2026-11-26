import { describe, expect, it, vi } from "vitest";

import { BackupSchedulerService } from "../src/storage-maintenance/backup-scheduler.service";

function setup(values: Record<string, string | undefined>) {
  const config = {
    get: <T>(key: string) => values[key] as T | undefined,
    getOrThrow: <T>(key: string) => {
      const value = values[key];
      if (!value) throw new Error(`${key} is required`);
      return value as T;
    },
  };
  const maintenance = {
    createSystemBackupCaptureRequest: vi.fn().mockResolvedValue({ request: { id: "request-1" } }),
    assignSystemBackupCaptureCoordinator: vi.fn().mockResolvedValue({}),
    advanceSystemBackupCaptureRequest: vi.fn().mockResolvedValue({}),
  };
  return { service: new BackupSchedulerService(config as never, maintenance as never), maintenance };
}

describe("backup scheduler identity and configuration", () => {
  it("is disabled by default and performs no mutation", () => {
    const test = setup({ BACKUP_SCHEDULER_ENABLED: "false" });
    test.service.onModuleInit();
    expect(test.maintenance.createSystemBackupCaptureRequest).not.toHaveBeenCalled();
  });

  it.each(["BACKUP_SCHEDULER_COORDINATOR_PRINCIPAL_ID"])("rejects enabled scheduler without %s", (missing) => {
    const test = setup({
      BACKUP_SCHEDULER_ENABLED: "true",
      BACKUP_SCHEDULER_COORDINATOR_PRINCIPAL_ID: missing === "BACKUP_SCHEDULER_COORDINATOR_PRINCIPAL_ID" ? undefined : "coordinator-principal",
    });
    expect(() => test.service.onModuleInit()).toThrow(`${missing} is required`);
  });

  it("uses only its fixed internal identity and a separate coordinator binding", async () => {
    const test = setup({
      BACKUP_SCHEDULER_ENABLED: "true",
      BACKUP_SCHEDULER_PRINCIPAL_ID: "forged-admin-id-must-be-ignored",
      BACKUP_SCHEDULER_COORDINATOR_PRINCIPAL_ID: "coordinator-principal",
    });
    await (test.service as any).schedule("daily", new Date("2026-11-18T02:15:00.000Z"));
    expect(test.maintenance.createSystemBackupCaptureRequest).toHaveBeenCalledWith("backup-scheduler", expect.objectContaining({ scheduleKey: "daily", backupClass: "daily" }), expect.any(String));
    expect(test.maintenance.assignSystemBackupCaptureCoordinator).toHaveBeenCalledWith("backup-scheduler", "request-1", "coordinator-principal", expect.any(String));
    expect(test.maintenance.advanceSystemBackupCaptureRequest).toHaveBeenCalledWith("backup-scheduler", "request-1", expect.any(String));
  });
});
