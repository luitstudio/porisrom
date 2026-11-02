import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { PrismaClient, type Prisma } from "@porisrom/database";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AdminService } from "../src/admin/admin.service";
import { ConversationsService } from "../src/conversations/conversations.service";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";
import { SearchService } from "../src/search/search.service";
import { LeaderboardService } from "../src/leaderboard/leaderboard.service";

// Explicit opt-in; never fall back to DATABASE_URL, provision schemas, or run migrations.
const testUrl = process.env.PORISROM_MODERATION_TEST_DATABASE_URL;
describe.skipIf(!testUrl)("isolated PostgreSQL moderation (requires PORISROM_MODERATION_TEST_DATABASE_URL)", () => {
  let db: PrismaClient;
  const prefix = `moderation-test-${randomUUID()}`;
  const clientId = `${prefix}-client`; const freelancerId = `${prefix}-freelancer`;
  const connectionId = `${prefix}-connection`; const conversationId = `${prefix}-conversation`; const assignmentId = `${prefix}-assignment`;
  let admin: AdminService; let conversations: ConversationsService; let assignments: WorkAssignmentsService;
  beforeAll(async () => {
    if (!decodeURIComponent(new URL(testUrl!).pathname).endsWith("_test")) throw new Error("Moderation tests require an explicitly supplied database name ending in _test");
    const { PrismaPg } = createRequire(resolve(process.cwd(), "../../packages/database/package.json"))("@prisma/adapter-pg");
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: testUrl }) });
    await db.$connect();
    for (const [id, role] of [[clientId, "client"], [freelancerId, "freelancer"], [`${prefix}-admin`, "admin"]] as const) await db.user.create({ data: {
      id, name: prefix, email: `${id}@example.test`, role, passwordHash: "synthetic-unusable-hash",
    } });
    await db.freelancerProfile.create({ data: { userId: freelancerId, verificationStatus: "approved", ratingCount: 5 } });
    await db.connection.create({ data: { id: connectionId, requesterId: clientId, receiverId: freelancerId, status: "accepted" } });
    await db.conversation.create({ data: { id: conversationId, connectionId } });
    await db.workAssignment.create({ data: { id: assignmentId, conversationId, createdById: clientId, title: "Synthetic", description: "Synthetic", budgetAmount: 10, status: "payment_pending" } });
    await db.paymentVerification.create({ data: { workAssignmentId: assignmentId } });
    admin = new AdminService({ db } as never);
    conversations = new ConversationsService({ db } as never, { emitMessageCreated: async () => {}, emitNotificationCreated: async () => {} } as never);
    assignments = new WorkAssignmentsService({ db } as never);
  });
  afterAll(async () => {
    if (!db) return;
    try {
      // Only this run's synthetic rows. Preserve every pre-existing row.
      await db.notification.deleteMany({ where: { userId: { in: [clientId, freelancerId] } } });
      await db.workAssignmentEvent.deleteMany({ where: { workAssignmentId: assignmentId } });
      await db.paymentClaim.deleteMany({ where: { paymentVerification: { workAssignmentId: assignmentId } } });
      await db.paymentVerification.deleteMany({ where: { workAssignmentId: assignmentId } });
      await db.workAssignment.deleteMany({ where: { id: assignmentId } });
      await db.message.deleteMany({ where: { conversationId } });
      await db.conversation.deleteMany({ where: { id: conversationId } });
      await db.connection.deleteMany({ where: { id: connectionId } });
      await db.freelancerProfile.deleteMany({ where: { userId: freelancerId } });
      await db.adminActionLog.deleteMany({ where: { adminId: `${prefix}-admin` } });
      await db.user.deleteMany({ where: { id: { in: [clientId, freelancerId, `${prefix}-admin`] } } });
    } finally { await db.$disconnect(); }
  });
  it("serializes a message against an uncommitted moderation status change", async () => {
    let locked!: () => void; let release!: () => void; let checking!: () => void;
    const hasLock = new Promise<void>((done) => { locked = done; });
    const continueCommit = new Promise<void>((done) => { release = done; });
    const reachedGuard = new Promise<void>((done) => { checking = done; });
    const racingConversations = new ConversationsService({ db: {
      conversation: db.conversation,
      $transaction: (fn: (tx: Prisma.TransactionClient) => Promise<unknown>) => db.$transaction((tx) => fn(new Proxy(tx, {
        get(target, key) {
          if (key === "$queryRaw") return (strings: TemplateStringsArray, ...values: unknown[]) => {
            checking(); return target.$queryRaw(strings, ...values);
          };
          return Reflect.get(target, key);
        },
      }))),
    } } as never, { emitMessageCreated: async () => {}, emitNotificationCreated: async () => {} } as never);
    const moderation = db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: freelancerId }, data: { status: "blocked" } });
      locked(); await continueCommit;
    });
    await hasLock;
    const message = racingConversations.sendMessage(clientId, conversationId, "Must never persist");
    // Attach a rejection handler immediately; release even if an assertion fails.
    const result = message.then(() => "allowed", (error: { status: number }) => error.status);
    try {
      await reachedGuard;
      expect(await db.message.count({ where: { conversationId } })).toBe(0);
      release(); await moderation; expect(await result).toBe(403);
    }
    finally { release(); await moderation; }
    expect(await db.message.count({ where: { conversationId } })).toBe(0);
  });
  it("freezes payments and preserves history, then allows work after unblocking", async () => {
    await admin.setBlocked(freelancerId, true, `${prefix}-admin`);
    await expect(assignments.claimPaid(clientId, assignmentId, { utr: "synthetic-reference" })).rejects.toMatchObject({ status: 403 });
    expect((await assignments.findOneForParticipant(clientId, assignmentId))?.status).toBe("payment_pending");
    expect(await db.paymentVerification.findUniqueOrThrow({ where: { workAssignmentId: assignmentId } })).toMatchObject({ clientUtr: null });
    await admin.setBlocked(freelancerId, false, `${prefix}-admin`);
    expect(await assignments.claimPaid(clientId, assignmentId, { utr: "synthetic-reference" })).toMatchObject({ clientUtr: "synthetic-reference" });
    await conversations.sendMessage(clientId, conversationId, "Historical synthetic message");
    await admin.softDeleteUser(freelancerId, `${prefix}-admin`);
    expect(await conversations.listMessages(clientId, conversationId)).toHaveLength(1);
    await expect(conversations.sendMessage(clientId, conversationId, "Denied")).rejects.toMatchObject({ status: 403 });
    expect(await db.workAssignmentEvent.count({ where: { workAssignmentId: assignmentId } })).toBe(1);
  });
  it("keeps database discovery counts and leaderboards consistent after moderation", async () => {
    const search = new SearchService({ db } as never);
    const result = await search.searchFreelancers({ keyword: prefix });
    expect(result.items).toHaveLength(0); expect(result.total).toBe(0);
    const leaderboard = await new LeaderboardService({ db } as never).listFreelancers();
    expect(leaderboard.some((row) => row.user.name === prefix)).toBe(false);
  });
});
