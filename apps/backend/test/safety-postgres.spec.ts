import "reflect-metadata";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { PrismaClient } from "@porisrom/database";
import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import { ensureSecurityUsers } from "../src/testing/security-fixture";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";
import { SearchService } from "../src/search/search.service";
import { ConnectionsService } from "../src/connections/connections.service";
import { SafetyService } from "../src/safety/safety.service";
import { ConversationsService } from "../src/conversations/conversations.service";

const testUrl = process.env.PORISROM_SAFETY_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("isolated PostgreSQL participant safety", () => {
  let db: PrismaClient; let users: Awaited<ReturnType<typeof ensureSecurityUsers>>;
  let safety: SafetyService; let conversations: ConversationsService; let conversationId: string; let connectionId: string;
  const namespace = `security-safety-${randomUUID()}`;
  const realtime = { emitMessageCreated: vi.fn(), emitNotificationCreated: vi.fn(), emitWorkAssignmentUpdated: vi.fn() };
  beforeAll(async () => {
    const { PrismaPg } = createRequire(resolve(process.cwd(), "../../packages/database/package.json"))("@prisma/adapter-pg");
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    users = await ensureSecurityUsers(db, namespace, testUrl);
    connectionId = (await db.connection.create({ data: { requesterId: users.client.id, receiverId: users.freelancer.id, status: "accepted" } })).id;
    conversationId = (await db.conversation.create({ data: { connectionId } })).id;
    await db.freelancerProfile.create({ data: { userId: users.freelancer.id, verificationStatus: "approved" } });
    await db.companyProfile.create({ data: { userId: users.client.id, companyName: namespace, verificationStatus: "approved" } });
    safety = new SafetyService({ db } as never, realtime as never);
    conversations = new ConversationsService({ db } as never, realtime as never);
  });
  afterAll(async () => {
    if (!db) return;
    try {
      if (users) {
        const ids = Object.values(users).map((u) => u.id);
        await db.safetyCaseEvent.deleteMany({ where: { case: { reporterId: { in: ids } } } });
        await db.safetyCase.deleteMany({ where: { reporterId: { in: ids } } });
        await db.adminActionLog.deleteMany({ where: { adminId: users.admin.id } });
        await db.paymentClaim.deleteMany({ where: { paymentVerification: { workAssignment: { conversationId } } } });
        await db.paymentVerification.deleteMany({ where: { workAssignment: { conversationId } } });
        await db.workAssignmentEvent.deleteMany({ where: { workAssignment: { conversationId } } });
        await db.workAssignment.deleteMany({ where: { conversationId } });
        await db.portfolioItem.deleteMany({ where: { freelancerProfile: { userId: users.freelancer.id } } });
        await db.freelancerProfile.deleteMany({ where: { userId: users.freelancer.id } });
        await db.companyProfile.deleteMany({ where: { userId: users.client.id } });
        await db.userBlock.deleteMany({ where: { blockerId: { in: ids } } });
        await db.notification.deleteMany({ where: { userId: { in: ids } } });
        if (conversationId) { await db.message.deleteMany({ where: { conversationId } }); await db.conversation.deleteMany({ where: { id: conversationId } }); await db.connection.deleteMany({ where: { id: connectionId } }); }
        await db.user.deleteMany({ where: { id: { in: ids } } });
      }
    } finally { await db.$disconnect(); }
  });
  it("freezes an established conversation after either participant blocks the other", async () => {
    await safety.block(users.client.id, users.freelancer.id);
    await expect(conversations.sendMessage(users.freelancer.id, conversationId, "Must be denied")).rejects.toMatchObject({ status: 403 });
    expect(await db.message.count({ where: { conversationId } })).toBe(0);
  });
  const reason = "Synthetic safety request for regression verification.";
  const service = () => new WorkAssignmentsService({ db } as never, realtime as never);
  const makeAssignment = () => db.workAssignment.create({ data: { conversationId, createdById: users.client.id,
    title: "Synthetic cancellation", description: reason, budgetAmount: 100, status: "accepted" } });
  it("makes concurrent duplicate block requests idempotent", async () => {
    const results = await Promise.all(Array.from({ length: 4 }, () => safety.block(users.client.id, users.freelancer.id)));
    expect(new Set(results.map((r) => r.id)).size).toBe(1);
    expect(await db.userBlock.count({ where: { blockerId: users.client.id, unblockedAt: null } })).toBe(1);
  });
  it("rejects self-block, self-report, and blocking administrators", async () => {
    await expect(safety.block(users.client.id, users.client.id)).rejects.toMatchObject({ status: 400 });
    await expect(safety.report(users.client.id, { targetUserId: users.client.id, category: "other", reason })).rejects.toMatchObject({ status: 400 });
    await expect(safety.block(users.client.id, users.admin.id)).rejects.toMatchObject({ status: 403 });
  });
  it("hides blocked counterparts in both discovery directions using the same item/count filters", async () => {
    const search = new SearchService({ db } as never);
    const free = await search.searchFreelancers({ keyword: "Synthetic", pageSize: 100 }, users.client.id);
    const companies = await search.searchCompanies({ keyword: namespace, pageSize: 100 }, users.freelancer.id);
    expect(free.items.some((p) => p.id === users.freelancer.id)).toBe(false);
    expect(companies.items).toHaveLength(0); expect(companies.total).toBe(0);
    const profile = await db.freelancerProfile.findUniqueOrThrow({ where: { userId: users.freelancer.id } });
    expect(free.items.some((p) => p.id === profile.id)).toBe(false);
  });
  it("keeps established history readable and denies alternate connection paths", async () => {
    expect(await conversations.access(users.client.id, conversationId)).toEqual({ readOnly: true });
    expect(await conversations.listMessages(users.freelancer.id, conversationId)).toEqual([]);
    await expect(new ConnectionsService({ db } as never).create(users.freelancer.id, users.client.id)).rejects.toMatchObject({ status: 403 });
    expect(await db.conversation.count({ where: { id: conversationId } })).toBe(1);
  });
  it("denies assignment mutation, delivery, and payment while preserving evidence", async () => {
    const assignment = await makeAssignment();
    await expect(service().cancel(users.client.id, assignment.id, reason)).rejects.toMatchObject({ status: 403 });
    await expect(service().submitDeliverable(users.freelancer.id, assignment.id, { type: "github_link", url: "https://example.test/synthetic" })).rejects.toMatchObject({ status: 403 });
    await db.workAssignment.update({ where: { id: assignment.id }, data: { status: "payment_pending" } });
    await expect(service().claimPaid(users.client.id, assignment.id, { utr: "SYNTHETIC-ONLY" })).rejects.toMatchObject({ status: 403 });
    expect(await db.paymentClaim.count({ where: { paymentVerification: { workAssignmentId: assignment.id } } })).toBe(0);
    expect((await service().findOneForParticipant(users.client.id, assignment.id))?.id).toBe(assignment.id);
  });
  it("allows frozen-work escalation and concurrent admin decisions have exactly one winner", async () => {
    const assignment = await makeAssignment();
    const cases = await Promise.all([safety.escalate(users.client.id, assignment.id, reason), safety.escalate(users.freelancer.id, assignment.id, reason)]);
    expect(cases[0].id).toBe(cases[1].id);
    expect((await db.workAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe("accepted");
    const decisions = await Promise.allSettled(["cancel_assignment", "deny_cancellation"].map((decision) => safety.review(users.admin.id, cases[0].id,
      { decision: decision as "cancel_assignment" | "deny_cancellation", reason })));
    expect(decisions.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter((r) => r.status === "rejected")).toHaveLength(1);
    expect(await db.adminActionLog.count({ where: { adminId: users.admin.id } })).toBe(1);
    expect(await db.paymentVerification.count({ where: { workAssignmentId: assignment.id } })).toBe(0);
  });
  it("preserves unblock history and never revives unrelated account restrictions", async () => {
    const block = (await safety.listBlocks(users.client.id))[0];
    await expect(safety.unblock(users.freelancer.id, block.id)).rejects.toMatchObject({ status: 403 });
    await db.user.update({ where: { id: users.freelancer.id }, data: { status: "blocked" } });
    await safety.unblock(users.client.id, block.id);
    expect(await conversations.access(users.client.id, conversationId)).toEqual({ readOnly: true });
    expect(await db.userBlock.count({ where: { id: block.id, unblockedAt: { not: null } } })).toBe(1);
    await db.user.update({ where: { id: users.freelancer.id }, data: { status: "active" } });
    expect(await conversations.access(users.client.id, conversationId)).toEqual({ readOnly: false });
    await conversations.sendMessage(users.client.id, conversationId, "Historical message retained");
    expect(await db.message.count({ where: { conversationId } })).toBe(1);
  });
  it("requires cancellation reason and permits rejection then escalation and audited confirmation", async () => {
    const assignment = await makeAssignment();
    await expect(service().cancel(users.client.id, assignment.id)).rejects.toMatchObject({ status: 400 });
    await service().cancel(users.client.id, assignment.id, reason);
    await expect(service().rejectCancellation(users.client.id, assignment.id, reason)).rejects.toMatchObject({ status: 409 });
    await service().rejectCancellation(users.freelancer.id, assignment.id, reason);
    const row = await safety.escalate(users.client.id, assignment.id, reason);
    await safety.review(users.admin.id, row.id, { decision: "cancel_assignment", reason });
    expect((await db.workAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe("cancelled");
    expect(await db.workAssignmentEvent.count({ where: { workAssignmentId: assignment.id, action: "cancel_rejected" } })).toBe(1);
  });
  it("allows explicit admin denial without changing assignment state or financial evidence", async () => {
    const assignment = await makeAssignment();
    await service().cancel(users.client.id, assignment.id, reason);
    const payment = await db.paymentVerification.create({ data: { workAssignmentId: assignment.id, status: "awaiting_client", clientUtr: "SYNTHETIC-PRESERVE" } });
    const row = await safety.escalate(users.freelancer.id, assignment.id, reason);
    await safety.review(users.admin.id, row.id, { decision: "deny_cancellation", reason });
    expect(await db.workAssignment.findUnique({ where: { id: assignment.id } })).toMatchObject({ status: "accepted", cancelRequestedById: null });
    expect(await db.paymentVerification.findUnique({ where: { id: payment.id } })).toMatchObject({ clientUtr: "SYNTHETIC-PRESERVE" });
  });
  it("rejects new cancellation escalation for a payment dispute", async () => {
    const assignment = await makeAssignment();
    await db.workAssignment.update({ where: { id: assignment.id }, data: { status: "disputed", cancelRequestedById: users.client.id } });
    await expect(safety.escalate(users.client.id, assignment.id, reason)).rejects.toMatchObject({ status: 409 });
    await expect(service().cancel(users.freelancer.id, assignment.id, reason)).rejects.toMatchObject({ status: 409 });
    expect((await db.workAssignment.findUniqueOrThrow({ where: { id: assignment.id } })).status).toBe("disputed");
  });
  it("persists duplicate reports once and keeps reporter context away from the target", async () => {
    const payload = { targetUserId: users.freelancer.id, category: "harassment" as const, reason, conversationId };
    const before = await db.notification.count({ where: { userId: users.freelancer.id } });
    const results = await Promise.all([safety.report(users.client.id, payload), safety.report(users.client.id, payload)]);
    expect(results[0]).toEqual(results[1]); expect(Object.keys(results[0]).sort()).toEqual(["id", "status"]);
    expect((await safety.listMine(users.freelancer.id)).some((r) => r.id === results[0].id)).toBe(false);
    expect((await safety.listMine(users.client.id)).some((r) => r.id === results[0].id)).toBe(false);
    expect(await db.notification.count({ where: { userId: users.freelancer.id } })).toBe(before);
    await safety.review(users.admin.id, results[0].id, { decision: "resolve", reason });
    expect(await db.notification.count({ where: { userId: users.freelancer.id } })).toBe(before);
    expect((await safety.detailAdmin(results[0].id)).reason).toBe(reason);
  });
  it("denies fabricated report context and non-admin review", async () => {
    await expect(safety.report(users.client.id, { targetUserId: users.freelancer.id, category: "other", reason, conversationId: "not-owned" })).rejects.toMatchObject({ status: 403 });
    const row = await safety.support(users.client.id, { category: "technical", reason });
    await expect(safety.review(users.freelancer.id, row.id, { decision: "resolve", reason })).rejects.toMatchObject({ status: 403 });
    expect((await safety.detailAdmin(row.id)).status).toBe("open");
  });
  it("keeps support history private to the owner and does not perform credential recovery", async () => {
    const before = await db.user.findUniqueOrThrow({ where: { id: users.client.id } });
    const row = await safety.support(users.client.id, { category: "account", reason });
    expect((await safety.listMine(users.freelancer.id)).some((r) => r.id === row.id)).toBe(false);
    await safety.review(users.admin.id, row.id, { decision: "resolve", reason: "Use the approved identity-check process for credential recovery." });
    expect((await safety.listMine(users.client.id)).find((r) => r.id === row.id)?.events).toHaveLength(2);
    expect((await db.user.findUniqueOrThrow({ where: { id: users.client.id } })).passwordHash).toBe(before.passwordHash);
  });
  it("rolls back a case decision and notices when the durable audit insert fails", async () => {
    const row = await safety.support(users.client.id, { category: "privacy", reason });
    const failing = db.$extends({ query: { adminActionLog: { create() { throw new Error("Synthetic audit failure"); } } } });
    const restricted = new SafetyService({ db: failing } as never, realtime as never);
    const count = await db.notification.count({ where: { userId: users.client.id } });
    await expect(restricted.review(users.admin.id, row.id, { decision: "resolve", reason })).rejects.toThrow("Synthetic audit failure");
    expect((await safety.detailAdmin(row.id)).status).toBe("open");
    expect(await db.notification.count({ where: { userId: users.client.id } })).toBe(count);
  });
  it("deduplicates concurrent onboarding portfolio retries under a database lock", async () => {
    const profiles = new FreelancerProfileService({ db } as never, {} as never);
    const payload = { title: "Synthetic work", type: "link" as const, url: "https://example.test/synthetic-portfolio" };
    const rows = await Promise.all([profiles.addPortfolioItem(users.freelancer.id, payload), profiles.addPortfolioItem(users.freelancer.id, payload)]);
    expect(rows[0].id).toBe(rows[1].id);
    expect(await db.portfolioItem.count({ where: { freelancerProfile: { userId: users.freelancer.id } } })).toBe(1);
  });
  it("enforces the persisted daily case quota under concurrent requests", async () => {
    const count = await db.safetyCase.count({ where: { reporterId: users.client.id } });
    for (let n = count; n < 9; n++) await safety.support(users.client.id, { category: "other", reason: `${reason} Seed ${n}` });
    const results = await Promise.allSettled([1, 2, 3].map((n) => safety.support(users.client.id, { category: "other", reason: `${reason} Concurrent ${n}` })));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((r) => r.status === "rejected")).toHaveLength(2);
    expect(await db.safetyCase.count({ where: { reporterId: users.client.id } })).toBe(10);
  });

});
