import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { UpdateCompanyProfileDto } from "./dto/update-company-profile.dto";
import { ProfilePhotoStorageService } from "./profile-photo-storage.service";

const PROFILE_INCLUDE = {
  categories: { include: { category: true } },
  user: { select: { name: true } },
} as const;

const PUBLIC_PROFILE_SELECT = {
  id: true,
  userId: true,
  companyName: true,
  logoUrl: true,
  about: true,
  state: true,
  isBadgeVerified: true,
  ratingAvg: true,
  ratingCount: true,
  user: { select: { name: true } },
  categories: { select: { category: { select: { id: true, name: true } } } },
} as const;

const OWNER_PROFILE_SELECT = {
  id: true,
  companyName: true,
  logoUrl: true,
  about: true,
  address: true,
  state: true,
  verificationStatus: true,
  isBadgeVerified: true,
  ratingAvg: true,
  ratingCount: true,
  documents: { select: { id: true, type: true, uploadStatus: true, createdAt: true, updatedAt: true } },
  user: { select: { id: true, name: true, isOnboarded: true } },
  categories: {
    select: { category: { select: { id: true, name: true, slug: true } } },
  },
} as const;

type CategoryLookupClient = {
  category: {
    count: (args: { where: { id: { in: string[] } } }) => Promise<number>;
  };
};

@Injectable()
export class CompanyProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly profilePhotos: ProfilePhotoStorageService,
  ) {}

  async getOwnProfile(userId: string) {
    const profile = await this.prisma.db.companyProfile.findUnique({
      where: { userId },
      select: OWNER_PROFILE_SELECT,
    });
    if (!profile) {
      throw new NotFoundException("Company profile not found");
    }

    const { user, ...ownerProfile } = profile;
    return {
      ...ownerProfile,
      isOnboarded: user.isOnboarded,
      user: { id: user.id, name: user.name },
    };
  }

  async getPublicProfile(id: string) {
    const profile = await this.prisma.db.companyProfile.findFirst({
      where: { id, verificationStatus: "approved", user: { role: "client", status: "active" } },
      select: PUBLIC_PROFILE_SELECT,
    });
    if (!profile) {
      throw new NotFoundException("Company profile not found");
    }
    return profile;
  }

  async upsertOwn(userId: string, dto: UpdateCompanyProfileDto) {
    return this.prisma.db.$transaction(async (tx) => {
      const existing = await tx.companyProfile.findUnique({ where: { userId } });
      if (dto.categoryIds) await this.assertCategoryIdsExist(tx, dto.categoryIds);

      const profile = await tx.companyProfile.upsert({
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
        await tx.companyCategory.deleteMany({ where: { companyProfileId: profile.id } });
        await tx.companyCategory.createMany({
          data: dto.categoryIds.map((categoryId) => ({ companyProfileId: profile.id, categoryId })),
          skipDuplicates: true,
        });
      }

      await tx.user.update({
        where: { id: userId },
        data: { isOnboarded: true, profileCompleteness: 100 },
      });

      return tx.companyProfile.findUnique({
        where: { id: profile.id },
        include: PROFILE_INCLUDE,
      });
    });
  }

  private async assertCategoryIdsExist(tx: CategoryLookupClient, categoryIds: string[]) {
    const uniqueCategoryIds = [...new Set(categoryIds)];
    if (uniqueCategoryIds.length === 0) return;

    const found = await tx.category.count({ where: { id: { in: uniqueCategoryIds } } });
    if (found !== uniqueCategoryIds.length) {
      throw new BadRequestException("One or more category IDs are invalid");
    }
  }

  async uploadLogo(userId: string, file: Express.Multer.File | undefined) {
    const profile = await this.prisma.db.companyProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) {
      throw new NotFoundException("Complete your company profile before adding a logo");
    }

    const { url } = await this.profilePhotos.uploadPublicPhoto(`profiles/companies/${userId}/logo`, file);
    return this.prisma.db.companyProfile.update({
      where: { userId },
      data: { logoUrl: url },
      select: { id: true, logoUrl: true },
    });
  }
}
