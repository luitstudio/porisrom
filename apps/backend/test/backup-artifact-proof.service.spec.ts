import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";

import { BackupArtifactProofService } from "../src/storage-maintenance/backup-artifact-proof.service";

const keys = generateKeyPairSync("ed25519");
const privateKey = keys.privateKey;
const publicKey = keys.publicKey.export({ type: "spki", format: "pem" }).toString();
const identity = { principalId: "verifier-a", certificateFingerprint: "a".repeat(64), purpose: "artifact_verifier" as const };

function canonicalJson(value: unknown): string { if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`; if (value && typeof value === "object") { const object = value as Record<string, unknown>; return `{${Object.keys(object).sort().map(name => `${JSON.stringify(name)}:${canonicalJson(object[name])}`).join(",")}}`; } return JSON.stringify(value); }
function digest(value: string) { return createHash("sha256").update(value).digest("hex"); }
function proof(overrides: Record<string, unknown> = {}) {
  const unsigned = {
    canonicalSetId: "canonical-1", captureJobId: "job-1", captureRequestId: "request-1", captureAttemptId: "123e4567-e89b-42d3-a456-426614174000", leaseId: "123e4567-e89b-42d3-a456-426614174001",
    generation: 7, backupClass: "daily", manifestFormatVersion: 1, manifestSha256: "b".repeat(64), canonicalStorageKey: "daily/request-1/manifest", proofVersion: 2,
    verificationMethod: "independent-artifact-ed25519-v2", result: "verified", verifiedAt: new Date().toISOString(), artifactHashes: { "database.dump.age": "c".repeat(64), "production_public_assets.tar.age": "d".repeat(64), "production_private_documents.tar.age": "e".repeat(64) },
    idempotencyKey: "artifact:canonical-1:" + "b".repeat(64), verifierPrincipalId: identity.principalId, verifierCertificateFingerprint: identity.certificateFingerprint,
    ...overrides,
  };
  const evidenceSha256 = digest(canonicalJson(unsigned));
  const signature = sign(null, Buffer.from(canonicalJson({ ...unsigned, evidenceSha256 })), privateKey).toString("base64url");
  return { ...unsigned, evidenceSha256, signature };
}
function evidence(overrides: Record<string, unknown> = {}) {
  const signed = proof();
  return { canonicalSetId: "canonical-1", captureJobId: "job-1", captureRequestId: "request-1", captureAttemptId: "123e4567-e89b-42d3-a456-426614174000", leaseId: "123e4567-e89b-42d3-a456-426614174001", generation: 7, backupClass: "daily", manifestSha256: "b".repeat(64), canonicalStorageKey: "daily/request-1/manifest", verificationMethod: "independent-artifact-ed25519-v2", result: "verified", resultPayload: {}, evidenceSha256: signed.evidenceSha256, idempotencyKey: signed.idempotencyKey, proof: signed, ...overrides };
}
function validator(config: Record<string, string | undefined> = { BACKUP_ARTIFACT_VERIFIER_PROOF_PUBLIC_KEY_PEM: publicKey }) { return new BackupArtifactProofService({ get: (name: string) => config[name] } as never); }

describe("artifact verifier authenticated proof", () => {
  it("accepts an exact fresh signed proof bound to the authenticated verifier", () => {
    const exact = evidence();
    const check = validator();
    expect(() => check.validate(identity, exact as never)).not.toThrow();
    // The proof boundary is deterministic; the later database unique key is
    // responsible for returning the same immutable evidence row on retry.
    expect(() => check.validate(identity, exact as never)).not.toThrow();
  });

  it("rejects signature, manifest, lifecycle, principal, certificate, version, and replay-binding modifications", () => {
    const signed = proof();
    expect(() => validator().validate(identity, evidence({ proof: { ...signed, signature: "0".repeat(64) } }) as never)).toThrow();
    expect(() => validator().validate(identity, evidence({ manifestSha256: "f".repeat(64), proof: signed }) as never)).toThrow();
    expect(() => validator().validate(identity, evidence({ captureJobId: "other-job", proof: signed }) as never)).toThrow();
    expect(() => validator().validate({ ...identity, principalId: "other" }, evidence() as never)).toThrow();
    expect(() => validator().validate({ ...identity, certificateFingerprint: "f".repeat(64) }, evidence() as never)).toThrow();
    expect(() => validator().validate(identity, evidence({ proof: proof({ proofVersion: 1 }) }) as never)).toThrow();
    expect(() => validator().validate(identity, evidence({ idempotencyKey: "conflicting-replay", proof: signed }) as never)).toThrow();
  });

  it("fails closed for a stale proof, missing key, and non-artifact verifier identity", () => {
    expect(() => validator().validate(identity, evidence({ proof: proof({ verifiedAt: new Date(Date.now() - 301_000).toISOString() }) }) as never)).toThrow();
    expect(() => validator({}).validate(identity, evidence() as never)).toThrow();
    expect(() => validator().validate({ ...identity, purpose: "restore_verifier" }, evidence() as never)).toThrow();
  });
});
