import { describe, expect, it, vi } from "vitest";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";
import { activeMarketplaceFixture } from "./active-marketplace-fixture";

describe("assignment state serialization", () => {
  it("does not overwrite completion using a proposal snapshot read before the transaction", async () => {
    const snapshot = { id: "assignment", createdById: "client", status: "proposed", cancelRequestedById: null,
      conversation: { connection: { requesterId: "client", receiverId: "freelancer" } } };
    const write = vi.fn();
    const tx = { ...activeMarketplaceFixture(), workAssignment: { findUnique: vi.fn().mockResolvedValue({ status: "completed", cancelRequestedById: null }), update: write },
      workAssignmentEvent: { create: write }, notification: { create: write } };
    const db = { workAssignment: { findUnique: vi.fn().mockResolvedValueOnce(snapshot).mockResolvedValueOnce(null) },
      user: { findUnique: vi.fn().mockResolvedValue({ role: "freelancer" }) }, $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) };
    await expect(new WorkAssignmentsService({ db } as never).respond("freelancer", "assignment", { action: "accept" })).rejects.toMatchObject({ status: 409 });
    expect(write).not.toHaveBeenCalled();
  });
});
