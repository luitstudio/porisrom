import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { StorageMutationCoordinator } from "./storage-mutation-coordinator.service";

type BackupClass = "daily" | "weekly" | "monthly";
const SCHEDULER_SYSTEM_PRINCIPAL = "backup-scheduler";

/**
 * Opt-in, backend-internal scheduler. It has no HTTP route and derives every
 * occurrence from a stable UTC schedule key, making restarts and replicas safe.
 */
@Injectable()
export class BackupSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BackupSchedulerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly config: ConfigService, private readonly maintenance: StorageMutationCoordinator) {}

  onModuleInit() {
    if (this.config.get<string>("BACKUP_SCHEDULER_ENABLED") !== "true") return;
    this.requireConfiguration();
    void this.tick();
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private requireConfiguration() {
    for (const key of ["BACKUP_SCHEDULER_COORDINATOR_PRINCIPAL_ID"]) {
      if (!this.config.get<string>(key)?.trim()) throw new Error(`${key} is required when BACKUP_SCHEDULER_ENABLED=true`);
    }
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const now = new Date();
      for (const occurrence of dueOccurrences(now)) await this.schedule(occurrence.backupClass, occurrence.scheduledFor);
    } catch (error) {
      this.logger.error("Backup scheduler tick failed", error instanceof Error ? error.stack : undefined);
    } finally {
      this.running = false;
    }
  }

  private async schedule(backupClass: BackupClass, scheduledFor: Date) {
    const coordinatorPrincipalId = this.config.getOrThrow<string>("BACKUP_SCHEDULER_COORDINATOR_PRINCIPAL_ID");
    const reason = "durable internal scheduled backup occurrence";
    const created = await this.maintenance.createSystemBackupCaptureRequest(SCHEDULER_SYSTEM_PRINCIPAL, { scheduleKey: backupClass, scheduledFor, backupClass }, reason);
    await this.maintenance.assignSystemBackupCaptureCoordinator(SCHEDULER_SYSTEM_PRINCIPAL, created.request.id, coordinatorPrincipalId, reason);
    await this.maintenance.advanceSystemBackupCaptureRequest(SCHEDULER_SYSTEM_PRINCIPAL, created.request.id, reason);
  }
}

function dueOccurrences(now: Date): Array<{ backupClass: BackupClass; scheduledFor: Date }> {
  const at = (hour: number, minute: number) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute));
  const occurrences: Array<{ backupClass: BackupClass; scheduledFor: Date }> = [];
  const daily = at(2, 15); if (now >= daily) occurrences.push({ backupClass: "daily", scheduledFor: daily });
  const weekly = at(3, 15); if (now.getUTCDay() === 0 && now >= weekly) occurrences.push({ backupClass: "weekly", scheduledFor: weekly });
  const monthly = at(4, 15); if (now.getUTCDate() === 1 && now >= monthly) occurrences.push({ backupClass: "monthly", scheduledFor: monthly });
  return occurrences;
}
