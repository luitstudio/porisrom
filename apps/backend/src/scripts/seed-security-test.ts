import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { createPrismaClient } from "@porisrom/database";
import { ensureSecurityUsers } from "../testing/security-fixture";

async function main() {
  const statePath = process.env.PORISROM_SECURITY_TEST_STATE_PATH;
  if (!statePath) throw Error("Explicit isolated test state is required");
  const db = createPrismaClient();
  try {
    const state = JSON.parse(await readFile(statePath, "utf8"));
    if (process.env.DATABASE_URL !== state.url) throw Error("Test state does not match database target");
    const namespace = state.browserNamespace ?? `security-browser-${randomUUID()}`;
    const users = await ensureSecurityUsers(db, namespace, process.env.DATABASE_URL);
    await db.freelancerProfile.upsert({ where: { userId: users.freelancer.id }, create: { userId: users.freelancer.id, verificationStatus: "approved" }, update: {} });
    await db.companyProfile.upsert({ where: { userId: users.client.id }, create: { userId: users.client.id, companyName: "Synthetic Test Company", verificationStatus: "approved" }, update: {} });
    const connection = await db.connection.upsert({ where: { requesterId_receiverId: { requesterId: users.client.id, receiverId: users.freelancer.id } },
      create: { requesterId: users.client.id, receiverId: users.freelancer.id, status: "accepted" }, update: {} });
    const conversation = await db.conversation.upsert({ where: { connectionId: connection.id }, create: { connectionId: connection.id }, update: {} });
    const payments = [];
    for (const outcome of ["complete", "reopen"] as const) {
      const assignmentId = `${namespace}-${outcome}`;
      const assignment = await db.workAssignment.upsert({ where: { id: assignmentId }, create: { id: assignmentId,
        conversationId: conversation.id, createdById: users.client.id, title: `Synthetic ${outcome} dispute`, description: "Synthetic browser verification only",
        budgetAmount: 100, status: "disputed" }, update: {} });
      const payment = await db.paymentVerification.upsert({ where: { workAssignmentId: assignment.id }, create: { workAssignmentId: assignment.id, status: "mismatch", mismatchCount: 3 }, update: {} });
      payments.push({ id: payment.id, outcome });
    }
    await writeFile(statePath, JSON.stringify({ ...state, browserNamespace: namespace, browserUsers: users, browserConversationId: conversation.id, browserPayments: payments }), { mode: 0o600 });
    console.log("Synthetic administrator, ordinary participants, and dispute fixtures are ready in the isolated test database. No credentials printed.");
  } finally { await db.$disconnect(); }
}
void main().catch(() => { console.error("Isolated security fixture setup failed"); process.exitCode = 1; });
