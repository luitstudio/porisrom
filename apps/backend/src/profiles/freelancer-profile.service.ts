import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { CreatePortfolioItemDto } from "./dto/create-portfolio-item.dto";
import type { UpdateFreelancerProfileDto } from "./dto/update-freelancer-profile.dto";
import { ProfilePhotoStorageService } from "./profile-photo-storage.service";

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
  profilePhotoUrl: true,
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
  profilePhotoUrl: true,
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

type ProfileRelationLookupClient = {
  category: {
    count: (args: { where: { id: { in: string[] } } }) => Promise<number>;
  };
  skill: {
    count: (args: { where: { id: { in: string[] } } }) => Promise<number>;
  };
};

@Injectable()
export class FreelancerProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profilePhotos: ProfilePhotoStorageService,
  ) {}

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
      where: { id, verificationStatus: "approved", user: { role: "freelancer", status: "active" } },
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
      if (dto.categoryIds) await this.assertCategoryIdsExist(tx, dto.categoryIds);
      if (dto.skillIds) await this.assertSkillIdsExist(tx, dto.skillIds);

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

  private async assertCategoryIdsExist(tx: ProfileRelationLookupClient, categoryIds: string[]) {
    const uniqueCategoryIds = [...new Set(categoryIds)];
    if (uniqueCategoryIds.length === 0) return;

    const found = await tx.category.count({ where: { id: { in: uniqueCategoryIds } } });
    if (found !== uniqueCategoryIds.length) {
      throw new BadRequestException("One or more category IDs are invalid");
    }
  }

  private async assertSkillIdsExist(tx: ProfileRelationLookupClient, skillIds: string[]) {
    const uniqueSkillIds = [...new Set(skillIds)];
    if (uniqueSkillIds.length === 0) return;

    const found = await tx.skill.count({ where: { id: { in: uniqueSkillIds } } });
    if (found !== uniqueSkillIds.length) {
      throw new BadRequestException("One or more skill IDs are invalid");
    }
  }

  async uploadProfilePhoto(userId: string, file: Express.Multer.File | undefined) {
    const profile = await this.prisma.db.freelancerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) {
      throw new NotFoundException("Complete your freelancer profile before adding a profile photo");
    }

    const { url } = await this.profilePhotos.uploadPublicPhoto(`profiles/freelancers/${userId}/avatar`, file);
    return this.prisma.db.freelancerProfile.update({
      where: { userId },
      data: { profilePhotoUrl: url },
      select: { id: true, profilePhotoUrl: true },
    });
  }

  async addPortfolioItem(userId: string, dto: CreatePortfolioItemDto) {
    const profile = await this.prisma.db.freelancerProfile.findUnique({ where: { userId } });
    if (!profile) {
      throw new NotFoundException("Complete your profile before adding portfolio items");
    }
    return this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
      const existing = await tx.portfolioItem.findFirst({ where: { freelancerProfileId: profile.id, url: dto.url, type: dto.type } });
      if (existing) return existing;
      return tx.portfolioItem.create({ data: { freelancerProfileId: profile.id, title: dto.title,
        description: dto.description, type: dto.type, url: dto.url } });
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
