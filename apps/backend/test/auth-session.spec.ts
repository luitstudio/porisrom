import { createHash } from "node:crypto";

import { UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthService, type JwtPayload } from "../src/auth/auth.service";
import type { PrismaService } from "../src/prisma/prisma.service";

type UserRecord = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "client" | "freelancer" | "admin";
  status: "active" | "blocked" | "deleted";
  isOnboarded: boolean;
  profileCompleteness: number;
};

type SessionRecord = {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  reuseDetectedAt: Date | null;
  updatedAt: Date;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function authHarness() {
  const user: UserRecord = {
    id: "user-1",
    name: "Session User",
    email: "session@example.com",
    passwordHash: await bcrypt.hash("valid-pass", 4),
    role: "client",
    status: "active",
    isOnboarded: true,
    profileCompleteness: 100,
  };
  const sessions = new Map<string, SessionRecord>();
  const tokenPayloads = new Map<string, JwtPayload>();
  let tokenCounter = 0;

  const jwt = {
    decode: vi.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 604800 })),
    sign: vi.fn((payload: JwtPayload, options: { secret: string }) => {
      const prefix = options.secret === "refresh-secret" ? "refresh" : "access";
      const token = `${prefix}-${payload.sid}-${tokenCounter += 1}`;
      tokenPayloads.set(token, { ...payload });
      return token;
    }),
    verify: vi.fn((token: string) => {
      const payload = tokenPayloads.get(token);
      if (!payload) throw new Error("invalid token");
      return payload;
    }),
  };

  const db = {
    user: {
      findUnique: vi.fn().mockResolvedValue(user),
    },
    authSession: {
      create: vi.fn(({ data }: { data: SessionRecord }) => {
        sessions.set(data.id, { ...data, revokedAt: null, reuseDetectedAt: null, updatedAt: new Date() });
        return Promise.resolve(sessions.get(data.id));
      }),
      findUnique: vi.fn(({ where }: { where: { id: string } }) => {
        const session = sessions.get(where.id);
        return Promise.resolve(session ? { ...session, user } : null);
      }),
      update: vi.fn(({ where, data }: { where: { id: string }; data: Partial<SessionRecord> }) => {
        const existing = sessions.get(where.id);
        if (!existing) throw new Error("missing session");
        const updated = { ...existing, ...data };
        sessions.set(where.id, updated);
        return Promise.resolve({ ...updated, user });
      }),
      updateMany: vi.fn(({ where, data }: { where: { id: string; userId?: string; tokenHash?: string; revokedAt: null; expiresAt?: { gt: Date } }; data: Partial<SessionRecord> }) => {
        const existing = sessions.get(where.id);
        if (existing && existing.revokedAt === where.revokedAt && (!where.tokenHash || existing.tokenHash === where.tokenHash) &&
          (!where.userId || existing.userId === where.userId) && (!where.expiresAt || existing.expiresAt > where.expiresAt.gt)) {
          sessions.set(where.id, { ...existing, ...data });
          return Promise.resolve({ count: 1 });
        }
        return Promise.resolve({ count: 0 });
      }),
    },
  };
  const config = {
    getOrThrow: vi.fn((key: string) => key === "JWT_REFRESH_SECRET" ? "refresh-secret" : "access-secret"),
    get: vi.fn(),
  };
  const service = new AuthService(
    { db } as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );

  return { db, jwt, service, sessions, tokenPayloads, user };
}

