import { createHash, generateKeyPairSync } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { ArtifactVerificationError, BackupArtifactVerifierEngine, verifyProofSignature } from "../src/storage-maintenance/backup-artifact-verifier.engine";

const roots: string[] = [];
const digest = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const binding = (manifestSha256: string) => ({ canonicalSetId: "canonical-1", captureJobId: "job-1", captureRequestId: "request-1", captureAttemptId: "11111111-1111-4111-8111-111111111111", leaseId: "22222222-2222-4222-8222-222222222222", generation: 1, backupClass: "daily" as const, manifestFormatVersion: 1, manifestSha256, canonicalStorageKey: "backup-canonical/canonical-1/manifest" });
const keys = generateKeyPairSync("ed25519");
const privateKey = keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();

async function fixture(options: { extra?: boolean; metadata?: string; manifest?: string; symlinkArtifact?: boolean } = {}) {
  const root = await mkdtemp(join(tmpdir(), "porisrom-verifier-")); roots.push(root);
  const inbox = join(root, "inbox"); const staging = join(root, "staging"); const canonical = join(root, "canonical"); const candidate = join(inbox, "set-1");
  await mkdir(candidate, { recursive: true }); await mkdir(staging); await mkdir(canonical);
  const files: Record<string, string> = { "database.dump.age": "db", "production_public_assets.tar.age": "public", "production_private_documents.tar.age": "private" };
  for (const [name, value] of Object.entries(files)) await writeFile(join(candidate, name), value);
  if (options.symlinkArtifact) { await rm(join(candidate, "database.dump.age")); await symlink(join(candidate, "production_public_assets.tar.age"), join(candidate, "database.dump.age")); }
  const manifest = options.manifest ?? Object.entries(files).map(([name, value]) => `${digest(value)}  ${name}`).join("\n") + "\n";
  await writeFile(join(candidate, "manifest.sha256"), manifest);
  await writeFile(join(candidate, "metadata"), options.metadata ?? "set_id=set-1\nclass=daily\ncapture_job_id=job-1\ncapture_request_id=request-1\nlease_id=22222222-2222-4222-8222-222222222222\ngeneration=1\nattempt_id=11111111-1111-4111-8111-111111111111\nstate=created\n");
  await writeFile(join(candidate, "INTEGRITY_VERIFIED"), "legacy marker only\n"); if (options.extra) await writeFile(join(candidate, "unexpected"), "x");
  const engine = new BackupArtifactVerifierEngine({ candidateInboxRoot: inbox, verifierStagingRoot: staging, verifierCanonicalRoot: canonical, verifierPrincipalId: "artifact-principal", verifierCertificateFingerprint: "a".repeat(64), proofPrivateKeyPem: privateKey, maxFileBytes: 1024 * 1024, maxTotalBytes: 3 * 1024 * 1024, maxConcurrent: 1 });
  return { root, candidate, canonical, engine, binding: binding(digest(manifest)) };
}

afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))); });

describe("BackupArtifactVerifierEngine", () => {
  it("copies, hashes, atomically publishes, and signs a valid candidate without trusting its marker", async () => {
    const test = await fixture(); const proof = await test.engine.verify(test.binding, "set-1");
    expect(proof.result).toBe("verified"); expect(proof.idempotencyKey).toBe("artifact:canonical-1:" + test.binding.manifestSha256);
    expect(verifyProofSignature(proof, publicKey)).toBe(true);
    await expect(readFile(join(test.canonical, "canonical-1", "RESTORE_VERIFIED"))).rejects.toThrow();
  });

  it("rejects extra files, malformed/duplicate manifests, metadata mismatch, and hash mismatch", async () => {
    for (const options of [
      { extra: true },
      { manifest: "not-a-digest  database.dump.age\n" },
      { manifest: `${"a".repeat(64)}  database.dump.age\n${"a".repeat(64)}  database.dump.age\n${"a".repeat(64)}  production_public_assets.tar.age\n` },
      { metadata: "set_id=set-1\nclass=weekly\ncapture_job_id=job-1\ncapture_request_id=request-1\nlease_id=22222222-2222-4222-8222-222222222222\ngeneration=1\nattempt_id=11111111-1111-4111-8111-111111111111\nstate=created\n" },
      { manifest: `${"0".repeat(64)}  database.dump.age\n${digest("public")}  production_public_assets.tar.age\n${digest("private")}  production_private_documents.tar.age\n` },
    ]) { const test = await fixture(options); await expect(test.engine.verify(test.binding, "set-1")).rejects.toBeInstanceOf(ArtifactVerificationError); }
  });

  it("rejects unsafe candidate identifiers and symlink substitution", async () => {
    const test = await fixture({ symlinkArtifact: true });
    await expect(test.engine.verify(test.binding, "../set-1")).rejects.toMatchObject({ code: "path" });
    await expect(test.engine.verify(test.binding, "set-1")).rejects.toMatchObject({ code: "inventory" });
  });

  it("never overwrites an existing canonical identity and detects proof tampering", async () => {
    const test = await fixture(); const proof = await test.engine.verify(test.binding, "set-1");
    await expect(test.engine.verify(test.binding, "set-1")).rejects.toMatchObject({ code: "conflict" });
    expect(verifyProofSignature({ ...proof, result: "verified", evidenceSha256: "b".repeat(64) }, publicKey)).toBe(false);
  });
});
