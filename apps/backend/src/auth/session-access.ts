import { UnauthorizedException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "./auth.service";

export async function activeSessionUser(prisma: PrismaService, payload: JwtPayload) {
  if (!payload.sid || !payload.sub) throw new UnauthorizedException();
  const [user, session] = await Promise.all([
    prisma.db.user.findUnique({ where: { id: payload.sub }, select: { id: true, role: true, status: true } }),
    prisma.db.authSession.findUnique({ where: { id: payload.sid }, select: { userId: true, revokedAt: true, expiresAt: true } }),
  ]);
  if (!user || user.status !== "active" || !session || session.userId !== user.id || session.revokedAt || session.expiresAt <= new Date()) {
    throw new UnauthorizedException();
  }
  return { userId: user.id, role: user.role, sessionId: payload.sid, sessionExpiresAt: session.expiresAt };
}
