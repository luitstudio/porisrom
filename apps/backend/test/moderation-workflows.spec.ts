import { describe, expect, it, vi } from "vitest";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";
import { ReviewsService } from "../src/reviews/reviews.service";
import { ConversationsService } from "../src/conversations/conversations.service";

function fixture(status: string, assignmentStatus = "accepted", actor = "client") {
  const connection = { requesterId: "client", receiverId: "freelancer" };
  const assignment = { id: "assignment", conversationId: "conversation", createdById: "client", status: assignmentStatus,
    cancelRequestedById: null as string | null, conversation: { connection }, paymentVerification: null };
  const write = vi.fn();
  const tx = {
    userBlock: { findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: {
      findMany: vi.fn().mockResolvedValue([{ role: "client", status: actor === "freelancer" ? status : "active" }, { role: "freelancer", status: actor === "client" ? status : "active" }]),
      findUnique: vi.fn().mockResolvedValue({ role: actor }),
    },
    workAssignment: { findUnique: vi.fn().mockResolvedValue(assignment), update: write, create: write },
    deliverable: { create: write }, workAssignmentEvent: { create: write },
    paymentVerification: { update: write, upsert: write, findUnique: vi.fn().mockResolvedValue({ id: "payment", clientUtr: "synthetic-client", freelancerUtr: "synthetic-other" }) },
    review: { create: write }, notification: { create: write },
    conversation: { findUnique: vi.fn().mockResolvedValue({ connection }) },
    message: { findMany: vi.fn().mockResolvedValue([{ id: "historical-message", body: "Historical" }]) },
  };
  const db = { ...tx, $transaction: <T>(fn: (client: typeof tx) => T) => fn(tx) };
  return { tx, db, assignment, write, service: new WorkAssignmentsService({ db } as never) };
}

describe.each(["blocked", "deleted"])("read-only work with a %s counterpart", (status) => {
  const cases = [
    ["propose", "accepted", "client", (s: WorkAssignmentsService) => s.create("client", "conversation", { title: "Synthetic", description: "Synthetic", budgetAmount: 10 })],
    ["accept proposal", "proposed", "freelancer", (s: WorkAssignmentsService) => s.respond("freelancer", "assignment", { action: "accept" })],
    ["reject proposal", "proposed", "freelancer", (s: WorkAssignmentsService) => s.respond("freelancer", "assignment", { action: "reject" })],
    ["request modification", "proposed", "freelancer", (s: WorkAssignmentsService) => s.respond("freelancer", "assignment", { action: "request_modification" })],
    ["revise", "modification_requested", "client", (s: WorkAssignmentsService) => s.revise("client", "assignment", { action: "revise", title: "Synthetic" })],
    ["reject revision", "modification_requested", "client", (s: WorkAssignmentsService) => s.revise("client", "assignment", { action: "reject" })],
    ["request cancellation", "accepted", "client", (s: WorkAssignmentsService) => s.cancel("client", "assignment")],
    ["submit delivery", "accepted", "freelancer", (s: WorkAssignmentsService) => s.submitDeliverable("freelancer", "assignment", { type: "github_link", url: "https://example.test/synthetic" })],
    ["accept delivery", "submitted", "client", (s: WorkAssignmentsService) => s.acceptDelivery("client", "assignment")],
    ["request delivery revision", "submitted", "client", (s: WorkAssignmentsService) => s.requestDeliveryRevision("client", "assignment", "Synthetic")],
    ["claim paid", "payment_pending", "client", (s: WorkAssignmentsService) => s.claimPaid("client", "assignment", { utr: "synthetic" })],
    ["claim received", "payment_pending", "freelancer", (s: WorkAssignmentsService) => s.claimReceived("freelancer", "assignment", { utr: "synthetic" })],
  ] as const;
  it.each(cases)("denies %s without events, notifications, or writes", async (_name, assignmentStatus, actor, action) => {
    const h = fixture(status, assignmentStatus, actor);
    await expect(action(h.service)).rejects.toMatchObject({ status: 403 });
    expect(h.write).not.toHaveBeenCalled();
    expect(h.tx.$queryRaw).toHaveBeenCalled();
    expect(h.assignment.status).toBe(assignmentStatus);
  });
  it("also denies confirming a cancellation", async () => {
    const h = fixture(status); h.assignment.cancelRequestedById = "freelancer";
    await expect(h.service.cancel("client", "assignment")).rejects.toMatchObject({ status: 403 });
    expect(h.write).not.toHaveBeenCalled();
  });
  it("denies a new review without deleting historical reviews", async () => {
    const h = fixture(status, "completed");
    await expect(new ReviewsService({ db: h.db } as never).create("client", "assignment", { rating: 5 })).rejects.toMatchObject({ status: 403 });
    expect(h.write).not.toHaveBeenCalled();
  });
  it("preserves participant message, assignment, and redacted payment reads", async () => {
    const h = fixture(status);
    const conversations = new ConversationsService({ db: h.db } as never, {} as never);
    expect(await conversations.access("client", "conversation")).toEqual({ readOnly: true });
    expect(await conversations.listMessages("client", "conversation")).toEqual([{ id: "historical-message", body: "Historical" }]);
    expect(await h.service.findOneForParticipant("client", "assignment")).toMatchObject({ id: "assignment", status: "accepted" });
    expect(await h.service.getPayment("client", "assignment")).toMatchObject({ clientUtr: "synthetic-client" });
    expect(await h.service.getPayment("client", "assignment")).not.toHaveProperty("freelancerUtr");
    await expect(conversations.listMessages("stranger", "conversation")).rejects.toMatchObject({ status: 403 });
    await expect(h.service.findOneForParticipant("stranger", "assignment")).rejects.toMatchObject({ status: 403 });
    expect(h.write).not.toHaveBeenCalled();
  });
});

it("keeps active marketplace access writable without requiring a new profile approval", async () => {
  const h = fixture("active");
  const service = new ConversationsService({ db: h.db } as never, {} as never);
  expect(await service.access("client", "conversation")).toEqual({ readOnly: false });
});
