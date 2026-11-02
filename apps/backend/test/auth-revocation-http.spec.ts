import "reflect-metadata";
import { type INestApplication, Module } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { Server } from "socket.io";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { AuthRateLimitGuard } from "../src/auth/guards/auth-rate-limit.guard";
import { JwtStrategy } from "../src/auth/strategies/jwt.strategy";
import { sessionHarness } from "./helpers/session-harness";

const { io } = createRequire(resolve(process.cwd(), "../frontend/package.json"))("socket.io-client");

describe("session revocation through real HTTP and Socket.IO", () => {
  let app: INestApplication;
  let base: string;
  let h: Awaited<ReturnType<typeof sessionHarness>>;
  beforeAll(async () => {
    h = await sessionHarness();
    Reflect.defineMetadata("design:paramtypes", [AuthService], AuthController);
    @Module({ controllers: [AuthController], providers: [AuthRateLimitGuard,
      { provide: AuthService, useValue: h.service },
      { provide: JwtStrategy, useFactory: () => new JwtStrategy(h.config, h.prisma) },
    ] }) class HttpAuthModule {}
    app = await NestFactory.create(HttpAuthModule, { logger: false });
    const sockets = new Server(app.getHttpServer());
    h.realtime.afterInit(sockets);
    sockets.on("connection", socket => h.realtime.handleConnection(socket));
    await app.listen(0, "127.0.0.1");
    base = await app.getUrl();
  });
  afterAll(async () => { if (app) await app.close(); });

  const login = () => h.service.login({ email: "synthetic@example.test", password: "synthetic-test-password" });
  const request = (path: string, token?: string, body?: object) => fetch(`${base}${path}`, { method: body ? "POST" : "GET", headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  function expiredAccess(accessToken: string) {
    const { sub, sid, role } = h.jwt.decode(accessToken);
    return h.jwt.sign({ sub, sid, role }, { secret: h.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: -1 });
  }
  async function connect(token: string) {
    const socket = io(base, { auth: { token }, transports: ["websocket"], reconnection: false, forceNew: true });
    await new Promise<void>((resolveConnect, reject) => { socket.once("connect", resolveConnect); socket.once("connect_error", reject); });
    return socket;
  }

  it("allows one concurrent HTTP refresh and keeps the winner usable", async () => {
    const initial = await login();
    const results = await Promise.all([request("/auth/refresh", undefined, { refreshToken: initial.refreshToken }), request("/auth/refresh", undefined, { refreshToken: initial.refreshToken })]);
    expect(results.map(result => result.status).sort()).toEqual([200, 409]);
    const winner = await results.find(result => result.status === 200)!.json();
    expect((await request("/auth/me", winner.accessToken)).status).toBe(200);
    expect((await request("/auth/me", initial.accessToken)).status).toBe(200);
  });

  it("revokes HTTP and connected sockets while preserving a different session", async () => {
    const current = await login(); const other = await login();
    const socket = await connect(current.accessToken);
    const disconnected = new Promise<void>(resolveDisconnect => socket.once("disconnect", resolveDisconnect));
    expect((await request("/auth/logout", current.accessToken, {})).status).toBe(200);
    await disconnected;
    expect(socket.connected).toBe(false);
    expect((await request("/auth/me", current.accessToken)).status).toBe(401);
    expect((await request("/auth/me", other.accessToken)).status).toBe(200);
    expect((await request("/auth/refresh", undefined, { refreshToken: current.refreshToken })).status).toBe(401);
    expect((await request("/auth/logout", current.accessToken, {})).status).toBe(200);
    await expect(connect(current.accessToken)).rejects.toThrow("Unauthorized");
    socket.disconnect();
  });

  it("allows a signed expired access token only for logout", async () => {
    const initial = await login(); const expired = expiredAccess(initial.accessToken);
    expect((await request("/auth/me", expired)).status).toBe(401);
    expect((await request("/auth/logout", expired, {})).status).toBe(200);
    expect((await request("/auth/me", initial.accessToken)).status).toBe(401);
  });

  it("rejects signed expired refresh tokens for rotation but allows their session to be revoked", async () => {
    const initial = await login(); const { sub, sid } = h.jwt.decode(initial.refreshToken);
    const expired = h.jwt.sign({ sub, sid }, { secret: h.config.getOrThrow("JWT_REFRESH_SECRET"), expiresIn: -1 });
    expect((await request("/auth/refresh", undefined, { refreshToken: expired })).status).toBe(401);
    expect((await request("/auth/logout", undefined, { refreshToken: expired })).status).toBe(200);
    expect((await request("/auth/me", initial.accessToken)).status).toBe(401);
  });

  it("supports refresh-token-only logout and rejects forged/absent credentials", async () => {
    const initial = await login();
    expect((await request("/auth/logout", undefined, { refreshToken: initial.refreshToken })).status).toBe(200);
    expect((await request("/auth/me", initial.accessToken)).status).toBe(401);
    expect((await request("/auth/logout", undefined, {})).status).toBe(401);
    expect((await request("/auth/logout", "forged", {})).status).toBe(401);
  });

  it("rejects missing, expired and mismatched sessions during access validation", async () => {
    const initial = await login(); const payload = h.jwt.decode(initial.accessToken);
    const session = h.sessions.get(payload.sid)!;
    session.expiresAt = new Date(0);
    expect((await request("/auth/me", initial.accessToken)).status).toBe(401);
    session.expiresAt = new Date(Date.now() + 60000); session.userId = "different-user";
    expect((await request("/auth/me", initial.accessToken)).status).toBe(401);
    const legacy = h.jwt.sign({ sub: h.user.id }, { secret: h.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: "1m" });
    expect((await request("/auth/me", legacy)).status).toBe(401);
    h.sessions.delete(payload.sid);
    expect((await request("/auth/me", initial.accessToken)).status).toBe(401);
  });

  it("returns failure rather than claiming logout when persistence fails", async () => {
    const initial = await login();
    h.db.authSession.updateMany.mockRejectedValueOnce(new Error("synthetic persistence failure"));
    const result = await request("/auth/logout", initial.accessToken, {});
    expect(result.status).toBe(500);
    expect(result.headers.get("set-cookie")).toBeNull();
    expect((await request("/auth/me", initial.accessToken)).status).toBe(200);
  });

  it("rechecks persisted revocation before every outbound event", async () => {
    const initial = await login(); const socket = await connect(initial.accessToken);
    let messages = 0; socket.on("notification.created", () => { messages += 1; });
    h.sessions.get(h.jwt.decode(initial.accessToken).sid)!.revokedAt = new Date();
    const disconnected = new Promise<void>(resolveDisconnect => socket.once("disconnect", resolveDisconnect));
    await h.realtime.emitNotificationCreated({ id: "synthetic", userId: h.user.id, type: "test", message: "synthetic", isRead: false, createdAt: new Date() });
    await disconnected;
    expect(messages).toBe(0); socket.disconnect();
  });

  it("disconnects a socket when its signed access token expires", async () => {
    const initial = await login(); const { sub, sid } = h.jwt.decode(initial.accessToken);
    const short = h.jwt.sign({ sub, sid }, { secret: h.config.getOrThrow("JWT_ACCESS_SECRET"), expiresIn: 2 });
    const socket = await connect(short);
    await new Promise<void>(resolveDisconnect => socket.once("disconnect", resolveDisconnect));
    expect(socket.connected).toBe(false); socket.disconnect();
  });
});