describe("auth refresh sessions", () => {
  afterEach(() => vi.useRealTimers());
  it("allows only one of two simultaneous rotations without revoking the winner", async () => {
    const { service, sessions } = await authHarness();
    const login = await service.login({ email: "session@example.com", password: "valid-pass" });
    const results = await Promise.allSettled([service.refresh(login.refreshToken), service.refresh(login.refreshToken)]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
    expect([...sessions.values()][0].revokedAt).toBeNull();
  });

  it("creates a persistent refresh session on login", async () => {
    const { db, service, sessions } = await authHarness();

    const result = await service.login({ email: "session@example.com", password: "valid-pass" });

    expect(result.refreshToken).toMatch(/^refresh-/);
    expect(sessions).toHaveLength(1);
    const session = [...sessions.values()][0];
    expect(session.userId).toBe("user-1");
    expect(session.tokenHash).toBe(hashToken(result.refreshToken));
    expect(session.expiresAt).toBeInstanceOf(Date);
    expect(db.authSession.create).toHaveBeenCalledOnce();
  });

  it("rotates the refresh token and rejects replay of the previous token", async () => {
    const { service, sessions } = await authHarness();
    const login = await service.login({ email: "session@example.com", password: "valid-pass" });
    const initialSession = [...sessions.values()][0];

    const refreshed = await service.refresh(login.refreshToken);

    expect(refreshed.refreshToken).not.toBe(login.refreshToken);
    expect(sessions.get(initialSession.id)?.tokenHash).toBe(hashToken(refreshed.refreshToken));

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 6000);
    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(sessions.get(initialSession.id)?.revokedAt).toBeInstanceOf(Date);
    expect(sessions.get(initialSession.id)?.reuseDetectedAt).toBeInstanceOf(Date);
  });

  it("rejects a late overlapping tab without revoking the active session", async () => {
    const { service, sessions } = await authHarness();
    const login = await service.login({ email: "session@example.com", password: "valid-pass" });
    const rotated = await service.refresh(login.refreshToken);
    await expect(service.refresh(login.refreshToken)).rejects.toMatchObject({ status: 409 });
    expect([...sessions.values()][0].revokedAt).toBeNull();
    await expect(service.refresh(rotated.refreshToken)).resolves.toHaveProperty("accessToken");
  });

  it("does not rotate expired or revoked sessions", async () => {
    const { service, sessions } = await authHarness();
    const login = await service.login({ email: "session@example.com", password: "valid-pass" });
    [...sessions.values()][0].expiresAt = new Date(0);
    await expect(service.refresh(login.refreshToken)).rejects.toMatchObject({ status: 401 });
  });

  it("revokes using signed credentials and propagates database failure", async () => {
    const { service, sessions, db } = await authHarness();
    const login = await service.login({ email: "session@example.com", password: "valid-pass" });
    db.authSession.updateMany.mockRejectedValueOnce(new Error("synthetic database outage"));
    await expect(service.logoutUsingTokens(login.accessToken)).rejects.toThrow("synthetic database outage");
    expect([...sessions.values()][0].revokedAt).toBeNull();
    await service.logoutUsingTokens(undefined, login.refreshToken);
    expect([...sessions.values()][0].revokedAt).toBeInstanceOf(Date);
    await expect(service.logoutUsingTokens(login.accessToken)).resolves.toBeUndefined();
    await expect(service.logoutUsingTokens("invalid")).rejects.toMatchObject({ status: 401 });
  });

  it("rejects refresh after logout of the current session", async () => {
    const { service, tokenPayloads } = await authHarness();
    const login = await service.login({ email: "session@example.com", password: "valid-pass" });
    const payload = tokenPayloads.get(login.accessToken);

    await service.logout(payload?.sid);

    await expect(service.refresh(login.refreshToken)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("allows a new login after an old session was revoked", async () => {
    const { service, tokenPayloads } = await authHarness();
    const first = await service.login({ email: "session@example.com", password: "valid-pass" });
    await service.logout(tokenPayloads.get(first.accessToken)?.sid);

    const second = await service.login({ email: "session@example.com", password: "valid-pass" });

    await expect(service.refresh(second.refreshToken)).resolves.toMatchObject({
      user: { id: "user-1" },
      accessToken: expect.stringMatching(/^access-/),
      refreshToken: expect.stringMatching(/^refresh-/),
    });
  });
});
