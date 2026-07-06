import { Injectable, NotFoundException } from "@nestjs/common";
import type { Role } from "@porishrom/database";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  listUsers(params: { role?: string }) {
    return this.prisma.db.user.findMany({
      where: params.role ? { role: params.role as Role } : undefined,
      include: { freelancerProfile: true, companyProfile: true },
      orderBy: { createdAt: "desc" },
    });
  }

  approveProfile(userId: string) {
    return this.setVerificationStatus(userId, "approved");
  }

  rejectProfile(userId: string) {
    return this.setVerificationStatus(userId, "rejected");
  }

  async setBadge(userId: string, isBadgeVerified: boolean) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === "freelancer") {
      return this.prisma.db.freelancerProfile.update({ where: { userId }, data: { isBadgeVerified } });
    }
    if (user.role === "client") {
      return this.prisma.db.companyProfile.update({ where: { userId }, data: { isBadgeVerified } });
    }
    throw new NotFoundException("User has no profile to badge");
  }

  listActionLog() {
    return this.prisma.db.adminActionLog.findMany({ orderBy: { createdAt: "desc" } });
  }

  private async setVerificationStatus(userId: string, status: "approved" | "rejected") {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }

    if (user.role === "freelancer") {
      const profile = await this.prisma.db.freelancerProfile.findUnique({ where: { userId } });
      if (!profile) {
        throw new NotFoundException("Freelancer profile not found");
      }
      return this.prisma.db.freelancerProfile.update({ where: { userId }, data: { verificationStatus: status } });
    }

    if (user.role === "client") {
      const profile = await this.prisma.db.companyProfile.findUnique({ where: { userId } });
      if (!profile) {
        throw new NotFoundException("Company profile not found");
      }
      return this.prisma.db.companyProfile.update({ where: { userId }, data: { verificationStatus: status } });
    }

    throw new NotFoundException("User has no profile to moderate");
  }
}
