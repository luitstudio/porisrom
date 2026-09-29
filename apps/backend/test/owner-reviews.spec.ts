import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../src/prisma/prisma.service";
import { ReviewsService } from "../src/reviews/reviews.service";

describe("owner review history", () => {
  it("reads only client reviews addressed to the authenticated freelancer without requiring public approval", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const prisma = { db: { review: { findMany } } } as unknown as PrismaService;
    await new ReviewsService(prisma).listOwnForFreelancer("freelancer-1");
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { targetId: "freelancer-1", direction: "client_to_freelancer" },
      orderBy: { createdAt: "desc" },
    }));
  });
});
