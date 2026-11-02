import { createServer } from "node:http";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Server } from "socket.io";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AdminService } from "../src/admin/admin.service";
import { RealtimeGateway } from "../src/realtime/realtime.gateway";
import { JwtStrategy } from "../src/auth/strategies/jwt.strategy";

const { io } = createRequire(resolve(process.cwd(), "../frontend/package.json"))("socket.io-client");
const closers: Array<() => Promise<void>> = [];
afterEach(async () => { for (const close of closers.splice(0)) await close(); });

async function fixture() {
  const users = new Map([
    ["moderator", { id: "moderator", role: "admin", status: "active" }],
    ["client", { id: "client", role: "client", status: "active" }],
    ["freelancer", { id: "freelancer", role: "freelancer", status: "active" }],
  ]);
  const sessions = ["client", "freelancer", "freelancer"].map((userId, index) => ({ id: `session-${index}`, userId, revokedAt: null as Date | null, expiresAt: new Date(Date.now() + 60000) }));
  const db = {
    $queryRaw: vi.fn(),
    adminActionLog: { create: vi.fn() },
    user: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => { const user = users.get(where.id); return user ? { ...user } : null; }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: { status: string } }) => Object.assign(users.get(where.id)!, data)),
    },
    authSession: {
      findUnique: vi.fn(async ({ where }: { where: { id: string } }) => sessions.find((s) => s.id === where.id)),
      updateMany: vi.fn(async ({ where, data }: { where: { userId: string }; data: { revokedAt: Date } }) => {
        for (const s of sessions) if (s.userId === where.userId && !s.revokedAt) s.revokedAt = data.revokedAt;
        return { count: sessions.filter((s) => s.userId === where.userId).length };
      }),
    },
    connection: { findMany: vi.fn(async () => [{ requester: users.get("client"), receiver: users.get("freelancer") }]) },
    conversation: { findUnique: vi.fn(async () => ({ connection: { requesterId: "client", receiverId: "freelancer" } })) },
    notification: { create: vi.fn(async ({ data }: { data: { userId: string; type: string; message: string } }) => ({ ...data, id: "notice", createdAt: new Date(), isRead: false })) },
  };
  const prisma = { db: { ...db, $transaction: <T>(fn: (tx: typeof db) => T) => fn(db) } } as never;
  const jwt = new JwtService(); const config = new ConfigService({ JWT_ACCESS_SECRET: "synthetic-moderation-secret" });
  const gateway = new RealtimeGateway(jwt, config, prisma);
  const http = createServer(); const server = new Server(http); gateway.afterInit(server);
  const received = { packets: 0 };
  server.on("connection", (socket) => {
    gateway.handleConnection(socket);
    socket.on("synthetic.ping", (ack: () => void) => { received.packets++; ack(); });
  });
  await new Promise<void>((done) => http.listen(0, "127.0.0.1", done));
  const address = http.address() as { port: number };
  closers.push(() => new Promise<void>((done) => server.close(() => done())));
  const tokens = sessions.map((session) => jwt.sign({ sub: session.userId, sid: session.id, role: users.get(session.userId)!.role }, { secret: "synthetic-moderation-secret", expiresIn: "1m" }));
  async function connect(token: string) {
    const socket = io(`http://127.0.0.1:${address.port}`, { auth: { token }, transports: ["websocket"], reconnection: false, forceNew: true });
    await new Promise<void>((done, reject) => { socket.once("connect", done); socket.once("connect_error", (error: Error) => { socket.disconnect(); reject(error); }); });
    return socket;
  }
  return { db, users, sessions, gateway, tokens, connect, server, received, admin: new AdminService(prisma, gateway), strategy: new JwtStrategy(config, prisma), jwt };
}

