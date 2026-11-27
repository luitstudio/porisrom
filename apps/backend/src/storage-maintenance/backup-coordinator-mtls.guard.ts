import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { timingSafeEqual } from "node:crypto";

import { PrismaService } from "../prisma/prisma.service";
import { normalizeFingerprint } from "./backup-coordinator.service";

@Injectable()
export class BackupCoordinatorMtlsGuard implements CanActivate {
  constructor(private readonly config: ConfigService, private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request: any = context.switchToHttp().getRequest();
    const token = this.config.get<string>("BACKUP_COORDINATOR_MTLS_PROXY_TOKEN");
    const peers = (this.config.get<string>("BACKUP_COORDINATOR_TRUSTED_PROXY_IPS") ?? "").split(",").map(value => value.trim()).filter(Boolean);
    if (!token || peers.length === 0) throw new ForbiddenException("Backup coordinator mTLS boundary is not configured");
    const remote = normalizeAddress(request.socket?.remoteAddress);
    if (!remote || !peers.map(normalizeAddress).includes(remote)) throw new ForbiddenException("Backup coordinator request did not arrive from a trusted proxy");
    const injected = String(request.headers["x-porisrom-mtls-proxy-token"] ?? "");
    if (!constantEquals(token, injected) || request.headers["x-porisrom-mtls-verified"] !== "SUCCESS") throw new ForbiddenException("Backup coordinator mTLS assertion is invalid");
    const fingerprint = normalizeFingerprint(String(request.headers["x-porisrom-mtls-fingerprint"] ?? ""));
    const certificate = await this.prisma.db.backupCoordinatorCertificate.findUnique({ where: { fingerprint }, include: { principal: true } });
    const now = new Date();
    if (!certificate || certificate.status !== "active" || !certificate.principal.active || (certificate.notBefore && certificate.notBefore > now) || (certificate.notAfter && certificate.notAfter <= now)) {
      throw new ForbiddenException("Backup coordinator certificate is not authorized");
    }
    request.coordinatorPrincipal = { id: certificate.principalId, fingerprint };
    return true;
  }
}

function normalizeAddress(address?: string) { return address?.replace(/^::ffff:/, ""); }
function constantEquals(expected: string, actual: string) {
  const left = Buffer.from(expected); const right = Buffer.from(actual);
  return left.length === right.length && timingSafeEqual(left, right);
}
