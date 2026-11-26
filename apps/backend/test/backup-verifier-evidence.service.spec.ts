import { describe, expect, it } from "vitest";

import { BackupVerifierEvidenceService } from "../src/storage-maintenance/backup-verifier-evidence.service";

const identity = { principalId: "verifier-a", certificateFingerprint: "a".repeat(64), purpose: "artifact_verifier" as const };
const evidence = {
  canonicalSetId: "canonical-1", captureJobId: "job-1", captureRequestId: "request-1",
  captureAttemptId: "123e4567-e89b-42d3-a456-426614174000", leaseId: "123e4567-e89b-42d3-a456-426614174001",
  generation: 7, backupClass: "daily" as const, manifestSha256: "b".repeat(64),
  verificationMethod: "future-engine-v1", result: "failed" as const, resultPayload: { reason: "digest mismatch" },
  evidenceSha256: "c".repeat(64), idempotencyKey: "attempt-1",
};

function service() { return new BackupVerifierEvidenceService(); }

describe("independent verifier evidence admission", () => {
  it("does not hold verifier database credentials or admit evidence in the backend process", async () => {
    await expect(service().admitArtifact(identity, evidence)).rejects.toMatchObject({ status: 503 });
  });

  it("fails closed for both purpose routes", async () => {
    await expect(service().admitRestore({ ...identity, purpose: "restore_verifier" }, evidence)).rejects.toMatchObject({ status: 503 });
  });

  it("fails closed for verified evidence without using body-supplied identity", async () => {
    await expect(service().admitArtifact(identity, { ...evidence, result: "verified" as never })).rejects.toMatchObject({ status: 503 });
  });
});
