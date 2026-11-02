import { randomUUID, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { PrismaClient } from "@porisrom/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ensureSecurityUsers, SYNTHETIC_TEST_PASSWORD } from "../src/testing/security-fixture";

const testUrl = process.env.PORISROM_CLUSTER_TEST_DATABASE_URL;
const { io } = createRequire(resolve(process.cwd(), "../frontend/package.json"))("socket.io-client");
describe.skipIf(!testUrl)("PostgreSQL sockets across two separate backend processes", () => {
  let db: PrismaClient; let users: Awaited<ReturnType<typeof ensureSecurityUsers>>;
  let a: string; let b: string; let conversationId: string; let connectionId: string;
  let adminToken: string; let clientToken: string;
  const children: ChildProcess[] = [];
  const workerErrors: string[] = [];
  const namespace = `security-cluster-${randomUUID()}`;
  const accessSecret = randomBytes(48).toString("hex"); const refreshSecret = randomBytes(48).toString("hex");
  const sockets: Array<{ disconnect: () => void }> = [];
  const request = (base: string, path: string, token?: string, body?: object, method = body ? "POST" : "GET") => fetch(base + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  async function port() { const server = createServer(); await new Promise<void>((done) => server.listen(0, "127.0.0.1", done)); const p = (server.address() as { port: number }).port; await new Promise<void>((done) => server.close(() => done())); return p; }
  async function ready(base: string) {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      try { if ((await fetch(base + "/health/ready")).status === 200) return; } catch { /* Startup only. */ }
      await new Promise((done) => setTimeout(done, 150));
    }
    throw Error(`Isolated worker did not become ready: ${workerErrors.join(" ").slice(-1400)}`);
  }
  async function login(role: "admin" | "client" | "freelancer") {
    const response = await request(b, "/auth/login", undefined, { email: users[role].email, password: SYNTHETIC_TEST_PASSWORD });
    expect(response.status).toBe(200); return response.json();
  }
  async function connect(token: string) {
    const socket = io(a, { auth: { token }, transports: ["websocket"], reconnection: false, forceNew: true, timeout: 3000 });
    sockets.push(socket);
    await new Promise<void>((done, reject) => { socket.once("connect", done); socket.once("connect_error", (error: Error) => { socket.disconnect(); reject(error); }); });
    return socket;
  }
  beforeAll(async () => {
    const { PrismaPg } = createRequire(resolve(process.cwd(), "../../packages/database/package.json"))("@prisma/adapter-pg");
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    users = await ensureSecurityUsers(db, namespace, testUrl);
    const connection = await db.connection.create({ data: { requesterId: users.client.id, receiverId: users.freelancer.id, status: "accepted" } }); connectionId = connection.id;
    conversationId = (await db.conversation.create({ data: { connectionId } })).id;
    const prefix = `t_${randomBytes(12).toString("hex")}`;
    const ports = [await port(), await port()]; a = `http://127.0.0.1:${ports[0]}`; b = `http://127.0.0.1:${ports[1]}`;
    for (const workerPort of ports) {
      const child = spawn(process.execPath, ["dist/main.js"], { cwd: process.cwd(), windowsHide: true, stdio: ["ignore", "ignore", "pipe"], env: {
        ...process.env, NODE_ENV: "test", DATABASE_URL: testUrl, PORT: String(workerPort), HOST: "127.0.0.1",
        JWT_ACCESS_SECRET: accessSecret, JWT_REFRESH_SECRET: refreshSecret, SOCKET_ADAPTER: "postgres", SOCKET_CHANNEL_PREFIX: prefix,
        REALTIME_EXPECTED_INSTANCES: "2", CLOUDINARY_CLOUD_NAME: "", CLOUDINARY_API_KEY: "", CLOUDINARY_API_SECRET: "",
      } });
      child.stderr?.on("data", (chunk) => workerErrors.push(String(chunk).replaceAll(testUrl!, "[test-db]").replaceAll(accessSecret, "[redacted]").replaceAll(refreshSecret, "[redacted]")));
      children.push(child);
    }
    await Promise.all([ready(a), ready(b)]);
    adminToken = (await login("admin")).accessToken; clientToken = (await login("client")).accessToken;
  }, 30000);
  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    await Promise.all(children.map((child) => new Promise<void>((done) => {
      if (child.exitCode !== null) return done();
      child.once("exit", () => done()); child.kill("SIGTERM");
      setTimeout(() => { if (child.exitCode === null) child.kill("SIGKILL"); }, 3000).unref();
    })));
    if (!db) return;
    try {
      if (conversationId) { await db.safetyCaseEvent.deleteMany({ where: { case: { conversationId } } }); await db.safetyCase.deleteMany({ where: { conversationId } }); await db.message.deleteMany({ where: { conversationId } }); await db.conversation.deleteMany({ where: { id: conversationId } }); await db.connection.deleteMany({ where: { id: connectionId } }); }
      if (users) {
        const ids = Object.values(users).map((u) => u.id);
        await db.safetyCaseEvent.deleteMany({ where: { case: { reporterId: { in: ids } } } });
        await db.safetyCase.deleteMany({ where: { reporterId: { in: ids } } });
        await db.userBlock.deleteMany({ where: { blockerId: { in: ids } } });
        await db.notification.deleteMany({ where: { userId: { in: ids } } }); await db.adminActionLog.deleteMany({ where: { adminId: users.admin.id } });
        await db.companyDocument.deleteMany({ where: { companyProfile: { userId: users.client.id } } });
        await db.companyProfile.deleteMany({ where: { userId: users.client.id } });
        await db.authSession.deleteMany({ where: { userId: { in: ids } } }); await db.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await db.$disconnect(); }
  });
  it("logout through instance B disconnects an idle session connected to A and rejects reconnect", async () => {
    const session = await login("freelancer"); const socket = await connect(session.accessToken);
    const disconnected = new Promise<void>((done) => socket.once("disconnect", done));
    expect((await request(b, "/auth/logout", session.accessToken, {})).status).toBe(200);
    await disconnected; expect(socket.connected).toBe(false);
    const denied = await connect(session.accessToken).then((s) => { s.disconnect(); return false; }, () => true);
    expect(denied).toBe(true);
  });
  it("a message persisted on B is delivered once to A without duplicate database records", async () => {
    const session = await login("freelancer"); const socket = await connect(session.accessToken);
    const messages: Array<{ id: string }> = [];
    socket.on("message.created", (message: { id: string }) => messages.push(message));
    const delivered = new Promise<void>((done) => socket.once("message.created", () => done()));
    const response = await request(b, `/conversations/${conversationId}/messages`, clientToken, { body: "Synthetic cross-process message" });
    expect(response.status).toBe(201); const message = await response.json(); await delivered;
    await new Promise((done) => setTimeout(done, 100));
    expect(messages.filter((m) => m.id === message.id)).toHaveLength(1);
    expect(await db.message.count({ where: { conversationId } })).toBe(1); socket.disconnect();
  });
  it("moderation on B disconnects A, preserves authorized history, and unblocking cannot revive old sessions", async () => {
    const session = await login("freelancer"); const socket = await connect(session.accessToken);
    const disconnected = new Promise<void>((done) => socket.once("disconnect", done));
    expect((await request(b, `/admin/users/${users.freelancer.id}/block`, adminToken, { blocked: true }, "PATCH")).status).toBe(200);
    await disconnected; expect(socket.connected).toBe(false);
    expect((await request(a, `/conversations/${conversationId}/messages`, clientToken)).status).toBe(200);
    expect((await request(b, `/conversations/${conversationId}/messages`, clientToken, { body: "Denied after moderation" })).status).toBe(403);
    expect((await request(b, `/admin/users/${users.freelancer.id}/block`, adminToken, { blocked: false }, "PATCH")).status).toBe(200);
    const denied = await connect(session.accessToken).then((s) => { s.disconnect(); return false; }, () => true);
    expect(denied).toBe(true);
  });
  it("denies anonymous/user administrative case access and validates required reason/category", async () => {
    expect((await request(a, "/admin/safety/cases")).status).toBe(401);
    expect((await request(a, "/admin/safety/cases", clientToken)).status).toBe(403);
    expect((await request(a, "/safety/reports", clientToken, { targetUserId: users.freelancer.id, category: "invented", reason: "x" })).status).toBe(400);
    expect((await request(a, "/safety/support", clientToken, { category: "account", reason: "x" })).status).toBe(400);
    expect((await request(a, "/search/companies", "invalid-synthetic-token")).status).toBe(401);
  });
  it("stores reports privately through real HTTP and requires an audited admin decision", async () => {
    const response = await request(a, "/safety/reports", clientToken, { targetUserId: users.freelancer.id, category: "fraud", reason: "Synthetic report must stay private", conversationId });
    expect(response.status).toBe(201); const report = await response.json();
    expect((await request(b, `/admin/safety/cases/${report.id}`, clientToken)).status).toBe(403);
    expect((await request(b, `/admin/safety/cases/${report.id}/review`, adminToken, { decision: "resolve", reason: "" })).status).toBe(400);
    expect((await request(b, `/admin/safety/cases/${report.id}/review`, adminToken, { decision: "resolve", reason: "Synthetic review; no disclosure to target." })).status).toBe(201);
    expect(await db.adminActionLog.count({ where: { adminId: users.admin.id, action: "review_safety_case" } })).toBe(1);
    const mine = await (await request(b, "/safety/cases", clientToken)).json();
    expect(mine.some((row: { id: string }) => row.id === report.id)).toBe(false);
  });
  it("pair blocking on B freezes an already-open conversation on A without revoking unrelated sessions", async () => {
    const session = await login("freelancer"); const socket = await connect(session.accessToken);
    const messages: unknown[] = []; socket.on("message.created", (m: unknown) => messages.push(m));
    const before = await db.message.count({ where: { conversationId } });
    const blocked = await request(b, "/safety/blocks", clientToken, { blockedUserId: users.freelancer.id });
    expect(blocked.status).toBe(201); const block = await blocked.json();
    expect((await request(a, `/conversations/${conversationId}/messages`, session.accessToken, { body: "Denied through alternate instance" })).status).toBe(403);
    socket.emit("message.created", { conversationId, body: "Forged socket bypass" });
    await new Promise((done) => setTimeout(done, 150));
    expect(messages).toHaveLength(0); expect(socket.connected).toBe(true);
    expect(await db.message.count({ where: { conversationId } })).toBe(before);
    expect((await request(a, "/auth/me", session.accessToken)).status).toBe(200);
    expect((await request(a, `/conversations/${conversationId}/messages`, session.accessToken)).status).toBe(200);
    expect((await request(a, `/safety/blocks/${block.id}`, session.accessToken, undefined, "DELETE")).status).toBe(403);
    expect((await request(b, `/safety/blocks/${block.id}`, clientToken, undefined, "DELETE")).status).toBe(200);
    socket.disconnect();
  });

  it("accepts five exact-limit private PDFs but rejects over-limit bytes and file count", async () => {
    await db.companyProfile.create({ data: { userId: users.client.id, companyName: "Synthetic upload boundary" } });
    const pdf = new Uint8Array(1024 * 1024); pdf.set(new TextEncoder().encode("%PDF-1.4 Synthetic test only"));
    const form = new FormData(); form.set("certificate", new Blob([pdf], { type: "application/pdf" }), "synthetic-certificate.pdf");
    for (let i = 0; i < 4; i++) form.append("aadhaar", new Blob([pdf], { type: "application/pdf" }), `synthetic-${i}.pdf`);
    const upload = await fetch(b + "/companies/me/documents", { method: "POST", headers: { Authorization: `Bearer ${clientToken}` }, body: form });
    expect(upload.status).toBe(201);
    expect((await upload.json()).documents).toHaveLength(5);
    const oversized = new FormData(); oversized.set("certificate", new Blob([new Uint8Array(1024 * 1024 + 1)], { type: "application/pdf" }), "synthetic-oversized.pdf");
    expect((await fetch(a + "/companies/me/documents", { method: "POST", headers: { Authorization: `Bearer ${clientToken}` }, body: oversized })).status).toBe(413);
    const tooMany = new FormData(); for (let i = 0; i < 5; i++) tooMany.append("aadhaar", new Blob([pdf], { type: "application/pdf" }), `synthetic-${i}.pdf`);
    expect((await fetch(a + "/companies/me/documents", { method: "POST", headers: { Authorization: `Bearer ${clientToken}` }, body: tooMany })).status).toBe(400);
    expect(await db.companyDocument.count({ where: { companyProfile: { userId: users.client.id } } })).toBe(5);
  });

});
