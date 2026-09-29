import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

const DEFAULT_MIN_RATING_COUNT = 3;
const LEADERBOARD_SIZE = 50;

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  listFreelancers(minRatingCount = DEFAULT_MIN_RATING_COUNT) {
    return this.prisma.db.freelancerProfile.findMany({
      where: { verificationStatus: "approved", ratingCount: { gte: minRatingCount } },
      select: {
        id: true,
        ratingAvg: true,
        ratingCount: true,
        isBadgeVerified: true,
        user: { select: { name: true } },
        categories: { select: { category: { select: { id: true, name: true } } } },
      },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: LEADERBOARD_SIZE,
    });
  }

  listCompanies(minRatingCount = DEFAULT_MIN_RATING_COUNT) {
    return this.prisma.db.companyProfile.findMany({
      where: { verificationStatus: "approved", ratingCount: { gte: minRatingCount } },
      select: {
        id: true,
        companyName: true,
        ratingAvg: true,
        ratingCount: true,
        isBadgeVerified: true,
        categories: { select: { category: { select: { id: true, name: true } } } },
      },
      orderBy: [{ ratingAvg: "desc" }, { ratingCount: "desc" }],
      take: LEADERBOARD_SIZE,
    });
  }
}
