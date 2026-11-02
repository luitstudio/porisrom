import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { vi } from "vitest";
import { AuthService } from "../../src/auth/auth.service";
import { RealtimeGateway } from "../../src/realtime/realtime.gateway";
import type { PrismaService } from "../../src/prisma/prisma.service";

export async function sessionHarness() {
  const config = new ConfigService({ JWT_ACCESS_SECRET: "synthetic-access-http-test-secret", JWT_REFRESH_SECRET: "synthetic-refresh-http-test-secret" });
  const jwt = new JwtService();
  const user = { id: "synthetic-user", name: "Synthetic User", email: "synthetic@example.test", passwordHash: await bcrypt.hash("synthetic-test-password", 4), role: "client", status: "active", isOnboarded: true, profileCompleteness: 100 };
  type Session = { id: string; userId: string; tokenHash: string; expiresAt: Date; revokedAt: Date | null; reuseDetectedAt: Date | null; updatedAt: Date };
  const sessions = new Map<string, Session>();
  const db = {
    user: { findUnique: vi.fn(async () => user) },
    authSession: {
      create: vi.fn(async ({ data }: { data: Session }) => { const session = { ...data, revokedAt: null, reuseDetectedAt: null, updatedAt: new Date() }; sessions.set(data.id, session); return session; }),
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => { const s = sessions.get(where.id); return s ? { ...s, user } : null; }),
      updateMany: vi.fn(async ({ where, data }: { where: { id: string; userId?: string; tokenHash?: string; revokedAt: null; expiresAt?: { gt: Date } }; data: Partial<Session> }) => {
        const s = sessions.get(where.id);
        if (!s || s.revokedAt !== null || (where.userId && s.userId !== where.userId) || (where.tokenHash && s.tokenHash !== where.tokenHash) || (where.expiresAt && s.expiresAt <= where.expiresAt.gt)) return { count: 0 };
        Object.assign(s, data); return { count: 1 };
      }),
    },
  };
  const prisma = { db } as unknown as PrismaService;
  const realtime = new RealtimeGateway(jwt, config, prisma);
  const service = new AuthService(prisma, jwt, config, realtime);
  return { db, prisma, jwt, config, user, sessions, realtime, service };
}
