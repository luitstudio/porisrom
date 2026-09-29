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
    const keyword = query.keyword?.trim();

    const where: Prisma.FreelancerProfileWhereInput = {
      verificationStatus: "approved",
      ...(keyword
        ? {
            OR: [
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
            ],
          }
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
          state: true,
          district: true,
          experienceLevel: true,
          isBadgeVerified: true,
          ratingAvg: true,
          ratingCount: true,
          user: { select: { name: true } },
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
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
    const keyword = query.keyword?.trim();

    const where: Prisma.CompanyProfileWhereInput = {
      verificationStatus: "approved",
      ...(keyword
        ? {
            OR: [
              { companyName: { contains: keyword, mode: "insensitive" } },
              { about: { contains: keyword, mode: "insensitive" } },
              { state: { contains: keyword, mode: "insensitive" } },
            ],
          }
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
          about: true,
          state: true,
          isBadgeVerified: true,
          ratingAvg: true,
          ratingCount: true,
          user: { select: { name: true } },
          categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
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
