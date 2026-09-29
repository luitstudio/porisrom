import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../src/prisma/prisma.service";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";

describe("financial history", () => {
  it("scopes the query to the caller and returns only the freelancer UTR", async () => {
    const findMany = vi.fn().mockResolvedValue([{
      id: "assignment-1", title: "Landing page", budgetAmount: { toString: () => "1200", valueOf: () => 1200 }, currency: "INR", status: "completed", createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-02"), createdById: "client-1",
      deliverables: [{ submittedAt: new Date("2026-01-01") }],
      conversation: { connection: { requester: { id: "client-1", name: "Client" }, receiver: { id: "freelancer-1", name: "Freelancer" } } },
      paymentVerification: { id: "payment-1", workAssignmentId: "assignment-1", status: "verified", mismatchCount: 0, verifiedAt: new Date("2026-01-02"), clientUtr: "client-private", clientClaimedAt: new Date(), freelancerUtr: "visible-to-freelancer", freelancerClaimedAt: new Date() },
    }]);
    const prisma = { db: { user: { findUnique: vi.fn().mockResolvedValue({ role: "freelancer" }) }, workAssignment: { findMany } } } as unknown as PrismaService;
    const result = await new WorkAssignmentsService(prisma).financialHistory("freelancer-1");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ conversation: expect.any(Object) }) }));
    expect(result.summary.verifiedAmount).toBe(1200);
    expect(result.history[0].payment).toMatchObject({ freelancerUtr: "visible-to-freelancer" });
    expect(result.history[0].payment).not.toHaveProperty("clientUtr");
  });

  it("rejects users without a marketplace role", async () => {
    const prisma = { db: { user: { findUnique: vi.fn().mockResolvedValue({ role: "admin" }) } } } as unknown as PrismaService;
    await expect(new WorkAssignmentsService(prisma).financialHistory("admin-1")).rejects.toThrow("Only marketplace participants");
  });
});
