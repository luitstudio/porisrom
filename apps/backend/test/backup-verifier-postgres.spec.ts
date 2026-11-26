import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { afterAll, describe, expect, it } from "vitest";

const urls = {
  owner: process.env.PORISROM_VERIFIER_TEST_DATABASE_URL,
  coordinator: process.env.PORISROM_VERIFIER_TEST_COORDINATOR_URL,
  finalizer: process.env.PORISROM_VERIFIER_TEST_FINALIZER_URL,
  artifact: process.env.PORISROM_VERIFIER_TEST_ARTIFACT_URL,
  admission: process.env.PORISROM_VERIFIER_TEST_ADMISSION_URL,
  restore: process.env.PORISROM_VERIFIER_TEST_RESTORE_URL,
};
const harnessPort = process.env.PORISROM_VERIFIER_TEST_PORT;
const identities = {
  owner: ["verifier_test_owner", "verifier_test_owner_only"],
  coordinator: ["verifier_test_coordinator", "verifier_test_coordinator_only"],
  finalizer: ["verifier_test_finalizer", "verifier_test_finalizer_only"],
  artifact: ["verifier_test_artifact", "verifier_test_artifact_only"],
  admission: ["verifier_test_admission", "verifier_test_admission_only"],
  restore: ["verifier_test_restore", "verifier_test_restore_only"],
} as const;
const urlsConfigured = Object.values(urls).every(Boolean);
const enabled = urlsConfigured && Boolean(harnessPort);
const pools = enabled ? Object.fromEntries(Object.entries(urls).map(([name, connectionString]) => [name, new Pool({ connectionString, max: 2, connectionTimeoutMillis: 2000 })])) as Record<keyof typeof urls, Pool> : undefined;
const digest = (value: string) => Buffer.from(value).toString("hex").padEnd(64, "0").slice(0, 64);
const verifiedAt = "2026-11-20T00:00:00.000Z";

function sanitizedPgDiagnostic(error: unknown) {
  const value = error as { code?: unknown; message?: unknown };
  return {
    sqlstate: typeof value?.code === "string" ? value.code : "<missing>",
    message: String(value?.message ?? error)
      .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[redacted]@")
      .replace(/[\r\n]+/g, " "),
  };
}

async function expectPgFailure(operation: string, action: () => Promise<unknown>, expectedSqlstate: string) {
  let failure: unknown;
  try { await action(); }
  catch (error) { failure = error; }
  const diagnostic = sanitizedPgDiagnostic(failure);
  expect(failure, `${operation}: expected PostgreSQL rejection ${expectedSqlstate}; diagnostic=${JSON.stringify(diagnostic)}`).toBeDefined();
  expect(diagnostic.sqlstate, `${operation}: expected SQLSTATE ${expectedSqlstate}; diagnostic=${JSON.stringify(diagnostic)}`).toBe(expectedSqlstate);
}

function assertTarget(name: keyof typeof identities, value: string | undefined) {
  if (!/^[1-9][0-9]{3,4}$/.test(harnessPort ?? "") || Number(harnessPort) > 65535) throw Error("Verifier harness selected port is invalid");
  if (!value) throw Error("Verifier harness URL missing");
  const target = new URL(value);
  const [username, password] = identities[name];
  if (target.protocol !== "postgresql:" || target.hostname !== "127.0.0.1" || target.port !== harnessPort || target.pathname !== "/porisrom_verifier_security_test" ||
      decodeURIComponent(target.username) !== username || decodeURIComponent(target.password) !== password) throw Error("Verifier PostgreSQL tests refuse non-disposable targets");
}
if (process.env.PORISROM_EXECUTE_VERIFIER_SECURITY_HARNESS === "yes" && !enabled) throw Error("Explicit verifier harness execution requires all synthetic URLs and a selected port");
async function denied(action: () => Promise<unknown>, codes = ["42501", "55000", "23514", "23505"]) {
  try { await action(); throw Error("Expected PostgreSQL denial"); }
  catch (error: any) { expect(codes).toContain(error.code); }
}

