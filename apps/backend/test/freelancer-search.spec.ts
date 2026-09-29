import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../src/prisma/prisma.service";
import { SearchService } from "../src/search/search.service";

function createSearchService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const prisma = {
    db: { freelancerProfile: { findMany, count } },
  } as unknown as PrismaService;
  return { service: new SearchService(prisma), findMany, count };
}

function keywordWhere(keyword: string) {
  return expect.objectContaining({ contains: keyword, mode: "insensitive" });
}

describe("freelancer discovery search", () => {
  it.each([
    ["name", 0, (branch: Record<string, unknown>) => branch.user],
    ["bio", 1, (branch: Record<string, unknown>) => branch.bio],
    ["category", 2, (branch: Record<string, unknown>) => branch.categories],
    ["skill", 3, (branch: Record<string, unknown>) => branch.skills],
  ] as const)("matches keyword against public %s fields", async (_field, branchIndex, readBranch) => {
    const { service, findMany } = createSearchService();
    await service.searchFreelancers({ keyword: "Designer" });

    const where = findMany.mock.calls[0]?.[0].where;
    const branch = where.OR[branchIndex] as Record<string, unknown>;
    expect(readBranch(branch)).toBeDefined();

    if (branchIndex === 0) expect(branch).toEqual({ user: { name: keywordWhere("Designer") } });
    if (branchIndex === 1) expect(branch).toEqual({ bio: keywordWhere("Designer") });
    if (branchIndex === 2) {
      expect(branch).toEqual({
        categories: {
          some: {
            category: {
              OR: [{ name: keywordWhere("Designer") }, { slug: keywordWhere("Designer") }],
            },
          },
        },
      });
    }
    if (branchIndex === 3) {
      expect(branch).toEqual({ skills: { some: { skill: { name: keywordWhere("Designer") } } } });
    }
  });

  it("keeps keyword search approved-only", async () => {
    const { service, findMany, count } = createSearchService();
    await service.searchFreelancers({ keyword: "writer" });

    expect(findMany.mock.calls[0]?.[0].where.verificationStatus).toBe("approved");
    expect(count.mock.calls[0]?.[0].where.verificationStatus).toBe("approved");
  });

  it("combines categoryId and keyword", async () => {
    const { service, findMany } = createSearchService();
    await service.searchFreelancers({ keyword: "video", categoryId: "category-1" });

    expect(findMany.mock.calls[0]?.[0].where).toEqual(
      expect.objectContaining({
        verificationStatus: "approved",
        OR: expect.any(Array),
        categories: { some: { categoryId: "category-1" } },
      }),
    );
  });

  it("preserves skillId filtering", async () => {
    const { service, findMany } = createSearchService();
    await service.searchFreelancers({ skillId: "skill-1" });

    expect(findMany.mock.calls[0]?.[0].where.skills).toEqual({ some: { skillId: "skill-1" } });
  });

  it("filters by Assam state and district without changing other filters", async () => {
    const { service, findMany, count } = createSearchService();
    await service.searchFreelancers({
      state: "Assam",
      district: "Kamrup Metropolitan",
      keyword: "designer",
      categoryId: "category-1",
      page: 2,
      pageSize: 12,
    });

    expect(findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          state: "Assam",
          district: "Kamrup Metropolitan",
          OR: expect.any(Array),
          categories: { some: { categoryId: "category-1" } },
        }),
        skip: 12,
        take: 12,
      }),
    );
    expect(count.mock.calls[0]?.[0].where).toEqual(
      expect.objectContaining({ state: "Assam", district: "Kamrup Metropolitan" }),
    );
  });
});
