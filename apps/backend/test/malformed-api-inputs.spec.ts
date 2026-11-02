import { BadRequestException } from "@nestjs/common";
import { plainToInstance, type ClassConstructor } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it, vi } from "vitest";

import { ListUsersQueryDto } from "../src/admin/dto/list-users-query.dto";
import { LeaderboardQueryDto } from "../src/leaderboard/dto/leaderboard-query.dto";
import { CompanyProfileService } from "../src/profiles/company-profile.service";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { SearchCompaniesDto } from "../src/search/dto/search-companies.dto";
import { SearchFreelancersDto } from "../src/search/dto/search-freelancers.dto";

function prismaService(db: object) {
  return { db } as unknown as PrismaService;
}

const profilePhotos = { uploadPublicPhoto: vi.fn() };

const malformedNumericQueries: Array<[ClassConstructor<object>, Record<string, string>]> = [
  [SearchCompaniesDto, { minRating: "abc" }],
  [SearchFreelancersDto, { minRating: "abc" }],
  [SearchCompaniesDto, { page: "abc" }],
  [SearchFreelancersDto, { pageSize: "abc" }],
  [LeaderboardQueryDto, { minRatingCount: "abc" }],
];

describe("malformed API input validation", () => {
  it("rejects invalid admin role filters before Prisma enum casting", async () => {
    const invalid = plainToInstance(ListUsersQueryDto, { role: "superadmin" });
    const valid = plainToInstance(ListUsersQueryDto, { role: "client" });

    await expect(validate(invalid)).resolves.toHaveLength(1);
    await expect(validate(valid)).resolves.toHaveLength(0);
  });

  it.each(malformedNumericQueries)("rejects malformed numeric search query values for %s", async (Dto, query) => {
    const dto = plainToInstance(Dto, query);

    await expect(validate(dto)).resolves.not.toHaveLength(0);
  });

  it("rejects invalid company category IDs before relation writes", async () => {
    const tx = {
      category: { count: vi.fn().mockResolvedValue(0) },
      companyProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      companyCategory: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      user: { update: vi.fn() },
    };
    const service = new CompanyProfileService(
      prismaService({ $transaction: vi.fn((callback) => callback(tx)) }),
      profilePhotos as never,
    );

    await expect(service.upsertOwn("client-1", {
      companyName: "Company",
      categoryIds: ["missing-category"],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.companyProfile.upsert).not.toHaveBeenCalled();
    expect(tx.companyCategory.deleteMany).not.toHaveBeenCalled();
    expect(tx.companyCategory.createMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("rejects invalid freelancer category IDs before relation writes", async () => {
    const tx = {
      category: { count: vi.fn().mockResolvedValue(0) },
      skill: { count: vi.fn().mockResolvedValue(1) },
      freelancerProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      freelancerCategory: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      freelancerSkill: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      user: { update: vi.fn() },
    };
    const service = new FreelancerProfileService(
      prismaService({ $transaction: vi.fn((callback) => callback(tx)) }),
      profilePhotos as never,
    );

    await expect(service.upsertOwn("freelancer-1", {
      bio: "Bio",
      categoryIds: ["missing-category"],
      skillIds: ["skill-1"],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.freelancerProfile.upsert).not.toHaveBeenCalled();
    expect(tx.freelancerCategory.deleteMany).not.toHaveBeenCalled();
    expect(tx.freelancerSkill.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });

  it("rejects invalid freelancer skill IDs before relation writes", async () => {
    const tx = {
      category: { count: vi.fn().mockResolvedValue(1) },
      skill: { count: vi.fn().mockResolvedValue(0) },
      freelancerProfile: {
        findUnique: vi.fn().mockResolvedValue(null),
        upsert: vi.fn(),
      },
      freelancerCategory: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      freelancerSkill: {
        deleteMany: vi.fn(),
        createMany: vi.fn(),
      },
      user: { update: vi.fn() },
    };
    const service = new FreelancerProfileService(
      prismaService({ $transaction: vi.fn((callback) => callback(tx)) }),
      profilePhotos as never,
    );

    await expect(service.upsertOwn("freelancer-1", {
      bio: "Bio",
      categoryIds: ["category-1"],
      skillIds: ["missing-skill"],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.freelancerProfile.upsert).not.toHaveBeenCalled();
    expect(tx.freelancerCategory.deleteMany).not.toHaveBeenCalled();
    expect(tx.freelancerSkill.deleteMany).not.toHaveBeenCalled();
    expect(tx.user.update).not.toHaveBeenCalled();
  });
});
