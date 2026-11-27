import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = join(process.cwd(), "../../packages/database/prisma/migrations/20261126000000_verified_artifact_admission/migration.sql");
const provision = join(process.cwd(), "../../deploy/backup-verifier-security-provision.sql");

describe("verified artifact admission migration contract", () => {
  it("requires an artifact-verifier database identity and exact v2 proof binding", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toContain("session_user");
    expect(sql).toContain("purpose = 'artifact_verifier'");
    expect(sql).toContain("independent-artifact-ed25519-v2");
    expect(sql).toContain("canonical evidence binding mismatch");
    expect(sql).toContain("p_proof->>'evidenceSha256' <> p_evidence_sha256");
    expect(sql).toContain("conflicting capture evidence idempotency key");
    expect(sql).toContain("FOR UPDATE");
  });

  it("grants the verified capability only to the disposable artifact verifier role", async () => {
    const sql = await readFile(provision, "utf8");
    const grant = sql.match(/GRANT EXECUTE ON FUNCTION "backup_admit_verified_capture_verification"[^;]+;/)?.[0] ?? "";
    expect(grant).toContain("verifier_test_admission");
    expect(grant).not.toContain("verifier_test_artifact");
    expect(grant).not.toContain("verifier_test_coordinator");
    expect(grant).not.toContain("verifier_test_finalizer");
  });
});
