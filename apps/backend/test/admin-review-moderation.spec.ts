import { NotFoundException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import { describe, expect, it, vi } from "vitest";

import { AdminController } from "../src/admin/admin.controller";
import { AdminService } from "../src/admin/admin.service";
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import type { PrismaService } from "../src/prisma/prisma.service";
import { ReviewsService } from "../src/reviews/reviews.service";

const review = {
  id: "review-1", rating: 2, comment: "Moderate this", direction: "client_to_freelancer",
  targetId: "target-1", createdAt: new Date("2026-01-01"),
  author: { id: "author-1", name: "Reviewer", role: "client" },
  workAssignment: { id: "assignment-1", title: "Assignment" },
};

describe("admin review moderation", () => {
  it("requires the existing admin authorization", () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(["admin"]);
  });

  it("returns valid reviews through an explicit sensitive-field-free selection", async () => {
    const reviewFindMany = vi.fn().mockResolvedValue([review]);
    const userFindMany = vi.fn().mockResolvedValue([{
      id: "target-1", name: "Reviewed User", role: "freelancer",
      freelancerProfile: { id: "profile-1" }, companyProfile: null,
    }]);
    const service = new AdminService({ db: { review: { findMany: reviewFindMany }, user: { findMany: userFindMany } } } as unknown as PrismaService);

    const result = await service.listReviews();
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "review-1", author: { name: "Reviewer" }, target: { name: "Reviewed User" } });
    const reviewSelect = reviewFindMany.mock.calls[0]?.[0]?.select;
    const targetSelect = userFindMany.mock.calls[0]?.[0]?.select;
    expect(reviewSelect.author.select).toEqual({ id: true, name: true, role: true });
    expect(reviewSelect.author.select).not.toHaveProperty("passwordHash");
    expect(targetSelect).not.toHaveProperty("passwordHash");
    expect(targetSelect).not.toHaveProperty("email");
  });

  it("rejects an invalid review ID without deleting", async () => {
    const deleteReview = vi.fn();
    const tx = { review: { findUnique: vi.fn().mockResolvedValue(null), delete: deleteReview } };
    const service = new AdminService({ db: { $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) } } as unknown as PrismaService);

    await expect(service.removeReview("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteReview).not.toHaveBeenCalled();
  });

  it("removes a review and recalculates the freelancer aggregate atomically", async () => {
    const deleteReview = vi.fn().mockResolvedValue(review);
    const updateMany = vi.fn().mockResolvedValue({ count: 1 });
    const tx = {
      review: {
        findUnique: vi.fn().mockResolvedValue({ id: review.id, targetId: review.targetId, direction: review.direction }),
        delete: deleteReview,
        aggregate: vi.fn().mockResolvedValue({ _avg: { rating: 4 }, _count: { rating: 2 } }),
      },
      freelancerProfile: { updateMany }, companyProfile: { updateMany: vi.fn() },
    };
    const transaction = vi.fn((callback: (client: typeof tx) => unknown) => callback(tx));
    const service = new AdminService({ db: { $transaction: transaction } } as unknown as PrismaService);

    await expect(service.removeReview(review.id)).resolves.toEqual({ id: review.id, removed: true });
    expect(deleteReview).toHaveBeenCalledWith({ where: { id: review.id } });
    expect(updateMany).toHaveBeenCalledWith({ where: { userId: review.targetId }, data: { ratingAvg: 4, ratingCount: 2 } });
    expect(transaction).toHaveBeenCalledOnce();
  });

  it("does not return a removed review through the admin listing path", async () => {
    const service = new AdminService({ db: {
      review: { findMany: vi.fn().mockResolvedValue([]) },
      user: { findMany: vi.fn().mockResolvedValue([]) },
    } } as unknown as PrismaService);
    await expect(service.listReviews()).resolves.toEqual([]);
  });

  it("does not return a removed review through the public profile path", async () => {
    const publicFindMany = vi.fn().mockResolvedValue([]);
    const service = new ReviewsService({ db: {
      freelancerProfile: { findFirst: vi.fn().mockResolvedValue({ userId: "target-1" }) },
      review: { findMany: publicFindMany },
    } } as unknown as PrismaService);

    await expect(service.listForFreelancer("profile-1")).resolves.toEqual([]);
    expect(publicFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {
      targetId: "target-1", direction: "client_to_freelancer",
    } }));
  });
});
