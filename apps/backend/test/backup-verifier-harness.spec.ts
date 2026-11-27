import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { assertDisposableOwnerUrl, assertFreshDatabaseIdentity, assertHarnessMarkerIdentity, createInvoker, effectiveEnvironment, safeDiagnostic } from "../../../scripts/backup-verifier-security-harness-safety.mjs";

const root = resolve(__dirname, "..", "..", "..");
const migration = resolve(root, "packages/database/prisma/migrations/20261124000000_independent_verifier_foundation/migration.sql");
const storageKeyMigration = resolve(root, "packages/database/prisma/migrations/20261125000000_backup_canonical_storage_key_constraint/migration.sql");
const compose = resolve(root, "deploy/backup-verifier-security-test.compose.yml");
const provision = resolve(root, "deploy/backup-verifier-security-provision.sql");
const runner = resolve(root, "scripts/run-backup-verifier-security-harness.mjs");

describe("backup verifier disposable PostgreSQL harness contract", () => {
  it("uses a separate loopback PostgreSQL 16 project, volume, and port", async () => {
    const value = await readFile(compose, "utf8");
    expect(value).toContain("postgres:16-alpine");
    expect(value).toContain("127.0.0.1:${HARNESS_PORT:?Harness must supply a fresh loopback port}:5432");
    expect(value).toContain("${HARNESS_VOLUME:?Harness must supply a generated fresh volume name}");
  });

  it("requires explicit execution authorization and refuses non-harness targets", async () => {
    const value = await readFile(runner, "utf8");
    expect(value).toContain('PORISROM_EXECUTE_VERIFIER_SECURITY_HARNESS !== "yes"');
    expect(value).toContain('url.hostname !== "127.0.0.1"');
    expect(value).toContain("url.port !== harnessPort");
    expect(value).toContain("randomBytes(16)");
    expect(value).toContain("Fresh-run volume collision detected");
    expect(value).toContain("Fresh-run project collision detected");
    expect(value).toContain("Fresh loopback port collision detected");
    expect(value).toContain("Harness requires a local Docker context");
    expect(value).toContain("current_database(),current_setting('server_version_num')");
    expect(value).toContain('cwd: resolve(root, "packages/database")');
    expect(value).toContain("env: migrationEnvironment");
  });

  it("preserves the validated disposable migration environment and stops before downstream commands on failure", () => {
    const disposable = "postgresql://verifier_test_owner:verifier_test_owner_only@127.0.0.1:55443/porisrom_verifier_security_test";
    const calls: Array<{ command: string; options: { env: Record<string, string> } }> = [];
    const invoke = createInvoker({
      baseEnvironment: { DATABASE_URL: "postgresql://inherited-production.invalid/database", BASE: "base" }, root,
      shell: false,
      spawn: (command: string, _args: string[], options: { cwd: string; shell: boolean; encoding: string; env: Record<string, string | undefined> }) => { calls.push({ command, options: { env: options.env as Record<string, string> } }); return { status: 0, stdout: "" }; },
    });
    const migrationEnvironment = assertDisposableOwnerUrl(effectiveEnvironment({ DATABASE_URL: "postgresql://inherited-production.invalid/database", BASE: "base" }, { DATABASE_URL: disposable, COMMAND: "migration" }), disposable, "55443");
    invoke("pnpm", ["exec", "prisma", "migrate", "deploy"], { env: migrationEnvironment });
    expect(calls).toHaveLength(1);
    expect(calls[0].options.env).toMatchObject({ DATABASE_URL: disposable, BASE: "base", COMMAND: "migration" });
    expect(() => assertDisposableOwnerUrl({ DATABASE_URL: disposable }, disposable, "55439")).toThrow("Migration target is not");
    expect(() => assertDisposableOwnerUrl({ DATABASE_URL: disposable }, disposable, "invalid")).toThrow("Selected harness port is invalid");
    expect(() => assertDisposableOwnerUrl({ DATABASE_URL: "postgresql://verifier_test_owner:verifier_test_owner_only@localhost:55443/porisrom_verifier_security_test" }, "postgresql://verifier_test_owner:verifier_test_owner_only@localhost:55443/porisrom_verifier_security_test", "55443")).toThrow("Migration target is not");
    expect(() => assertDisposableOwnerUrl({ DATABASE_URL: "postgresql://other:secret@127.0.0.1:55443/wrong" }, "postgresql://other:secret@127.0.0.1:55443/wrong", "55443")).toThrow("Migration target is not");
    try { assertDisposableOwnerUrl({ DATABASE_URL: "postgresql://wrong:secret@127.0.0.1:55443/porisrom_verifier_security_test" }, disposable, "55443"); }
    catch (error) { expect(String(error)).toContain("Migration DATABASE_URL did not match"); expect(String(error)).not.toContain("secret"); }
    expect(() => assertFreshDatabaseIdentity("porisrom_verifier_security_test,wrong-user,160014,0", { database: "porisrom_verifier_security_test", owner: "verifier_test_owner" })).toThrow("fresh-database identity");
    expect(() => assertFreshDatabaseIdentity("porisrom_verifier_security_test,verifier_test_owner,160014,1", { database: "porisrom_verifier_security_test", owner: "verifier_test_owner" })).toThrow("fresh-database identity");
    expect(() => assertHarnessMarkerIdentity("porisrom_verifier_security_test,verifier_test_owner,160014,wrong", { database: "porisrom_verifier_security_test", owner: "verifier_test_owner", runId: "run" })).toThrow("post-migration marker");
    const failed = createInvoker({ baseEnvironment: migrationEnvironment, root, shell: false, spawn: () => ({ status: 1, stdout: "failure" }) });
    expect(() => failed("pnpm", ["exec", "prisma", "migrate", "deploy"])).toThrow("failure");
    expect(calls).toHaveLength(1);
    expect(safeDiagnostic("failed at postgresql://owner:secret@127.0.0.1:55439/db")).not.toContain("secret");
  });

  it("propagates child failure, timeout, and interrupted execution without reporting success", () => {
    const base = { DATABASE_URL: "postgresql://verifier_test_owner:verifier_test_owner_only@127.0.0.1:55443/porisrom_verifier_security_test" };
    const failure = createInvoker({ baseEnvironment: base, root, shell: false, spawn: () => ({ status: 1, stdout: "vitest failure", stderr: "" }) });
    expect(() => failure("pnpm", ["vitest"])).toThrow("vitest failure");
    const timeout = createInvoker({ baseEnvironment: base, root, shell: false, spawn: () => ({ status: null, signal: "SIGTERM", error: { code: "ETIMEDOUT" }, stdout: "partial", stderr: "" }) });
    expect(() => timeout("pnpm", ["vitest"])).toThrow("timed out or was interrupted");
  });

  it("keeps the fresh database marker after successful migration and before provisioning", async () => {
    const value = await readFile(runner, "utf8");
    const migration = value.indexOf('invoke("pnpm.cmd", ["exec", "prisma", "migrate", "deploy"]');
    const marker = value.indexOf('CREATE TABLE \\"__verifier_harness_marker\\"');
    const provision = value.indexOf('readFileSync(provision, "utf8")');
    expect(value.indexOf("assertFreshDatabaseIdentity(preMigrationIdentity")).toBeLessThan(migration);
    expect(migration).toBeLessThan(marker);
    expect(marker).toBeLessThan(value.indexOf("assertHarnessMarkerIdentity(postMigrationIdentity"));
    expect(value.indexOf("assertHarnessMarkerIdentity(postMigrationIdentity")).toBeLessThan(provision);
    expect(value).toContain("--testTimeout=10000");
    expect(value).toContain("--hookTimeout=10000");
    expect(value).toContain("Verifier PostgreSQL test reporter did not emit a complete passing summary");
  });

  it("keeps every PostgreSQL assertion URL bound to the explicit trusted harness port", async () => {
    const value = await readFile(resolve(root, "apps/backend/test/backup-verifier-postgres.spec.ts"), "utf8");
    expect(value).toContain("const harnessPort = process.env.PORISROM_VERIFIER_TEST_PORT");
    expect(value).toContain("target.port !== harnessPort");
    expect(value).toContain("Explicit verifier harness execution requires all synthetic URLs and a selected port");
    expect(value).toContain("decodeURIComponent(target.username) !== username");
    expect(value).toContain("decodeURIComponent(target.password) !== password");
    expect(value).not.toContain('target.port !== "55439"');
  });

  it("provisions purpose-specific noinherit roles and grants functions rather than evidence-table writes", async () => {
    const value = await readFile(provision, "utf8");
    for (const role of ["verifier_test_coordinator", "verifier_test_finalizer", "verifier_test_artifact", "verifier_test_restore"]) {
      expect(value).toContain("CREATE ROLE " + role);
      expect(value).toContain("NOINHERIT");
    }
    expect(value).toContain('GRANT EXECUTE ON FUNCTION "backup_admit_capture_verification"');
    expect(value).toContain('GRANT EXECUTE ON FUNCTION "backup_admit_restore_verification"');
    expect(value).toContain("REVOKE ALL ON ALL TABLES IN SCHEMA public");
  });

  it("contains the objects required for future privilege, immutability, identity, and lock tests", async () => {
    const value = await readFile(migration, "utf8");
    for (const required of [
      'FOREIGN KEY ("verifierCertificateId", "verifierPrincipalId", "certificatePurpose")',
      'CHECK ("certificatePurpose" = \'artifact_verifier\')',
      'CHECK ("certificatePurpose" = \'restore_verifier\')',
      'CREATE TRIGGER "BackupCanonicalSet_immutable"',
      'CREATE TRIGGER "BackupCaptureVerificationAttempt_immutable"',
      'CREATE TRIGGER "BackupRestoreVerificationAttempt_immutable"',
      'CREATE TRIGGER "BackupVerifierCertificate_revocation_guard"',
      'SECURITY DEFINER SET search_path = pg_catalog, public',
      'FOR UPDATE',
    ]) expect(value).toContain(required);
  });

  it("uses PostgreSQL-compatible explicit bounds for canonical logical storage keys", async () => {
    const value = await readFile(storageKeyMigration, "utf8");
    expect(value).toContain('DROP CONSTRAINT "BackupCanonicalSet_canonicalStorageKey_check"');
    expect(value).toContain('char_length("canonicalStorageKey") <= 529');
    expect(value).toContain("NOT LIKE '%//%'");
    expect(value).not.toContain("[A-Za-z0-9._/-]{0,511}");
  });
});
