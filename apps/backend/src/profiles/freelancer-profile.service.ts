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

const PUBLIC_PROFILE_SELECT = {
  id: true,
  userId: true,
  bio: true,
  state: true,
  district: true,
  languages: true,
  experienceLevel: true,
  isBadgeVerified: true,
  ratingAvg: true,
  ratingCount: true,
  user: { select: { name: true } },
  categories: { select: { category: { select: { id: true, name: true } } } },
  skills: { select: { skill: { select: { id: true, name: true } } } },
  portfolioItems: {
    select: { id: true, title: true, description: true, type: true, url: true },
  },
} as const;

const OWNER_PROFILE_SELECT = {
  id: true,
  bio: true,
  address: true,
  state: true,
  district: true,
  languages: true,
  experienceLevel: true,
  verificationStatus: true,
  isBadgeVerified: true,
  ratingAvg: true,
  ratingCount: true,
  identityDocument: { select: { status: true, reviewedAt: true } },
  user: { select: { id: true, name: true, isOnboarded: true } },
  categories: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
  skills: {
    select: { skill: { select: { id: true, name: true, categoryId: true } } },
  },
  portfolioItems: {
    select: { id: true, title: true, description: true, type: true, url: true, createdAt: true },
    orderBy: { createdAt: "desc" as const },
  },
} as const;

@Injectable()
export class FreelancerProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnProfile(userId: string) {
    const profile = await this.prisma.db.freelancerProfile.findUnique({
      where: { userId },
      select: OWNER_PROFILE_SELECT,
    });
    if (!profile) {
      throw new NotFoundException("Freelancer profile not found");
    }

    const { user, ...ownerProfile } = profile;
    return {
      ...ownerProfile,
      isOnboarded: user.isOnboarded,
      identityDocumentReview: profile.identityDocument
        ? { status: profile.identityDocument.status, reviewedAt: profile.identityDocument.reviewedAt }
        : { status: "not_submitted" as const, reviewedAt: null },
      user: { id: user.id, name: user.name },
    };
  }

  async getPublicProfile(id: string) {
    const profile = await this.prisma.db.freelancerProfile.findFirst({
      where: { id, verificationStatus: "approved" },
      select: PUBLIC_PROFILE_SELECT,
    });
    if (!profile) {
      throw new NotFoundException("Freelancer profile not found");
    }
    return profile;
  }

  async upsertOwn(userId: string, dto: UpdateFreelancerProfileDto) {
    return this.prisma.db.$transaction(async (tx) => {
      const existing = await tx.freelancerProfile.findUnique({ where: { userId } });

      const profile = await tx.freelancerProfile.upsert({
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
        await tx.freelancerCategory.deleteMany({ where: { freelancerProfileId: profile.id } });
        await tx.freelancerCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({ freelancerProfileId: profile.id, categoryId })),
          skipDuplicates: true,
        });
      }

      if (dto.skillIds) {
        await tx.freelancerSkill.deleteMany({ where: { freelancerProfileId: profile.id } });
        await tx.freelancerSkill.createMany({
          data: dto.skillIds.map((skillId) => ({ freelancerProfileId: profile.id, skillId })),
          skipDuplicates: true,
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { isOnboarded: true, profileCompleteness: 100 },
      });

      return tx.freelancerProfile.findUnique({
        where: { id: profile.id },
        include: PROFILE_INCLUDE,
      });
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
