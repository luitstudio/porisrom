import { describe, expect, it, vi } from "vitest";

import { CompanyProfileService } from "../src/profiles/company-profile.service";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { ReviewsService } from "../src/reviews/reviews.service";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";

function transactionalPrisma<T extends object>(tx: T) {
  return {
    db: {
      $transaction: vi.fn((callback: (client: T) => unknown) => callback(tx)),
    },
  } as unknown as PrismaService;
}

describe("transaction regressions", () => {
  it("uses one transaction client for freelancer onboarding writes", async () => {
    const tx = {
      freelancerProfile: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "profile-1" }),
        upsert: vi.fn().mockResolvedValue({ id: "profile-1" }),
      },
      freelancerCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
      freelancerSkill: { deleteMany: vi.fn(), createMany: vi.fn() },
      user: { update: vi.fn() },
    };
    const prisma = transactionalPrisma(tx);
    const service = new FreelancerProfileService(prisma);

    await service.upsertOwn("user-1", {
      categoryIds: ["category-1"],
      skillIds: ["skill-1"],
    });

    expect(prisma.db.$transaction).toHaveBeenCalledOnce();
    expect(tx.freelancerProfile.upsert).toHaveBeenCalledOnce();
    expect(tx.freelancerCategory.deleteMany).toHaveBeenCalledOnce();
    expect(tx.freelancerCategory.createMany).toHaveBeenCalledOnce();
    expect(tx.freelancerSkill.deleteMany).toHaveBeenCalledOnce();
    expect(tx.freelancerSkill.createMany).toHaveBeenCalledOnce();
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isOnboarded: true, profileCompleteness: 100 },
    });
  });

  it("uses one transaction client for company onboarding writes", async () => {
    const tx = {
      companyProfile: {
        findUnique: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "profile-1" }),
        upsert: vi.fn().mockResolvedValue({ id: "profile-1" }),
      },
      companyCategory: { deleteMany: vi.fn(), createMany: vi.fn() },
      user: { update: vi.fn() },
    };
    const prisma = transactionalPrisma(tx);
    const service = new CompanyProfileService(prisma);

    await service.upsertOwn("user-1", { companyName: "Company", categoryIds: ["category-1"] });

    expect(prisma.db.$transaction).toHaveBeenCalledOnce();
    expect(tx.companyProfile.upsert).toHaveBeenCalledOnce();
    expect(tx.companyCategory.deleteMany).toHaveBeenCalledOnce();
    expect(tx.companyCategory.createMany).toHaveBeenCalledOnce();
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { isOnboarded: true, profileCompleteness: 100 },
    });
  });

  it("creates a review and updates its rating aggregate on one transaction client", async () => {
    const tx = {
      workAssignment: {
        findUnique: vi.fn().mockResolvedValue({
          status: "completed",
          conversation: { connection: { requesterId: "client-1", receiverId: "freelancer-1" } },
        }),
      },
      user: { findUnique: vi.fn().mockResolvedValue({ role: "client" }) },
      review: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "review-1" }),
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 5 }, _count: { rating: 1 } }),
      },
      freelancerProfile: { updateMany: vi.fn() },
      companyProfile: { updateMany: vi.fn() },
    };
    const prisma = transactionalPrisma(tx);
    const service = new ReviewsService(prisma);

    await service.create("client-1", "assignment-1", { rating: 5 });

    expect(prisma.db.$transaction).toHaveBeenCalledOnce();
    expect(tx.review.create).toHaveBeenCalledOnce();
    expect(tx.review.aggregate).toHaveBeenCalledOnce();
    expect(tx.freelancerProfile.updateMany).toHaveBeenCalledOnce();
  });

  it("creates a work assignment and its initial event on one transaction client", async () => {
    const tx = {
      workAssignment: { create: vi.fn().mockResolvedValue({ id: "assignment-1" }) },
      workAssignmentEvent: { create: vi.fn() },
      notification: { create: vi.fn() },
    };
    const transaction = vi.fn((callback: (client: typeof tx) => unknown) => callback(tx));
    const prisma = {
      db: {
        $transaction: transaction,
        conversation: {
          findUnique: vi.fn().mockResolvedValue({
            connection: { requesterId: "client-1", receiverId: "freelancer-1" },
          }),
        },
        user: { findUnique: vi.fn().mockResolvedValue({ role: "client" }) },
        workAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    } as unknown as PrismaService;
    const service = new WorkAssignmentsService(prisma);

    await service.create("client-1", "conversation-1", {
      title: "Assignment",
      description: "Description",
      budgetAmount: 100,
    });

    expect(transaction).toHaveBeenCalledOnce();
    expect(tx.workAssignment.create).toHaveBeenCalledOnce();
    expect(tx.workAssignmentEvent.create).toHaveBeenCalledOnce();
  });
});
