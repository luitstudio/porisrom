import { describe, expect, it } from "vitest";

import { BackupVerifierMtlsAuthenticator } from "../src/storage-maintenance/backup-verifier-mtls.guard";

const fingerprint = "a".repeat(64);
function context(headers: Record<string, string>, remote = "10.0.0.2") {
  const request: any = { headers, socket: { remoteAddress: remote } };
  return { switchToHttp: () => ({ getRequest: () => request }), request } as any;
}
function authenticator(certificate: any) {
  return new BackupVerifierMtlsAuthenticator(
    { get: (key: string) => key === "BACKUP_VERIFIER_MTLS_PROXY_TOKEN" ? "proxy-secret" : "10.0.0.2" } as never,
    { db: { backupVerifierCertificate: { findUnique: async () => certificate } } } as never,
  );
}
const headers = { "x-porisrom-mtls-proxy-token": "proxy-secret", "x-porisrom-mtls-verified": "SUCCESS", "x-porisrom-mtls-fingerprint": fingerprint };
const artifactCertificate = { fingerprint, purpose: "artifact_verifier", status: "active", notBefore: null, notAfter: null, principalId: "verifier-a", principal: { active: true } };

describe("backup verifier proxy mTLS authentication", () => {
  it("accepts only a trusted proxy and purpose-matching verifier certificate", async () => {
    const ctx = context(headers);
    await expect(authenticator(artifactCertificate).authenticate(ctx, "artifact_verifier")).resolves.toBe(true);
    expect(ctx.request.backupVerifierIdentity).toEqual({ principalId: "verifier-a", certificateFingerprint: fingerprint, purpose: "artifact_verifier" });
    await expect(authenticator(artifactCertificate).authenticate(context(headers), "restore_verifier")).rejects.toMatchObject({ status: 403 });
  });

  it("rejects forged proxy headers, coordinator/nonexistent identities, revoked, inactive, and expired verifiers", async () => {
    await expect(authenticator(artifactCertificate).authenticate(context({ ...headers, "x-porisrom-mtls-proxy-token": "forged" }), "artifact_verifier")).rejects.toMatchObject({ status: 403 });
    await expect(authenticator(null).authenticate(context(headers), "artifact_verifier")).rejects.toMatchObject({ status: 403 });
    await expect(authenticator({ ...artifactCertificate, status: "revoked" }).authenticate(context(headers), "artifact_verifier")).rejects.toMatchObject({ status: 403 });
    await expect(authenticator({ ...artifactCertificate, principal: { active: false } }).authenticate(context(headers), "artifact_verifier")).rejects.toMatchObject({ status: 403 });
    await expect(authenticator({ ...artifactCertificate, notAfter: new Date(0) }).authenticate(context(headers), "artifact_verifier")).rejects.toMatchObject({ status: 403 });
    await expect(authenticator(artifactCertificate).authenticate(context(headers, "10.0.0.9"), "artifact_verifier")).rejects.toMatchObject({ status: 403 });
  });
});
