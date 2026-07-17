import { Injectable } from "@nestjs/common";
import type { Prisma } from "@porishrom/database";

import { PrismaService } from "../prisma/prisma.service";
import type { SearchCompaniesDto } from "./dto/search-companies.dto";
import type { SearchFreelancersDto } from "./dto/search-freelancers.dto";

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  async searchFreelancers(query: SearchFreelancersDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.FreelancerProfileWhereInput = {
      verificationStatus: "approved",
      ...(query.state ? { state: query.state } : {}),
      ...(query.experienceLevel ? { experienceLevel: query.experienceLevel } : {}),
      ...(query.verifiedOnly ? { isBadgeVerified: true } : {}),
      ...(query.minRating ? { ratingAvg: { gte: query.minRating } } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
      ...(query.skillId ? { skills: { some: { skillId: query.skillId } } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.db.freelancerProfile.findMany({
        where,
        include: {
          user: { select: { name: true } },
          categories: { include: { category: true } },
          skills: { include: { skill: true } },
        },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.db.freelancerProfile.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async searchCompanies(query: SearchCompaniesDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const where: Prisma.CompanyProfileWhereInput = {
      verificationStatus: "approved",
      ...(query.state ? { state: query.state } : {}),
      ...(query.verifiedOnly ? { isBadgeVerified: true } : {}),
      ...(query.minRating ? { ratingAvg: { gte: query.minRating } } : {}),
      ...(query.categoryId ? { categories: { some: { categoryId: query.categoryId } } } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.db.companyProfile.findMany({
        where,
        include: {
          user: { select: { name: true } },
          categories: { include: { category: true } },
        },
        orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.db.companyProfile.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }
}
