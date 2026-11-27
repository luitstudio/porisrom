import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { normalizeFingerprint } from "./backup-coordinator.service";

export type BackupVerifierPurpose = "artifact_verifier" | "restore_verifier";
export type BackupVerifierIdentity = { principalId: string; certificateFingerprint: string; purpose: BackupVerifierPurpose };

@Injectable()
export class BackupVerifierMtlsAuthenticator {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async authenticate(context: ExecutionContext, purpose: BackupVerifierPurpose) {
    const request: any = context.switchToHttp().getRequest();
    const token = this.config.get<string>("BACKUP_VERIFIER_MTLS_PROXY_TOKEN");
    const peers = (this.config.get<string>("BACKUP_VERIFIER_TRUSTED_PROXY_IPS") ?? "").split(",").map(value => value.trim()).filter(Boolean);
    if (!token || peers.length === 0) throw new ForbiddenException("Backup verifier mTLS boundary is not configured");
    const remote = normalizeAddress(request.socket?.remoteAddress);
    if (!remote || !peers.map(normalizeAddress).includes(remote)) throw new ForbiddenException("Backup verifier request did not arrive from a trusted proxy");
    const injected = String(request.headers["x-porisrom-mtls-proxy-token"] ?? "");
    if (!constantEquals(token, injected) || request.headers["x-porisrom-mtls-verified"] !== "SUCCESS") throw new ForbiddenException("Backup verifier mTLS assertion is invalid");
    const fingerprint = normalizeFingerprint(String(request.headers["x-porisrom-mtls-fingerprint"] ?? ""));
    const certificate = await this.prisma.db.backupVerifierCertificate.findUnique({ where: { fingerprint }, include: { principal: true } });
    const now = new Date();
    if (!certificate || certificate.purpose !== purpose || certificate.status !== "active" || !certificate.principal.active ||
      (certificate.notBefore && certificate.notBefore > now) || (certificate.notAfter && certificate.notAfter <= now)) {
      throw new ForbiddenException("Backup verifier certificate is not authorized for this evidence purpose");
    }
    request.backupVerifierIdentity = { principalId: certificate.principalId, certificateFingerprint: fingerprint, purpose } satisfies BackupVerifierIdentity;
    return true;
  }
}

@Injectable()
export class ArtifactVerifierMtlsGuard implements CanActivate {
  constructor(private readonly authenticator: BackupVerifierMtlsAuthenticator) {}
  canActivate(context: ExecutionContext) { return this.authenticator.authenticate(context, "artifact_verifier"); }
}

@Injectable()
export class RestoreVerifierMtlsGuard implements CanActivate {
  constructor(private readonly authenticator: BackupVerifierMtlsAuthenticator) {}
  canActivate(context: ExecutionContext) { return this.authenticator.authenticate(context, "restore_verifier"); }
}

function normalizeAddress(address?: string) { return address?.replace(/^::ffff:/, ""); }
function constantEquals(expected: string, actual: string) {
  const left = Buffer.from(expected); const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}
