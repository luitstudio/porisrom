import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { CreatePortfolioItemDto } from "./dto/create-portfolio-item.dto";
import type { UpdateFreelancerProfileDto } from "./dto/update-freelancer-profile.dto";

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  skills: { include: { skill: true } },
  portfolioItems: true,
  user: { select: { name: true } },
} as const;

@Injectable()
export class FreelancerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getPublicProfile(id: string) {
    const profile = await this.prisma.db.freelancerProfile.findUnique({
      where: { id },
      include: PROFILE_INCLUDE,
    });
    if (!profile) {
      throw new NotFoundException("Freelancer profile not found");
    }
    return profile;
  }

  async upsertOwn(userId: string, dto: UpdateFreelancerProfileDto) {
    const existing = await this.prisma.db.freelancerProfile.findUnique({ where: { userId } });

    const profile = await this.prisma.db.freelancerProfile.upsert({
      where: { userId },
      create: {
        userId,
        bio: dto.bio,
        address: dto.address,
        state: dto.state,
        district: dto.district,
        languages: dto.languages ?? [],
        experienceLevel: dto.experienceLevel,
      },
      update: {
        bio: dto.bio,
        address: dto.address,
        state: dto.state,
        district: dto.district,
        languages: dto.languages,
        experienceLevel: dto.experienceLevel,
        ...(existing?.verificationStatus === "rejected" ? { verificationStatus: "pending" as const } : {}),
      },
    });

    if (dto.categoryIds) {
      await this.prisma.db.freelancerCategory.deleteMany({ where: { freelancerProfileId: profile.id } });
      await this.prisma.db.freelancerCategory.createMany({
        data: dto.categoryIds.map((categoryId) => ({ freelancerProfileId: profile.id, categoryId })),
        skipDuplicates: true,
      });
    }

    if (dto.skillIds) {
      await this.prisma.db.freelancerSkill.deleteMany({ where: { freelancerProfileId: profile.id } });
      await this.prisma.db.freelancerSkill.createMany({
        data: dto.skillIds.map((skillId) => ({ freelancerProfileId: profile.id, skillId })),
        skipDuplicates: true,
      });
    }

    await this.prisma.db.user.update({ where: { id: userId }, data: { isOnboarded: true } });

    return this.prisma.db.freelancerProfile.findUnique({
      where: { id: profile.id },
      include: PROFILE_INCLUDE,
    });
  }

  async addPortfolioItem(userId: string, dto: CreatePortfolioItemDto) {
    const profile = await this.prisma.db.freelancerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Complete your profile before adding portfolio items");
    }
    return this.prisma.db.portfolioItem.create({
      data: {
        freelancerProfileId: profile.id,
        title: dto.title,
        description: dto.description,
        type: dto.type,
        url: dto.url,
      },
    });
  }

  async removePortfolioItem(userId: string, itemId: string) {
    const profile = await this.prisma.db.freelancerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Freelancer profile not found");
    }

    const item = await this.prisma.db.portfolioItem.findUnique({ where: { id: itemId } });
    if (!item || item.freelancerProfileId !== profile.id) {
      throw new NotFoundException("Portfolio item not found");
    }

    await this.prisma.db.portfolioItem.delete({ where: { id: itemId } });
    return { success: true };
  }
}
