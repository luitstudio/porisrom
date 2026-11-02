import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { type INestApplication, Module, ValidationPipe } from "@nestjs/common";
import { NestFactory, Reflector } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { PrismaClient, type Prisma } from "@porisrom/database";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { AdminController } from "../src/admin/admin.controller";
import { AdminService } from "../src/admin/admin.service";
import { PaymentDisputesService } from "../src/admin/payment-disputes.service";
import { ResolvePaymentDisputeDto } from "../src/admin/dto/resolve-payment-dispute.dto";
import { PaymentIdParamsDto } from "../src/admin/dto/payment-id-params.dto";
import { AdminActionLogInterceptor } from "../src/admin/interceptors/admin-action-log.interceptor";
import { AuthController } from "../src/auth/auth.controller";
import { AuthService } from "../src/auth/auth.service";
import { JwtStrategy } from "../src/auth/strategies/jwt.strategy";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { AuthRateLimitGuard } from "../src/auth/guards/auth-rate-limit.guard";
import { IdentityDocumentService } from "../src/kyc/identity-document.service";
import { CompanyDocumentService } from "../src/profiles/company-document.service";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { ensureSecurityUsers, SYNTHETIC_TEST_PASSWORD } from "../src/testing/security-fixture";

const testUrl = process.env.PORISROM_ADMIN_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("isolated PostgreSQL admin authentication and disputes", () => {
  let db: PrismaClient; let app: INestApplication; let base: string;
  let users: Awaited<ReturnType<typeof ensureSecurityUsers>>;
  let adminToken: string; let clientToken: string;
  let conversationId: string; let connectionId: string;
  let disputes: PaymentDisputesService; let assignments: WorkAssignmentsService;
  let admin: AdminService;
  const namespace = `security-admin-${randomUUID()}`;
  const realtime = { emitNotificationCreated: vi.fn(), emitWorkAssignmentUpdated: vi.fn(), disconnectUser: vi.fn() };
  const reason = "Synthetic evidence reviewed; administrative decision recorded.";
  const request = (path: string, token?: string, body?: object, method = body ? "POST" : "GET") => fetch(`${base}${path}`, {
    method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  async function login(role: "admin" | "client" | "freelancer") {
    const response = await request("/auth/login", undefined, { email: users[role].email, password: SYNTHETIC_TEST_PASSWORD });
    expect(response.status).toBe(200); return response.json();
  }
  async function makeDispute(status: "disputed" | "payment_pending" = "disputed") {
    const assignment = await db.workAssignment.create({ data: { conversationId, createdById: users.client.id, title: "Synthetic dispute", description: namespace, budgetAmount: 100, status } });
    return db.paymentVerification.create({ data: { workAssignmentId: assignment.id, status: status === "disputed" ? "mismatch" : "awaiting_client", mismatchCount: status === "disputed" ? 3 : 0 } });
  }
  beforeAll(async () => {
    const { PrismaPg } = createRequire(resolve(process.cwd(), "../../packages/database/package.json"))("@prisma/adapter-pg");
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    users = await ensureSecurityUsers(db, namespace, testUrl);
    const again = await ensureSecurityUsers(db, namespace, testUrl);
    expect(again.admin.id).toBe(users.admin.id);
    await db.freelancerProfile.create({ data: { userId: users.freelancer.id } });
    const connection = await db.connection.create({ data: { requesterId: users.client.id, receiverId: users.freelancer.id, status: "accepted" } }); connectionId = connection.id;
    const conversation = await db.conversation.create({ data: { connectionId } }); conversationId = conversation.id;
    const prisma = { db } as never;
    const config = new ConfigService({ JWT_ACCESS_SECRET: "synthetic-admin-pg-access", JWT_REFRESH_SECRET: "synthetic-admin-pg-refresh" });
    const auth = new AuthService(prisma, new JwtService(), config);
    admin = new AdminService(prisma, realtime as never);
    disputes = new PaymentDisputesService(prisma, realtime as never); assignments = new WorkAssignmentsService(prisma, realtime as never);
    Reflect.defineMetadata("design:paramtypes", [AuthService], AuthController);
    Reflect.defineMetadata("design:paramtypes", [Reflector], RolesGuard);
    Reflect.defineMetadata("design:paramtypes", [Reflector, PrismaService], AdminActionLogInterceptor);
    Reflect.defineMetadata("design:paramtypes", [AdminService, IdentityDocumentService, CompanyDocumentService, PaymentDisputesService], AdminController);
    Reflect.defineMetadata("design:paramtypes", [Object, PaymentIdParamsDto, ResolvePaymentDisputeDto], AdminController.prototype, "resolvePayment");
    Reflect.defineMetadata("design:paramtypes", [PaymentIdParamsDto], AdminController.prototype, "paymentDetails");
    @Module({ controllers: [AuthController, AdminController], providers: [AuthRateLimitGuard,
      { provide: PrismaService, useValue: prisma },
      { provide: AuthService, useValue: auth }, { provide: AdminService, useValue: admin }, { provide: PaymentDisputesService, useValue: disputes },
      { provide: JwtStrategy, useValue: new JwtStrategy(config, prisma) }, { provide: RolesGuard, useValue: new RolesGuard(new Reflector()) },
      { provide: IdentityDocumentService, useValue: {} }, { provide: CompanyDocumentService, useValue: {} },
      { provide: AdminActionLogInterceptor, useValue: new AdminActionLogInterceptor(new Reflector(), prisma) },
    ] }) class TestAdminModule {}
    app = await NestFactory.create(TestAdminModule, { logger: false });
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.listen(0, "127.0.0.1"); base = await app.getUrl();
    adminToken = (await login("admin")).accessToken; clientToken = (await login("client")).accessToken;
  }, 20000);
  afterAll(async () => {
    await app?.close(); if (!db) return;
    try {
      if (conversationId) {
        const scope = { workAssignment: { conversationId } };
        await db.paymentClaim.deleteMany({ where: { paymentVerification: scope } });
        await db.paymentVerification.deleteMany({ where: scope });
        await db.workAssignmentEvent.deleteMany({ where: scope });
        await db.workAssignment.deleteMany({ where: { conversationId } });
        await db.message.deleteMany({ where: { conversationId } });
        await db.conversation.deleteMany({ where: { id: conversationId } });
        await db.connection.deleteMany({ where: { id: connectionId } });
      }
      if (users) {
        const ids = Object.values(users).map((user) => user.id);
        await db.notification.deleteMany({ where: { OR: [{ userId: { in: ids } }, { type: namespace }] } });
        await db.adminActionLog.deleteMany({ where: { adminId: users.admin.id } });
        await db.authSession.deleteMany({ where: { userId: { in: ids } } });
        await db.identityDocument.deleteMany({ where: { freelancerProfile: { userId: users.freelancer.id } } });
        await db.freelancerProfile.deleteMany({ where: { userId: users.freelancer.id } });
        await db.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await db.$disconnect(); }
  });

  it("authenticates the dedicated administrator through real login and session validation", async () => {
    expect((await request("/auth/me", adminToken)).status).toBe(200);
    expect((await request("/admin/payments", adminToken)).status).toBe(200);
    expect(await db.user.count({ where: { id: users.admin.id, role: "admin" } })).toBe(1);
  });
  it("denies anonymous and normal-user listing, viewing, and resolution", async () => {
    const payment = await makeDispute();
    for (const [token, expected] of [[undefined, 401], [clientToken, 403]] as const) {
      expect((await request("/admin/payments", token)).status).toBe(expected);
      expect((await request(`/admin/payments/${payment.id}`, token)).status).toBe(expected);
      expect((await request(`/admin/payments/${payment.id}/resolve`, token, { outcome: "complete", reason, expectedMismatchCount: 3 })).status).toBe(expected);
    }
  });
  it.each(["blocked", "deleted"] as const)("denies a %s admin's existing JWT and login", async (status) => {
    await db.user.update({ where: { id: users.admin.id }, data: { status } });
    try {
      expect((await request("/admin/payments", adminToken)).status).toBe(401);
      expect((await request("/auth/login", undefined, { email: users.admin.email, password: SYNTHETIC_TEST_PASSWORD })).status).toBe(403);
    } finally { await db.user.update({ where: { id: users.admin.id }, data: { status: "active" } }); }
  });
  it("revokes the administrator session on logout", async () => {
    const session = await login("admin");
    expect((await request("/auth/logout", session.accessToken, {})).status).toBe(200);
    expect((await request("/admin/payments", session.accessToken)).status).toBe(401);
  });
  it("persists audit records for profile, badge, document, and notification administration", async () => {
    const profile = await db.freelancerProfile.findUniqueOrThrow({ where: { userId: users.freelancer.id } });
    await db.identityDocument.create({ data: { freelancerProfileId: profile.id, cloudinaryPublicId: "synthetic-no-file", cloudinaryAssetId: "synthetic-no-asset" } });
    await admin.approveProfile(users.freelancer.id, users.admin.id);
    await admin.rejectProfile(users.freelancer.id, users.admin.id);
    await admin.setBadge(users.freelancer.id, true, users.admin.id);
    await admin.broadcastNotification(users.admin.id, namespace, "Synthetic broadcast");
    await admin.sendDirectMessage(users.admin.id, users.client.id, "Synthetic direct notification");
    await new IdentityDocumentService({ db } as never, {} as never).reviewForAdmin(users.admin.id, users.freelancer.id, "approved");
    const logs = await db.adminActionLog.findMany({ where: { adminId: users.admin.id } });
    expect(logs.map((log) => log.action)).toEqual(expect.arrayContaining(["approve_profile", "reject_profile", "set_badge", "broadcast_notification", "send_direct_message", "review_identity_document"]));
    await expect(admin.approveProfile(users.freelancer.id, users.client.id)).rejects.toMatchObject({ status: 403 });
    // Broadcasts are identified by this run's unique synthetic type, not userId.
    await db.notification.deleteMany({ where: { type: namespace } });
  });
  it("allows exactly one of two concurrent ordinary assignment responses", async () => {
    const payment = await makeDispute("payment_pending");
    await db.workAssignment.update({ where: { id: payment.workAssignmentId }, data: { status: "proposed" } });
    const results = await Promise.allSettled([
      assignments.respond(users.freelancer.id, payment.workAssignmentId, { action: "accept" }),
      assignments.respond(users.freelancer.id, payment.workAssignmentId, { action: "reject" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await db.workAssignmentEvent.count({ where: { workAssignmentId: payment.workAssignmentId } })).toBe(1);
  });
  it.each([
    { outcome: "refund", reason, expectedMismatchCount: 3 },
    { outcome: "complete", reason: " ", expectedMismatchCount: 3 },
    { outcome: "complete", reason, expectedMismatchCount: 2 },
    { outcome: "complete", reason, expectedMismatchCount: "3" },
  ])("rejects invalid decision input %# before any mutation", async (body) => {
    const payment = await makeDispute();
    expect((await request(`/admin/payments/${payment.id}/resolve`, adminToken, body)).status).toBe(400);
    expect((await db.workAssignment.findUniqueOrThrow({ where: { id: payment.workAssignmentId } })).status).toBe("disputed");
  });
  it("rejects nonexistent payments and non-disputed state transitions", async () => {
    expect((await request("/admin/payments/invalid!/resolve", adminToken, { outcome: "complete", reason, expectedMismatchCount: 3 })).status).toBe(400);
    expect((await request("/admin/payments/no-such-payment/resolve", adminToken, { outcome: "complete", reason, expectedMismatchCount: 3 })).status).toBe(404);
    const payment = await makeDispute("payment_pending");
    expect((await request(`/admin/payments/${payment.id}/resolve`, adminToken, { outcome: "complete", reason, expectedMismatchCount: 3 })).status).toBe(409);
  });
  it("records manual completion, audit, event and both notifications atomically", async () => {
    const payment = await makeDispute();
    const result = await request(`/admin/payments/${payment.id}/resolve`, adminToken, { outcome: "complete", reason, expectedMismatchCount: 3 });
    expect(result.status).toBe(201); const payload = await result.json();
    expect(payload.payment).toMatchObject({ status: "administratively_resolved", verifiedAt: null, mismatchCount: 3 });
    expect((await db.workAssignment.findUniqueOrThrow({ where: { id: payment.workAssignmentId } })).status).toBe("completed");
    expect(await db.adminActionLog.findUniqueOrThrow({ where: { id: payload.auditId } })).toMatchObject({ adminId: users.admin.id, metadata: { paymentVerificationId: payment.id, outcome: "complete", reason } });
    const details = await (await request(`/admin/payments/${payment.id}`, adminToken)).json();
    expect(details.decisions).toHaveLength(1);
    expect(await db.workAssignmentEvent.count({ where: { workAssignmentId: payment.workAssignmentId, actorId: users.admin.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: { in: [users.client.id, users.freelancer.id] }, type: "payment_dispute_resolved", createdBy: users.admin.id } })).toBeGreaterThanOrEqual(2);
    expect((await request(`/admin/payments/${payment.id}/resolve`, adminToken, { outcome: "complete", reason, expectedMismatchCount: 3 })).status).toBe(409);
  });
  it("allows exactly one concurrent resolution and one decision record", async () => {
    const payment = await makeDispute();
    const responses = await Promise.all(Array.from({ length: 6 }, () => request(`/admin/payments/${payment.id}/resolve`, adminToken, { outcome: "complete", reason, expectedMismatchCount: 3 })));
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409, 409, 409, 409, 409]);
    expect(await db.adminActionLog.count({ where: { action: "resolve_payment_dispute", metadata: { path: ["paymentVerificationId"], equals: payment.id } } })).toBe(1);
  });
  it("preserves all submitted claims and the lifetime mismatch count across reopen and later re-dispute", async () => {
    const payment = await makeDispute("payment_pending");
    for (let round = 0; round < 3; round++) {
      await assignments.claimPaid(users.client.id, payment.workAssignmentId, { utr: `synthetic-client-${round}` });
      await assignments.claimReceived(users.freelancer.id, payment.workAssignmentId, { utr: `synthetic-freelancer-${round}` });
    }
    expect(await db.paymentClaim.count({ where: { paymentVerificationId: payment.id } })).toBe(6);
    await disputes.resolve(users.admin.id, payment.id, { outcome: "reopen_claims", reason, expectedMismatchCount: 3 });
    expect(await db.paymentVerification.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ mismatchCount: 3, mismatchCountAtReopen: 3, status: "awaiting_client" });
    for (let round = 3; round < 6; round++) {
      await assignments.claimPaid(users.client.id, payment.workAssignmentId, { utr: `synthetic-client-${round}` });
      await assignments.claimReceived(users.freelancer.id, payment.workAssignmentId, { utr: `synthetic-freelancer-${round}` });
    }
    expect((await db.paymentVerification.findUniqueOrThrow({ where: { id: payment.id } })).mismatchCount).toBe(6);
    expect(await db.paymentClaim.count({ where: { paymentVerificationId: payment.id } })).toBe(12);
    await expect(disputes.resolve(users.admin.id, payment.id, { outcome: "complete", reason, expectedMismatchCount: 3 })).rejects.toMatchObject({ status: 409 });
    expect(await db.notification.count({ where: { userId: users.client.id, type: "payment_disputed" } })).toBeGreaterThanOrEqual(2);
    await disputes.resolve(users.admin.id, payment.id, { outcome: "complete", reason, expectedMismatchCount: 6 });
    expect(await db.paymentClaim.count({ where: { paymentVerificationId: payment.id } })).toBe(12);
  });
  it("retains a pre-existing legacy reference before a new mismatch clears current comparison fields", async () => {
    const payment = await makeDispute("payment_pending");
    const claimedAt = new Date("2026-10-01T00:00:00Z");
    await db.paymentVerification.update({ where: { id: payment.id }, data: { clientUtr: "synthetic-legacy-reference", clientClaimedAt: claimedAt } });
    await assignments.claimReceived(users.freelancer.id, payment.workAssignmentId, { utr: "synthetic-new-other-reference" });
    const claims = await db.paymentClaim.findMany({ where: { paymentVerificationId: payment.id } });
    expect(claims).toHaveLength(2);
    expect(claims).toEqual(expect.arrayContaining([expect.objectContaining({ reference: "synthetic-legacy-reference", createdAt: claimedAt })]));
    expect(await db.paymentVerification.findUniqueOrThrow({ where: { id: payment.id } })).toMatchObject({ clientUtr: null, freelancerUtr: null, mismatchCount: 1 });
  });
  it("prevents reopening frozen work but permits an explicit administrative completion", async () => {
    const payment = await makeDispute();
    await admin.setBlocked(users.freelancer.id, true, users.admin.id);
    try {
      await expect(disputes.resolve(users.admin.id, payment.id, { outcome: "reopen_claims", reason, expectedMismatchCount: 3 })).rejects.toMatchObject({ status: 409 });
      await disputes.resolve(users.admin.id, payment.id, { outcome: "complete", reason, expectedMismatchCount: 3 });
    } finally { await admin.setBlocked(users.freelancer.id, false, users.admin.id); }
  });
  it.each(["audit", "notification"])("rolls back every database mutation when %s persistence fails", async (failure) => {
    const payment = await makeDispute(); realtime.emitNotificationCreated.mockClear();
    const faultyDb = { $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction((tx) => fn(new Proxy(tx, {
      get(target, key) {
        if (key === (failure === "audit" ? "adminActionLog" : "notification")) return { create: async () => { throw new Error(`Synthetic ${failure} failure`); } };
        return Reflect.get(target, key);
      },
    }))) };
    await expect(new PaymentDisputesService({ db: faultyDb } as never, realtime as never).resolve(users.admin.id, payment.id, { outcome: "complete", reason, expectedMismatchCount: 3 })).rejects.toThrow(`Synthetic ${failure} failure`);
    expect((await db.workAssignment.findUniqueOrThrow({ where: { id: payment.workAssignmentId } })).status).toBe("disputed");
    expect((await db.paymentVerification.findUniqueOrThrow({ where: { id: payment.id } })).status).toBe("mismatch");
    expect(await db.workAssignmentEvent.count({ where: { workAssignmentId: payment.workAssignmentId } })).toBe(0);
    expect(await db.adminActionLog.count({ where: { metadata: { path: ["paymentVerificationId"], equals: payment.id } } })).toBe(0);
    expect(realtime.emitNotificationCreated).not.toHaveBeenCalled();
  });
  it.each(["audit", "notification"])("rolls back moderation status, sessions and notices when %s persistence fails", async (failure) => {
    const session = await login("freelancer"); const sid = new JwtService().decode(session.accessToken).sid;
    const notificationCount = await db.notification.count({ where: { userId: users.client.id } });
    realtime.disconnectUser.mockClear();
    const faultyDb = { user: db.user, $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction((tx) => fn(new Proxy(tx, {
      get(target, key) { return key === (failure === "audit" ? "adminActionLog" : "notification") ? { create: async () => { throw Error("Synthetic moderation persistence failure"); } } : Reflect.get(target, key); },
    }))) };
    await expect(new AdminService({ db: faultyDb } as never, realtime as never).setBlocked(users.freelancer.id, true, users.admin.id)).rejects.toThrow("Synthetic moderation persistence failure");
    expect((await db.user.findUniqueOrThrow({ where: { id: users.freelancer.id } })).status).toBe("active");
    expect((await db.authSession.findUniqueOrThrow({ where: { id: sid } })).revokedAt).toBeNull();
    expect(await db.notification.count({ where: { userId: users.client.id } })).toBe(notificationCount);
    expect(realtime.disconnectUser).not.toHaveBeenCalled();
  });
});
