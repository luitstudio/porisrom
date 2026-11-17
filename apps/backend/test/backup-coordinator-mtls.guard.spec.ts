import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { BackupCoordinatorMtlsGuard } from "../src/storage-maintenance/backup-coordinator-mtls.guard";

const fingerprint = "a".repeat(64);
function context(request: any) { return { switchToHttp: () => ({ getRequest: () => request }) } as any; }
function guard(overrides: any = {}) {
  const config = { get: (key: string) => ({ BACKUP_COORDINATOR_MTLS_PROXY_TOKEN: "proxy-secret", BACKUP_COORDINATOR_TRUSTED_PROXY_IPS: "127.0.0.1" } as any)[key] };
  const certificate = overrides.certificate === undefined ? { status: "active", principalId: "backup-vps", principal: { active: true } } : overrides.certificate;
  return new BackupCoordinatorMtlsGuard(config as any, { db: { backupCoordinatorCertificate: { findUnique: async () => certificate } } } as any);
}

describe("BackupCoordinatorMtlsGuard", () => {
  const request = () => ({ socket: { remoteAddress: "::ffff:127.0.0.1" }, headers: { "x-porisrom-mtls-proxy-token": "proxy-secret", "x-porisrom-mtls-verified": "SUCCESS", "x-porisrom-mtls-fingerprint": fingerprint } });
  it("accepts only a verified certificate assertion injected by the configured proxy", async () => {
    const req: any = request(); await expect(guard().canActivate(context(req))).resolves.toBe(true);
    expect(req.coordinatorPrincipal).toMatchObject({ id: "backup-vps", fingerprint });
  });
  it("rejects direct/spoofed proxy headers and revoked certificates", async () => {
    const direct = request(); direct.socket.remoteAddress = "10.0.0.2";
    await expect(guard().canActivate(context(direct))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard({ certificate: { status: "revoked", principalId: "backup-vps", principal: { active: true } } }).canActivate(context(request()))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
