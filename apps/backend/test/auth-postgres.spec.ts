import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient } from "@porisrom/database";
import bcrypt from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthService } from "../src/auth/auth.service";

// Explicit opt-in only: never reuse DATABASE_URL or migrate/reset an existing DB.
const testUrl = process.env.PORISROM_AUTH_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("isolated PostgreSQL session concurrency (requires PORISROM_AUTH_TEST_DATABASE_URL)", () => {
  let db: PrismaClient;
  let service: AuthService;
  const userId = `auth-test-${randomUUID()}`;
  const email = `${userId}@example.test`;
  beforeAll(async () => {
    const parsed = new URL(testUrl!);
    if (!decodeURIComponent(parsed.pathname).endsWith("_test")) throw new Error("Auth tests require an explicitly supplied database name ending in _test");
    const { PrismaPg } = createRequire(resolve(process.cwd(), "../../packages/database/package.json"))("@prisma/adapter-pg");
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    await db.$connect();
    await db.user.create({ data: { id: userId, name: "Synthetic auth test", email, role: "client", passwordHash: await bcrypt.hash("synthetic-test-password", 4) } });
    service = new AuthService({ db } as never, new JwtService(), new ConfigService({ JWT_ACCESS_SECRET: "synthetic-pg-access-secret", JWT_REFRESH_SECRET: "synthetic-pg-refresh-secret" }));
  });
  afterAll(async () => {
    if (!db) return;
    try { await db.authSession.deleteMany({ where: { userId } }); await db.user.deleteMany({ where: { id: userId, email } }); }
    finally { await db.$disconnect(); }
  });
  it("allows exactly one of ten concurrent rotations with one shared old token", async () => {
    const initial = await service.login({ email, password: "synthetic-test-password" });
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => service.refresh(initial.refreshToken)));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(9);
  });
  it("does not resurrect a session when refresh races logout", async () => {
    const initial = await service.login({ email, password: "synthetic-test-password" });
    const payload = new JwtService().decode(initial.accessToken);
    await Promise.allSettled([service.refresh(initial.refreshToken), service.logoutUsingTokens(initial.accessToken)]);
    expect((await db.authSession.findUniqueOrThrow({ where: { id: payload.sid } })).revokedAt).not.toBeNull();
    await expect(service.refresh(initial.refreshToken)).rejects.toMatchObject({ status: 401 });
  });
});
