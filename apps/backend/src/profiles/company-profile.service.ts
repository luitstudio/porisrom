import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  user: { select: { name: true } },
} as const;

@Injectable()
export class CompanyProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(id: string) {
    const profile = await this.prisma.db.companyProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException("Company profile not found");
    }
    return profile;
  }

  async upsertOwn(userId: string, dto: UpdateCompanyProfileDto) {
    const existing = await this.prisma.db.companyProfile.findUnique({ where: { userId } });

    const profile = await this.prisma.db.companyProfile.upsert({
      where: { userId },
      create: {
        userId,
        companyName: dto.companyName,
        logoUrl: dto.logoUrl,
        about: dto.about,
        address: dto.address,
        state: dto.state,
      },
      update: {
        companyName: dto.companyName,
        logoUrl: dto.logoUrl,
        about: dto.about,
        address: dto.address,
        state: dto.state,
        ...(existing?.verificationStatus === "rejected" ? { verificationStatus: "pending" as const } : {}),
      },
    });

    if (dto.categoryIds) {
      await this.prisma.db.companyCategory.deleteMany({ where: { companyProfileId: profile.id } });
      await this.prisma.db.companyCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({ companyProfileId: profile.id, categoryId })),
        skipDuplicates: true,
      });
    }

    await this.prisma.db.user.update({ where: { id: userId }, data: { isOnboarded: true } });

    return this.prisma.db.companyProfile.findUnique({
      where: { id: profile.id },
      include: PROFILE_INCLUDE,
    });
  }
}