describe.each(["blocked", "deleted"])("%s account realtime boundary", (status) => {
  it("revokes every session and disconnects idle tabs while notifying only the active counterpart", async () => {
    const h = await fixture();
    const client = await h.connect(h.tokens[0]);
    const tab1 = await h.connect(h.tokens[1]); const tab2 = await h.connect(h.tokens[2]);
    const notice = new Promise<{ type: string }>((done) => client.once("notification.created", done));
    const disconnected = [tab1, tab2].map((socket) => new Promise<void>((done) => socket.once("disconnect", done)));
    if (status === "blocked") await h.admin.setBlocked("freelancer", true, "moderator"); else await h.admin.softDeleteUser("freelancer", "moderator");
    await Promise.all(disconnected);
    expect((await notice).type).toBe("account_moderated");
    expect(tab1.connected).toBe(false); expect(tab2.connected).toBe(false); expect(client.connected).toBe(true);
    expect(h.sessions.filter((s) => s.userId === "freelancer").every((s) => s.revokedAt)).toBe(true);
    expect(h.sessions[0].revokedAt).toBeNull();
    await expect(h.strategy.validate(h.jwt.decode(h.tokens[1]))).rejects.toMatchObject({ status: 401 });
    await expect(h.connect(h.tokens[1])).rejects.toThrow("Unauthorized");
    if (status === "blocked") {
      await h.admin.setBlocked("freelancer", false, "moderator");
      await expect(h.strategy.validate(h.jwt.decode(h.tokens[1]))).rejects.toMatchObject({ status: 401 });
    }
    client.disconnect(); tab1.disconnect(); tab2.disconnect();
  });
  it("denies delayed message delivery from a moderated sender", async () => {
    const h = await fixture(); const client = await h.connect(h.tokens[0]);
    h.users.get("freelancer")!.status = status;
    const emit = vi.spyOn(h.gateway as unknown as { emitToActiveUser: (...args: unknown[]) => Promise<void> }, "emitToActiveUser");
    await h.gateway.emitMessageCreated({ id: "historical", conversationId: "conversation", senderId: "freelancer", body: "Synthetic", createdAt: new Date(), readAt: null });
    expect(emit).not.toHaveBeenCalled(); client.disconnect();
  });
  it("rechecks status before delivery even when moderation bypassed the application", async () => {
    const h = await fixture(); const socket = await h.connect(h.tokens[1]);
    const disconnected = new Promise<void>((done) => socket.once("disconnect", done));
    h.users.get("freelancer")!.status = status;
    await h.gateway.emitNotificationCreated({ id: "notice", userId: "freelancer", type: "synthetic", message: "Synthetic", isRead: false, createdAt: new Date() });
    await disconnected; expect(socket.connected).toBe(false); socket.disconnect();
  });
  it("denies inbound packets on a previously authorized socket after a status change", async () => {
    const h = await fixture(); const socket = await h.connect(h.tokens[1]);
    h.users.get("freelancer")!.status = status;
    const disconnected = new Promise<void>((done) => socket.once("disconnect", done));
    socket.emit("synthetic.ping", () => {});
    await disconnected; expect(h.received.packets).toBe(0); socket.disconnect();
  });
});

it("cannot subscribe to a counterpart's user room through a client event", async () => {
  const h = await fixture(); const socket = await h.connect(h.tokens[1]);
  socket.emit("join", "user:client");
  await new Promise<void>((done) => socket.emit("synthetic.ping", done));
  expect(h.server.sockets.sockets.get(socket.id)?.rooms.has("user:client")).toBe(false);
  expect(h.server.sockets.sockets.get(socket.id)?.rooms.has("user:freelancer")).toBe(true);
  socket.disconnect();
});


it("does not announce success or disconnect sockets when revocation persistence fails", async () => {
  const h = await fixture();
  const disconnect = vi.spyOn(h.gateway, "disconnectUser");
  h.db.authSession.updateMany.mockRejectedValueOnce(new Error("Synthetic database failure"));
  await expect(h.admin.setBlocked("freelancer", true, "moderator")).rejects.toThrow("Synthetic database failure");
  expect(disconnect).not.toHaveBeenCalled();
  expect(h.db.notification.create).not.toHaveBeenCalled();
});

it("does not duplicate counterpart notices when blocking an already blocked account", async () => {
  const h = await fixture();
  await h.admin.setBlocked("freelancer", true, "moderator");
  await h.admin.setBlocked("freelancer", true, "moderator");
  expect(h.db.notification.create).toHaveBeenCalledTimes(1);
});
