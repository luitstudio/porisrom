import { GUARDS_METADATA } from "@nestjs/common/constants";
import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdminController } from "../src/admin/admin.controller";
import { AdminService } from "../src/admin/admin.service";
import { JwtAuthGuard } from "../src/auth/guards/jwt-auth.guard";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { ROLES_KEY } from "../src/auth/decorators/roles.decorator";
import type { PrismaService } from "../src/prisma/prisma.service";

function makeService(user: unknown) {
  const findUnique = vi.fn().mockResolvedValue(user);
  return {
    service: new AdminService({ db: { user: { findUnique } } } as unknown as PrismaService),
    findUnique,
  };
}

describe("admin profile moderation detail", () => {
  it("requires the existing admin authentication guards", () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, AdminController) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual(["admin"]);
  });

  it("returns a pending freelancer profile without sensitive account fields", async () => {
    const persisted = {
      id: "user-1", name: "Demo Freelancer", role: "freelancer", status: "active", isOnboarded: true,
      freelancerProfile: {
        id: "fp-1", bio: "Profile bio", address: "Demo address", state: "Assam", district: "Kamrup Metropolitan",
        experienceLevel: "1-2 years", verificationStatus: "pending", isBadgeVerified: false,
        categories: [{ category: { id: "cat-1", name: "Web Development", slug: "web-development" } }],
        skills: [{ skill: { id: "skill-1", name: "React" } }],
        portfolioItems: [{ id: "item-1", title: "Demo", type: "link", url: "https://example.test" }],
      },
      companyProfile: null,
    };
    const { service, findUnique } = makeService(persisted);
    const result = await service.getProfileForReview("user-1");

    expect(result.profile.verificationStatus).toBe("pending");
    expect(result).not.toHaveProperty("passwordHash");
    expect(result).not.toHaveProperty("email");
    const select = findUnique.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty("passwordHash");
    expect(select).not.toHaveProperty("email");
  });

  it("returns a pending company profile without sensitive account fields", async () => {
    const persisted = {
      id: "user-2", name: "Demo Client", role: "client", status: "active", isOnboarded: true,
      freelancerProfile: null,
      companyProfile: {
        id: "cp-1", companyName: "Demo Company", about: "Description", address: "Demo address", state: "Assam",
        logoUrl: null, verificationStatus: "pending", isBadgeVerified: false,
        categories: [{ category: { id: "cat-1", name: "Web Development", slug: "web-development" } }],
      },
    };
    const { service, findUnique } = makeService(persisted);
    const result = await service.getProfileForReview("user-2");

    expect(result.profile.verificationStatus).toBe("pending");
    expect(result).not.toHaveProperty("passwordHash");
    const select = findUnique.mock.calls[0]?.[0]?.select;
    expect(select).not.toHaveProperty("passwordHash");
    expect(select).not.toHaveProperty("email");
  });

  it("rejects a user without a reviewable profile", async () => {
    await expect(makeService({ id: "admin-1", role: "admin" }).service.getProfileForReview("admin-1"))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});

describe("existing approve and reject behavior", () => {
  it.each(["approved", "rejected"] as const)("sets freelancer status to %s", async (status) => {
    const update = vi.fn().mockResolvedValue({ verificationStatus: status });
    const service = new AdminService({ db: {
      user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", role: "freelancer" }) },
      freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "fp-1" }), update },
    } } as unknown as PrismaService);

    const result = status === "approved" ? await service.approveProfile("user-1") : await service.rejectProfile("user-1");
    expect(update).toHaveBeenCalledWith({ where: { userId: "user-1" }, data: { verificationStatus: status } });
    expect(result).toEqual({ verificationStatus: status });
  });
});
