import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..", "..", "..");
const schemaPath = resolve(root, "packages/database/prisma/schema.prisma");
const migrationPath = resolve(root, "packages/database/prisma/migrations/20261121000000_backup_capture_request_job/migration.sql");
const assignmentMigrationPath = resolve(root, "packages/database/prisma/migrations/20261123000000_backup_capture_principal_assignment/migration.sql");

describe("BackupCapture schema foundation", () => {
  it("models a unique schedule occurrence, one job per request, and lease/job binding", async () => {
    const schema = await readFile(schemaPath, "utf8");
    expect(schema).toMatch(/enum BackupCaptureClass[\s\S]*daily[\s\S]*weekly[\s\S]*monthly/);
    expect(schema).toMatch(/model BackupCaptureRequest[\s\S]*@@unique\(\[scheduleKey, scheduledFor\]\)/);
    expect(schema).toMatch(/model BackupCaptureJob[\s\S]*requestId\s+String\s+@unique/);
    expect(schema).toMatch(/model BackupCaptureJob[\s\S]*leaseId\s+String\s+@unique/);
    expect(schema).toMatch(/model StorageMaintenanceState[\s\S]*captureJobId\s+String\?\s+@unique/);
  });

  it("keeps coordinator assignment nullable for legacy records and restrictive for principals", async () => {
    const [schema, migration] = await Promise.all([readFile(schemaPath, "utf8"), readFile(assignmentMigrationPath, "utf8")]);
    expect(schema).toMatch(/model BackupCaptureRequest[\s\S]*authorizedCoordinatorPrincipalId\s+String\?/);
    expect(schema).toMatch(/model BackupCaptureJob[\s\S]*authorizedCoordinatorPrincipalId\s+String\?/);
    expect(migration).toContain('ADD COLUMN "authorizedCoordinatorPrincipalId" TEXT');
    expect(migration).toContain('ON DELETE RESTRICT ON UPDATE CASCADE');
    expect(migration).not.toMatch(/UPDATE\s+"BackupCapture|SET\s+"authorizedCoordinatorPrincipalId"|DELETE\s+FROM|TRUNCATE/i);
  });

  it("keeps system coordinator auditing separate from AdminActionLog", async () => {
    const schema = await readFile(schemaPath, "utf8");
    expect(schema).toMatch(/model AdminActionLog/);
    expect(schema).toMatch(/model BackupCoordinatorActionLog[\s\S]*principalId\s+String/);
    expect(schema).toMatch(/BackupCoordinatorActionLog[\s\S]*@@index\(\[leaseId, createdAt\]\)/);
  });

  it("creates additive tables, indexes, and foreign keys without modifying existing rows", async () => {
    const migration = await readFile(migrationPath, "utf8");
    for (const required of ["CREATE TABLE \"BackupCaptureRequest\"", "CREATE TABLE \"BackupCaptureJob\"", "CREATE TABLE \"BackupCoordinatorActionLog\"", "ALTER TABLE \"StorageMaintenanceState\" ADD COLUMN \"captureJobId\"", "BackupCaptureJob_requestId_fkey", "StorageMaintenanceState_captureJobId_fkey"]) {
      expect(migration).toContain(required);
    }
    expect(migration).not.toMatch(/DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i);
  });
});
