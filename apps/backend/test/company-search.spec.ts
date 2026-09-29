import { describe, expect, it, vi } from "vitest";

import type { PrismaService } from "../src/prisma/prisma.service";
import { SearchService } from "../src/search/search.service";

function createSearchService() {
  const findMany = vi.fn().mockResolvedValue([]);
  const count = vi.fn().mockResolvedValue(0);
  const prisma = {
    db: { companyProfile: { findMany, count } },
  } as unknown as PrismaService;
  return { service: new SearchService(prisma), findMany, count };
}

const keywordWhere = (keyword: string) =>
  expect.objectContaining({ contains: keyword, mode: "insensitive" });

describe("company discovery search", () => {
  it("matches company name, about text, and state case-insensitively", async () => {
    const { service, findMany } = createSearchService();
    await service.searchCompanies({ keyword: "Codex" });

    expect(findMany.mock.calls[0]?.[0].where.OR).toEqual([
      { companyName: keywordWhere("Codex") },
      { about: keywordWhere("Codex") },
      { state: keywordWhere("Codex") },
    ]);
  });

  it("keeps keyword search approved-only", async () => {
    const { service, findMany, count } = createSearchService();
    await service.searchCompanies({ keyword: "studio" });

    expect(findMany.mock.calls[0]?.[0].where.verificationStatus).toBe("approved");
    expect(count.mock.calls[0]?.[0].where.verificationStatus).toBe("approved");
  });

  it("combines a partial keyword with category, state, verified-only, and pagination", async () => {
    const { service, findMany, count } = createSearchService();
    await service.searchCompanies({
      keyword: "stud",
      categoryId: "category-1",
      state: "Assam",
      verifiedOnly: true,
      page: 2,
      pageSize: 12,
    });

    expect(findMany.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        where: expect.objectContaining({
          verificationStatus: "approved",
          OR: expect.any(Array),
          state: "Assam",
          isBadgeVerified: true,
          categories: { some: { categoryId: "category-1" } },
        }),
        skip: 12,
        take: 12,
      }),
    );
    expect(count.mock.calls[0]?.[0].where).toEqual(expect.objectContaining({ OR: expect.any(Array) }));
  });
});
