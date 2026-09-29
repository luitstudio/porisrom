import { HttpException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import bcrypt from "bcryptjs";
import { describe, expect, it, vi } from "vitest";

import { AuthService } from "../src/auth/auth.service";
import { AuthRateLimitGuard } from "../src/auth/guards/auth-rate-limit.guard";
import type { PrismaService } from "../src/prisma/prisma.service";

function context(path: string, body: object, ip = "127.0.0.1") {
  return {
    switchToHttp: () => ({ getRequest: () => ({ route: { path }, body, cookies: {}, ip }) }),
  } as never;
}

function authService(db: object) {
  const jwt = {
    sign: vi.fn().mockReturnValueOnce("access-token").mockReturnValueOnce("refresh-token"),
  };
  const config = { getOrThrow: vi.fn().mockReturnValue("secret"), get: vi.fn() };
  return new AuthService(
    { db } as unknown as PrismaService,
    jwt as unknown as JwtService,
    config as unknown as ConfigService,
  );
}

describe("auth rate limiting", () => {
  it.each([
    ["/signup", { email: "person@example.com" }, 5],
    ["/login", { email: "person@example.com" }, 10],
    ["/refresh", { refreshToken: "refresh-token" }, 30],
  ] as const)("limits %s after its configured allowance", (path, body, allowance) => {
    const guard = new AuthRateLimitGuard();
    for (let attempt = 0; attempt < allowance; attempt += 1) {
      expect(guard.canActivate(context(path, body))).toBe(true);
    }

    expect(() => guard.canActivate(context(path, body))).toThrow(HttpException);
    try {
      guard.canActivate(context(path, body));
    } catch (error) {
      expect((error as HttpException).getStatus()).toBe(429);
      expect((error as HttpException).message).not.toContain("person@example.com");
      expect((error as HttpException).message).not.toContain("refresh-token");
    }
  });

  it("keeps separate account limits independent", () => {
    const guard = new AuthRateLimitGuard();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      guard.canActivate(context("/login", { email: "first@example.com" }));
    }

    expect(guard.canActivate(context("/login", { email: "second@example.com" }))).toBe(true);
  });
});

describe("existing auth behavior", () => {
  it("still signs up a valid user", async () => {
    const created = {
      id: "user-1",
      name: "New User",
      email: "new@example.com",
      passwordHash: "hash",
      role: "client",
      status: "active",
      isOnboarded: false,
      profileCompleteness: 0,
    };
    const service = authService({
      user: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
    });

    await expect(
      service.signup({
        name: "New User",
        email: "new@example.com",
        password: "valid-pass",
        role: "client",
      }),
    ).resolves.toMatchObject({
      user: { id: "user-1", email: "new@example.com", role: "client" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });

  it("still logs in a valid active user", async () => {
    const passwordHash = await bcrypt.hash("valid-pass", 4);
    const service = authService({
      user: {
        findUnique: vi.fn().mockResolvedValue({
          id: "user-1",
          name: "Existing User",
          email: "existing@example.com",
          passwordHash,
          role: "freelancer",
          status: "active",
          isOnboarded: true,
          profileCompleteness: 100,
        }),
      },
    });

    await expect(
      service.login({ email: "existing@example.com", password: "valid-pass" }),
    ).resolves.toMatchObject({
      user: { id: "user-1", email: "existing@example.com", role: "freelancer" },
      accessToken: "access-token",
      refreshToken: "refresh-token",
    });
  });
});