type Fixture = { id: string; canonicalId: string; jobId: string; requestId: string; attemptId: string; leaseId: string; artifactFingerprint: string; restoreFingerprint: string };
async function fixture(published = true): Promise<Fixture> {
  const db = pools!.owner; const id = randomUUID().replaceAll("-", "");
  const values = { canonicalId: "set-" + id, jobId: "job-" + id, requestId: "request-" + id, attemptId: randomUUID(), leaseId: randomUUID(), artifactFingerprint: "a".repeat(64), restoreFingerprint: "b".repeat(64) };
  await db.query('INSERT INTO "BackupCaptureRequest" (id,"scheduleKey","scheduledFor","backupClass",status,"updatedAt") VALUES ($1,$2,NOW(),$3,$4,NOW())', [values.requestId, "schedule-" + id, "daily", "ready"]);
  await db.query('INSERT INTO "BackupCaptureJob" (id,"requestId","backupClass","leaseId","leaseGeneration",status,"coordinatorAttemptId") VALUES ($1,$2,$3,$4,7,$5,$6)', [values.jobId, values.requestId, "daily", values.leaseId, "reported", values.attemptId]);
  if (published) await db.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', [values.canonicalId, values.jobId, values.requestId, values.attemptId, values.leaseId, "daily", digest("manifest" + id), "backup-canonical/" + id + "/manifest"]);
  return { id, ...values };
}
async function insertCanonical(row: Fixture, canonicalStorageKey: string) {
  return pools!.owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', [row.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, "daily", digest("manifest" + row.id), canonicalStorageKey]);
}
async function admit(client: Pool | Pick<PoolClient, "query">, kind: "capture" | "restore", row: Fixture, result: "failed" | "incomplete" | "verified", key: string, fingerprint = kind === "capture" ? row.artifactFingerprint : row.restoreFingerprint, overrides: Partial<Fixture & { manifest: string }> = {}) {
  const fn = kind === "capture" ? '"backup_admit_capture_verification"' : '"backup_admit_restore_verification"';
  const parameters = [randomUUID(), row.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, 7, "daily", overrides.manifest ?? digest("manifest" + row.id), fingerprint, "security-test-v1", result, JSON.stringify({ result, fixture: row.id }), digest("evidence" + key), key];
  const query = 'SELECT * FROM ' + fn + '($1,$2,$3,$4,$5,$6,$7,$8::"BackupCaptureClass",$9,$10,$11,$12::"BackupVerificationResult",$13::jsonb,$14,$15)';
  if (!("connect" in client)) return client.query(query, parameters);
  const connection = await client.connect();
  try {
    await connection.query("BEGIN"); await connection.query("SET LOCAL lock_timeout='500ms'"); await connection.query("SET LOCAL statement_timeout='1500ms'");
    const result = await connection.query(query, parameters); await connection.query("COMMIT"); return result;
  } catch (error) { await connection.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { connection.release(); }
}
async function admitVerified(client: Pool, row: Fixture, key: string, mutate: Record<string, unknown> = {}) {
  const manifestSha256 = digest("manifest" + row.id); const evidenceSha256 = digest("evidence" + key);
  const proof = { canonicalSetId: row.canonicalId, captureJobId: row.jobId, captureRequestId: row.requestId, captureAttemptId: row.attemptId, leaseId: row.leaseId, generation: 7, backupClass: "daily", manifestSha256, canonicalStorageKey: "backup-canonical/" + row.id + "/manifest", proofVersion: 2, verificationMethod: "independent-artifact-ed25519-v2", result: "verified", verifiedAt, artifactHashes: { "database.dump.age": digest("db" + row.id), "production_public_assets.tar.age": digest("public" + row.id), "production_private_documents.tar.age": digest("private" + row.id) }, verifierPrincipalId: "verifier-test-artifact", verifierCertificateFingerprint: row.artifactFingerprint, evidenceSha256, idempotencyKey: key, signature: "A".repeat(86), ...mutate };
  const values = [randomUUID(), row.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, 7, "daily", manifestSha256, row.artifactFingerprint, "independent-artifact-ed25519-v2", JSON.stringify(proof), proof.signature, evidenceSha256, key];
  const connection = await client.connect();
  try {
    await connection.query("BEGIN"); await connection.query("SET LOCAL lock_timeout='500ms'"); await connection.query("SET LOCAL statement_timeout='1500ms'");
    const result = await connection.query('SELECT * FROM "backup_admit_verified_capture_verification"($1,$2,$3,$4,$5,$6,$7,$8::"BackupCaptureClass",$9,$10,$11,$12::jsonb,$13,$14,$15)', values);
    await connection.query("COMMIT"); return result;
  } catch (error) { await connection.query("ROLLBACK").catch(() => undefined); throw error; }
  finally { connection.release(); }
}

describe.skipIf(!enabled)("disposable PostgreSQL independent-verifier security assertions", () => {
  if (enabled) for (const [name, value] of Object.entries(urls)) assertTarget(name as keyof typeof identities, value);
  afterAll(async () => { await Promise.all(Object.values(pools!).map(pool => pool.end())); });

  it("has purpose checks, composite certificate FKs, canonical binding, uniqueness, and safe SECURITY DEFINER metadata", async () => {
    const constraints = await pools!.owner.query("SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid IN ('\"BackupCaptureVerificationAttempt\"'::regclass, '\"BackupRestoreVerificationAttempt\"'::regclass, '\"BackupCanonicalSet\"'::regclass)");
    const text = constraints.rows.map(row => row.definition).join("\n");
    expect(text).toContain("artifact_verifier"); expect(text).toContain("restore_verifier"); expect(text).toContain("FOREIGN KEY");
    const functions = await pools!.owner.query("SELECT p.prosecdef, p.proconfig, r.rolname FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.proname IN ('backup_admit_capture_verification','backup_admit_restore_verification')");
    expect(functions.rows).toHaveLength(2); for (const row of functions.rows) { expect(row.prosecdef).toBe(true); expect(String(row.proconfig)).toContain("search_path=pg_catalog, public"); expect(row.rolname).toBe("verifier_test_owner"); }
  });

  it("rejects canonical/evidence mutation and certificate identity deletion or reactivation", async () => {
    const row = await fixture(); const owner = pools!.owner;
    await denied(() => owner.query('UPDATE "BackupCanonicalSet" SET "manifestFormatVersion"=2 WHERE id=$1', [row.canonicalId]));
    await denied(() => owner.query('DELETE FROM "BackupCanonicalSet" WHERE id=$1', [row.canonicalId]));
    const admitted = await admit(pools!.artifact, "capture", row, "failed", "immutable");
    const id = admitted.rows[0].attemptId;
    await denied(() => owner.query('UPDATE "BackupCaptureVerificationAttempt" SET result=$1 WHERE id=$2', ["incomplete", id]));
    await denied(() => owner.query('DELETE FROM "BackupCaptureVerificationAttempt" WHERE id=$1', [id]));
    const restore = await admit(pools!.restore, "restore", row, "incomplete", "restore-immutable");
    await denied(() => owner.query('UPDATE "BackupRestoreVerificationAttempt" SET result=$1 WHERE id=$2', ["failed", restore.rows[0].attemptId]));
    await denied(() => owner.query('DELETE FROM "BackupRestoreVerificationAttempt" WHERE id=$1', [restore.rows[0].attemptId]));
    const certificate = digest("certificate-" + row.id);
    await owner.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose) VALUES ($1,$2,$3,$4)', ["immutable-" + row.id, "verifier-test-artifact", certificate, "artifact_verifier"]);
    await denied(() => owner.query('UPDATE "BackupVerifierCertificate" SET fingerprint=$1 WHERE fingerprint=$2', [digest("changed"), certificate]));
    await owner.query('UPDATE "BackupVerifierCertificate" SET status=$1,"revokedAt"=NOW() WHERE fingerprint=$2', ["revoked", certificate]);
    await denied(() => owner.query('UPDATE "BackupVerifierCertificate" SET status=$1 WHERE fingerprint=$2', ["active", certificate]));
    await denied(() => owner.query('DELETE FROM "BackupVerifierCertificate" WHERE fingerprint=$1', [certificate]));
    const keyFingerprint = digest("key-" + row.id);
    await owner.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose) VALUES ($1,$2,$3,$4)', ["key-" + row.id, "verifier-test-artifact", keyFingerprint, "artifact_verifier"]);
    await owner.query('UPDATE "BackupVerifierCertificate" SET "signingPublicKeyPem"=$1 WHERE fingerprint=$2', ["-----BEGIN PUBLIC KEY-----\nsynthetic\n-----END PUBLIC KEY-----", keyFingerprint]);
    await denied(() => owner.query('UPDATE "BackupVerifierCertificate" SET "signingPublicKeyPem"=$1 WHERE fingerprint=$2', ["-----BEGIN PUBLIC KEY-----\nreplacement\n-----END PUBLIC KEY-----", keyFingerprint]), ["23514", "55000"]);
    await denied(() => owner.query('UPDATE "BackupVerifierCertificate" SET "signingPublicKeyPem"=NULL WHERE fingerprint=$1', [keyFingerprint]), ["23514", "55000"]);
    const revokedKey = digest("revoked-key-" + row.id);
    await owner.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose,status,"revokedAt") VALUES ($1,$2,$3,$4,$5,NOW())', ["revoked-key-" + row.id, "verifier-test-artifact", revokedKey, "artifact_verifier", "revoked"]);
    await denied(() => owner.query('UPDATE "BackupVerifierCertificate" SET "signingPublicKeyPem"=$1 WHERE fingerprint=$2', ["-----BEGIN PUBLIC KEY-----\nforbidden\n-----END PUBLIC KEY-----", revokedKey]), ["23514", "55000"]);
  });

  it("denies direct writes, cross-purpose function execution, unmapped users, and protected-object alteration", async () => {
    const row = await fixture();
    await denied(() => pools!.coordinator.query('INSERT INTO "BackupCaptureVerificationAttempt" (id) VALUES ($1)', [randomUUID()]));
    await denied(() => pools!.finalizer.query('INSERT INTO "BackupRestoreVerificationAttempt" (id) VALUES ($1)', [randomUUID()]));
    await denied(() => admit(pools!.artifact, "restore", row, "failed", "wrong-role"));
    await denied(() => admit(pools!.restore, "capture", row, "failed", "wrong-role"));
    await denied(() => admit(pools!.coordinator, "capture", row, "failed", "unmapped"));
    await denied(() => pools!.artifact.query('ALTER TABLE "BackupCaptureVerificationAttempt" DISABLE TRIGGER ALL'));
    await denied(() => pools!.artifact.query('ALTER FUNCTION "backup_admit_capture_verification"(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,INTEGER,"BackupCaptureClass",TEXT,TEXT,TEXT,"BackupVerificationResult",JSONB,TEXT,TEXT) OWNER TO verifier_test_artifact'));
    const verified = 'SELECT * FROM "backup_admit_verified_capture_verification"(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL)';
    await denied(() => pools!.coordinator.query(verified)); await denied(() => pools!.finalizer.query(verified)); await denied(() => pools!.restore.query(verified));
  });

  it("admits only the artifact-role v2 proof shape, binds it exactly, and preserves verified idempotency", async () => {
    const row = await fixture();
    const first = await admitVerified(pools!.admission, row, "verified-same");
    const retry = await admitVerified(pools!.admission, row, "verified-same");
    expect(retry.rows[0]).toEqual({ attemptId: first.rows[0].attemptId, idempotent: true });
    await denied(() => admitVerified(pools!.admission, row, "bad-proof", { proofVersion: 1 }));
    await denied(() => admitVerified(pools!.admission, row, "bad-lifecycle", { captureJobId: "other" }));
    await denied(() => admitVerified(pools!.admission, row, "bad-inventory", { artifactHashes: {} }));
    await denied(() => admit(pools!.artifact, "capture", row, "verified", "bare-verified"));
    await expectPgFailure("conflicting verified retry must preserve immutable evidence", () => admitVerified(pools!.admission, row, "verified-same", { verifiedAt: "2026-11-20T00:00:01.000Z" }), "23505");
    await expect(pools!.owner.query('SELECT "resultPayload"->>\'verifiedAt\' AS "verifiedAt" FROM "BackupCaptureVerificationAttempt" WHERE id=$1', [first.rows[0].attemptId])).resolves.toMatchObject({ rows: [{ verifiedAt }] });
  });

  it("serializes verified admission with certificate revocation locks", async () => {
    const row = await fixture(); const owner = await pools!.owner.connect();
    try {
      await owner.query("BEGIN"); await owner.query("SET LOCAL lock_timeout='500ms'");
      await owner.query('SELECT id FROM "BackupVerifierCertificate" WHERE fingerprint=$1 FOR UPDATE', [row.artifactFingerprint]);
      await denied(() => admitVerified(pools!.admission, row, "verified-revocation-lock"), ["55P03"]);
      await owner.query("ROLLBACK");
    } finally { await owner.query("ROLLBACK").catch(() => undefined); owner.release(); }
    await expect(admitVerified(pools!.admission, row, "verified-revocation-lock")).resolves.toMatchObject({ rows: [expect.objectContaining({ idempotent: false })] });
  });

  it("persists failed/incomplete evidence, rejects verified and mismatched fingerprint/purpose/lifecycle input", async () => {
    const row = await fixture();
    await expect(admit(pools!.artifact, "capture", row, "failed", "failed")).resolves.toMatchObject({ rows: [expect.objectContaining({ idempotent: false })] });
    await expect(admit(pools!.artifact, "capture", row, "incomplete", "incomplete")).resolves.toMatchObject({ rows: [expect.objectContaining({ idempotent: false })] });
    await denied(() => admit(pools!.artifact, "capture", row, "verified", "verified"));
    await denied(() => admit(pools!.artifact, "capture", row, "failed", "other-fingerprint", digest("other")));
    await denied(() => admit(pools!.artifact, "capture", row, "failed", "bad-manifest", row.artifactFingerprint, { manifest: digest("wrong") }));
  });

  it("rejects inactive, revoked, and expired certificate eligibility", async () => {
    const inactive = await fixture();
    await pools!.owner.query('UPDATE "BackupVerifierPrincipal" SET active=false WHERE id=$1', ["verifier-test-artifact"]);
    await denied(() => admit(pools!.artifact, "capture", inactive, "failed", "inactive"));
    await pools!.owner.query('UPDATE "BackupVerifierPrincipal" SET active=true WHERE id=$1', ["verifier-test-artifact"]);
    const revoked = await fixture();
    const revokedFingerprint = digest("revoked-" + revoked.id);
    await pools!.owner.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose) VALUES ($1,$2,$3,$4)', ["revoked-" + revoked.id, "verifier-test-artifact", revokedFingerprint, "artifact_verifier"]);
    await pools!.owner.query('UPDATE "BackupVerifierCertificate" SET status=$1,"revokedAt"=NOW() WHERE fingerprint=$2', ["revoked", revokedFingerprint]);
    await denied(() => admit(pools!.artifact, "capture", revoked, "failed", "revoked", revokedFingerprint));
    const expired = await fixture();
    const expiredFingerprint = digest("expired" + expired.id);
    await pools!.owner.query('INSERT INTO "BackupVerifierCertificate" (id,"principalId",fingerprint,purpose,"notAfter") VALUES ($1,$2,$3,$4,NOW()-INTERVAL \'1 second\')', ["expired-" + expired.id, "verifier-test-artifact", expiredFingerprint, "artifact_verifier"]);
    await denied(() => admit(pools!.artifact, "capture", expired, "failed", "expired", expiredFingerprint));
  });

  it("returns identical idempotency retries and rejects conflicting retries", async () => {
    const row = await fixture(); const first = await admit(pools!.artifact, "capture", row, "failed", "same");
    const retry = await admit(pools!.artifact, "capture", row, "failed", "same");
    expect(retry.rows[0]).toEqual({ attemptId: first.rows[0].attemptId, idempotent: true });
    await denied(() => admit(pools!.artifact, "capture", row, "incomplete", "same"));
  });

  it("uses bounded independent-session admission/revocation and duplicate-submission races", async () => {
    const row = await fixture(); const one = new Pool({ connectionString: urls.artifact, max: 1 }); const two = new Pool({ connectionString: urls.artifact, max: 1 });
    try {
      const [left, right] = await Promise.all([admit(one, "capture", row, "failed", "concurrent"), admit(two, "capture", row, "failed", "concurrent")]);
      expect([left.rows[0].idempotent, right.rows[0].idempotent].sort()).toEqual([false, true]);
      const owner = await pools!.owner.connect(); try {
        await owner.query("BEGIN"); await owner.query("SET LOCAL lock_timeout='500ms'"); await owner.query('SELECT id FROM "BackupVerifierCertificate" WHERE fingerprint=$1 FOR UPDATE', [row.artifactFingerprint]);
        await denied(() => admit(one, "capture", row, "failed", "revocation-lock"), ["55P03"]);
        await owner.query("ROLLBACK");
      } finally { owner.release(); }
    } finally { await Promise.all([one.end(), two.end()]); }
  });

  it("rolls back uncommitted admission consistently", async () => {
    const row = await fixture(); const client = await pools!.artifact.connect();
    try {
      await client.query("BEGIN"); await client.query("SET LOCAL statement_timeout='1000ms'");
      await admit({ query: client.query.bind(client) } as unknown as Pool, "capture", row, "failed", "rollback");
      await client.query("ROLLBACK");
    } finally { client.release(); }
    await expect(pools!.owner.query('SELECT count(*)::int AS count FROM "BackupCaptureVerificationAttempt" WHERE "canonicalSetId"=$1', [row.canonicalId])).resolves.toMatchObject({ rows: [{ count: 0 }] });
  });

  it("rejects evidence before an uncommitted or rolled-back canonical publication and admits only after commit", async () => {
    const row = await fixture(false); const owner = await pools!.owner.connect();
    const unpublished = { ...row, canonicalId: "unpublished-" + row.id };
    try {
      await owner.query("BEGIN"); await owner.query("SET LOCAL lock_timeout='500ms'");
      await owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', [unpublished.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, "daily", digest("manifest" + row.id), "backup-canonical/unpublished-" + row.id]);
      await denied(() => admit(pools!.artifact, "capture", unpublished, "failed", "before-publication"), ["23514"]);
      await owner.query("ROLLBACK");
    } finally { owner.release(); }
    await denied(() => admit(pools!.artifact, "capture", unpublished, "failed", "after-rollback"), ["23514"]);
    await pools!.owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', [unpublished.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, "daily", digest("manifest" + row.id), "backup-canonical/committed-" + row.id]);
    await expect(admit(pools!.artifact, "capture", unpublished, "failed", "after-commit")).resolves.toMatchObject({ rows: [expect.objectContaining({ idempotent: false })] });
  });

  it("rejects duplicate canonical and evidence identity rows with exact uniqueness SQLSTATE", async () => {
    const row = await fixture(); const owner = pools!.owner;
    await denied(() => owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', ["duplicate-" + row.id, row.jobId, row.requestId, row.attemptId, row.leaseId, "daily", digest("manifest" + row.id), "backup-canonical/duplicate-" + row.id]), ["23505"]);
    await admit(pools!.artifact, "capture", row, "failed", "unique-evidence");
    await denied(() => owner.query('INSERT INTO "BackupCaptureVerificationAttempt" (id,"canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","verifierPrincipalId","verifierCertificateId","certificatePurpose","verificationMethod",result,"resultPayload","evidenceSha256","idempotencyKey") VALUES ($1,$2,$3,$4,$5,$6,7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)', [randomUUID(), row.canonicalId,row.jobId,row.requestId,row.attemptId,row.leaseId,"daily",digest("manifest"+row.id),"verifier-test-artifact","verifier-test-artifact-cert","artifact_verifier","x","failed",JSON.stringify({}),digest("duplicate"),"unique-evidence"]), ["23505"]);
  });

  it("accepts valid logical storage keys and rejects malformed keys with CHECK SQLSTATE", async () => {
    const valid = await fixture(false);
    await expect(insertCanonical(valid, "backup-canonical/valid.segment-1/manifest")).resolves.toMatchObject({ rowCount: 1 });
    for (const key of ["", "backup-canonical/" + "a".repeat(513), "backup-canonical/../manifest", "/backup-canonical/manifest", "backup-canonical/a\\b", "backup-canonical/a@b", "backup-canonical/a//b", "backup-canonical/a/"]) {
      const row = await fixture(false);
      await denied(() => insertCanonical(row, key), ["23514"]);
    }
  });

  it("rejects direct negative constraint inserts with their exact SQLSTATE", async () => {
    const owner = pools!.owner;
    const invalidKey = await fixture(false);
    await denied(() => owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', [invalidKey.canonicalId, invalidKey.jobId, invalidKey.requestId, invalidKey.attemptId, invalidKey.leaseId, "daily", digest("manifest" + invalidKey.id), "/not-a-logical-key"]), ["23514"]);
    const invalidManifest = await fixture(false);
    await denied(() => owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', [invalidManifest.canonicalId, invalidManifest.jobId, invalidManifest.requestId, invalidManifest.attemptId, invalidManifest.leaseId, "daily", "not-a-sha256", "backup-canonical/invalid-manifest-" + invalidManifest.id]), ["23514"]);
    const lifecycle = await fixture(false);
    const otherRequestId = "other-request-" + lifecycle.id;
    await owner.query('INSERT INTO "BackupCaptureRequest" (id,"scheduleKey","scheduledFor","backupClass",status,"updatedAt") VALUES ($1,$2,NOW(),$3,$4,NOW())', [otherRequestId, "other-schedule-" + lifecycle.id, "daily", "ready"]);
    await denied(() => owner.query('INSERT INTO "BackupCanonicalSet" (id,"captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","manifestFormatVersion","canonicalStorageKey") VALUES ($1,$2,$3,$4,$5,7,$6,$7,1,$8)', [lifecycle.canonicalId, lifecycle.jobId, otherRequestId, lifecycle.attemptId, lifecycle.leaseId, "daily", digest("manifest" + lifecycle.id), "backup-canonical/lifecycle-" + lifecycle.id]), ["23503"]);
    const row = await fixture();
    const values = [randomUUID(), row.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, "daily", digest("manifest" + row.id), "verifier-test-artifact", "verifier-test-artifact-cert", "artifact_verifier", "x", "failed", JSON.stringify({}), digest("direct-evidence"), "direct-negative"];
    await denied(() => owner.query('INSERT INTO "BackupCaptureVerificationAttempt" (id,"canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","verifierPrincipalId","verifierCertificateId","certificatePurpose","verificationMethod",result,"resultPayload","evidenceSha256","idempotencyKey") VALUES ($1,$2,$3,$4,$5,$6,7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)', [...values.slice(0, 14), "bad-digest", values[15]]), ["23514"]);
    await denied(() => owner.query('INSERT INTO "BackupCaptureVerificationAttempt" (id,"canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","verifierPrincipalId","verifierCertificateId","certificatePurpose","verificationMethod",result,"resultPayload","evidenceSha256","idempotencyKey") VALUES ($1,$2,$3,$4,$5,$6,7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)', [randomUUID(), row.canonicalId, "wrong-job-" + row.id, ...values.slice(3)]), ["23503"]);
    await denied(() => owner.query('INSERT INTO "BackupCaptureVerificationAttempt" (id,"canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","verifierPrincipalId","verifierCertificateId","certificatePurpose","verificationMethod",result,"resultPayload","evidenceSha256","idempotencyKey") VALUES ($1,$2,$3,$4,$5,$6,7,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)', [randomUUID(), row.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, "daily", digest("manifest" + row.id), "verifier-test-restore", "verifier-test-restore-cert", "artifact_verifier", "x", "failed", JSON.stringify({}), digest("wrong-purpose"), "wrong-purpose"]), ["23503"]);
    await denied(() => owner.query('INSERT INTO "BackupCaptureVerificationAttempt" (id,"canonicalSetId","captureJobId","captureRequestId","captureAttemptId","leaseId",generation,"backupClass","manifestSha256","verifierPrincipalId","verifierCertificateId","certificatePurpose","verificationMethod",result,"resultPayload","evidenceSha256","idempotencyKey") VALUES (NULL,$1,$2,$3,$4,$5,7,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)', [row.canonicalId, row.jobId, row.requestId, row.attemptId, row.leaseId, "daily", digest("manifest" + row.id), "verifier-test-artifact", "verifier-test-artifact-cert", "artifact_verifier", "x", "failed", JSON.stringify({}), digest("null-id"), "null-id"]), ["23502"]);
  });

  it("detects a controlled lock cycle, fully rolls back, then retries admission once in approved order", async () => {
    const row = await fixture(); const ownerA = await pools!.owner.connect(); const ownerB = await pools!.owner.connect();
    try {
      for (const client of [ownerA, ownerB]) { await client.query("BEGIN"); await client.query("SET LOCAL statement_timeout='3000ms'"); await client.query("SET LOCAL deadlock_timeout='100ms'"); }
      await ownerA.query('SELECT id FROM "BackupVerifierCertificate" WHERE fingerprint=$1 FOR UPDATE', [row.artifactFingerprint]);
      await ownerB.query('SELECT id FROM "BackupCanonicalSet" WHERE id=$1 FOR UPDATE', [row.canonicalId]);
      const cycle = await Promise.allSettled([
        ownerA.query('SELECT id FROM "BackupCanonicalSet" WHERE id=$1 FOR UPDATE', [row.canonicalId]),
        ownerB.query('SELECT id FROM "BackupVerifierCertificate" WHERE fingerprint=$1 FOR UPDATE', [row.artifactFingerprint]),
      ]);
      expect(cycle.some(result => result.status === "rejected" && (result.reason as { code?: string }).code === "40P01")).toBe(true);
    } finally {
      await Promise.all([ownerA.query("ROLLBACK").catch(() => undefined), ownerB.query("ROLLBACK").catch(() => undefined)]);
      ownerA.release(); ownerB.release();
    }
    const retried = await admit(pools!.artifact, "capture", row, "failed", "deadlock-retry");
    expect(retried.rows[0].idempotent).toBe(false);
    await expect(pools!.owner.query('SELECT count(*)::int AS count FROM "BackupCaptureVerificationAttempt" WHERE "canonicalSetId"=$1 AND "idempotencyKey"=$2', [row.canonicalId, "deadlock-retry"])).resolves.toMatchObject({ rows: [{ count: 1 }] });
  });

  it("uses the admission canonical-to-certificate lock suffix in restricted finalization", async () => {
    const result = await pools!.owner.query("SELECT pg_get_functiondef('public.\"backup_finalize_verified_capture\"(text,text,text,text)'::regprocedure) AS definition");
    const definition = result.rows[0].definition as string;
    const canonical = definition.indexOf('"BackupCanonicalSet" WHERE id=p_canonical_set_id FOR UPDATE');
    const evidence = definition.indexOf('"BackupCaptureVerificationAttempt" WHERE id=p_verification_attempt_id FOR UPDATE');
    const principal = definition.indexOf('"BackupVerifierPrincipal" WHERE id=evidence."verifierPrincipalId" AND active=true FOR SHARE');
    const certificate = definition.indexOf('"BackupVerifierCertificate" WHERE id=evidence."verifierCertificateId"');
    expect(canonical).toBeGreaterThan(-1); expect(evidence).toBeGreaterThan(canonical);
    expect(principal).toBeGreaterThan(evidence); expect(certificate).toBeGreaterThan(principal);
  });
});
