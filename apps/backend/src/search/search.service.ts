import { Injectable } from "@nestjs/common";
import type { Prisma } from "@porisrom/database";

import { PrismaService } from "../prisma/prisma.service";
import type { SearchCompaniesDto } from "./dto/search-companies.dto";
import type { SearchFreelancersDto } from "./dto/search-freelancers.dto";

function normaliseKeyword(keyword?: string) {
  const phrase = keyword
    ?.trim()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!phrase) return undefined;

  const terms = [...new Set(phrase.toLowerCase().split(" "))];
  return { phrase, terms: terms.length > 1 ? terms : [] };
}

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchFreelancers(query: SearchFreelancersDto, viewerId?: string) {
    const excluded = await this.hiddenCounterparts(viewerId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const keyword = normaliseKeyword(query.keyword);

    const where: Prisma.FreelancerProfileWhereInput = {
      verificationStatus: "approved",
      ...(excluded.length ? { userId: { notIn: excluded } } : {}),
      user: { role: "freelancer", status: "active" },
      ...(keyword
        ? keyword.terms.length
          ? { AND: keyword.terms.map((term) => ({ OR: this.freelancerKeywordBranches(term) })) }
          : { OR: this.freelancerKeywordBranches(keyword.phrase) }
        : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.district ? { district: query.district } : {}),
      ...(query.experienceLevel ? { experienceLevel: query.experienceLevel } : {}),
      ...(query.verifiedOnly ? { isBadgeVerified: true } : {}),
      ...(query.minRating ? { ratingAvg: { gte: query.minRating } } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.skillId ? { skills: { some: { skillId: query.skillId } } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.db.freelancerProfile.findMany({
        where,
        select: {
          id: true,
          bio: true,
          profilePhotoUrl: true,
          state: true,
          district: true,
          experienceLevel: true,
          isBadgeVerified: true,
          ratingAvg: true,
          ratingCount: true,
          user: { select: { name: true } },
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.db.freelancerProfile.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async searchCompanies(query: SearchCompaniesDto, viewerId?: string) {
    const excluded = await this.hiddenCounterparts(viewerId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const keyword = normaliseKeyword(query.keyword);

    const where: Prisma.CompanyProfileWhereInput = {
      verificationStatus: "approved",
      ...(excluded.length ? { userId: { notIn: excluded } } : {}),
      user: { role: "client", status: "active" },
      ...(keyword
        ? keyword.terms.length
          ? { AND: keyword.terms.map((term) => ({ OR: this.companyKeywordBranches(term) })) }
          : { OR: this.companyKeywordBranches(keyword.phrase) }
        : {}),
      ...(query.state ? { state: query.state } : {}),
      ...(query.verifiedOnly ? { isBadgeVerified: true } : {}),
      ...(query.minRating ? { ratingAvg: { gte: query.minRating } } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.db.companyProfile.findMany({
        where,
        select: {
          id: true,
          companyName: true,
          logoUrl: true,
          about: true,
          state: true,
          isBadgeVerified: true,
          ratingAvg: true,
          ratingCount: true,
          user: { select: { name: true } },
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
        },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }, { id: "asc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.db.companyProfile.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  private async hiddenCounterparts(viewerId?: string) {
    if (!viewerId) return [];
    const rows = await this.prisma.db.userBlock.findMany({ where: { unblockedAt: null,
      OR: [{ blockerId: viewerId }, { blockedUserId: viewerId }] }, select: { blockerId: true, blockedUserId: true } });
    return rows.map((row) => row.blockerId === viewerId ? row.blockedUserId : row.blockerId);
  }

  private freelancerKeywordBranches(keyword: string): Prisma.FreelancerProfileWhereInput[] {
    return [
      { user: { name: { contains: keyword, mode: "insensitive" } } },
      { bio: { contains: keyword, mode: "insensitive" } },
      {
        categories: {
          some: {
            category: {
              OR: [
                { name: { contains: keyword, mode: "insensitive" } },
                { slug: { contains: keyword, mode: "insensitive" } },
              ],
            },
          },
        },
      },
      {
        skills: {
          some: { skill: { name: { contains: keyword, mode: "insensitive" } } },
        },
      },
    ];
  }

  private companyKeywordBranches(keyword: string): Prisma.CompanyProfileWhereInput[] {
    return [
      { companyName: { contains: keyword, mode: "insensitive" } },
      { about: { contains: keyword, mode: "insensitive" } },
      { state: { contains: keyword, mode: "insensitive" } },
    ];
  }
}
