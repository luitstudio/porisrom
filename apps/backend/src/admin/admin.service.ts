import { ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import type { Role } from "@porishrom/database";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

const ADMIN_USER_LIST_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  freelancerProfile: {
    select: {
      verificationStatus: true,
      isBadgeVerified: true,
      ratingAvg: true,
      ratingCount: true,
    },
  },
  companyProfile: {
    select: {
      verificationStatus: true,
      isBadgeVerified: true,
      ratingAvg: true,
      ratingCount: true,
    },
  },
} as const;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  listUsers(params: { role?: string }) {
    return this.prisma.db.user.findMany({
      where: params.role ? { role: params.role as Role } : undefined,
      select: ADMIN_USER_LIST_SELECT,
      orderBy: { createdAt: "desc" },
    });
  }

  async getProfileForReview(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        role: true,
        status: true,
        isOnboarded: true,
        freelancerProfile: {
          select: {
            id: true,
            bio: true,
            address: true,
            state: true,
            district: true,
            experienceLevel: true,
            verificationStatus: true,
            isBadgeVerified: true,
            identityDocument: { select: { status: true, reviewedAt: true } },
            categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
            skills: { select: { skill: { select: { id: true, name: true } } } },
            portfolioItems: { select: { id: true, title: true, type: true, url: true } },
          },
        },
        companyProfile: {
          select: {
            id: true,
            companyName: true,
            about: true,
            address: true,
            state: true,
            logoUrl: true,
            verificationStatus: true,
            isBadgeVerified: true,
            categories: { select: { category: { select: { id: true, name: true, slug: true } } } },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.role !== "freelancer" && user.role !== "client") {
      throw new NotFoundException("User has no profile to moderate");
    }

    const profile = user.role === "freelancer" ? user.freelancerProfile : user.companyProfile;
    if (!profile) {
      throw new NotFoundException(`${user.role === "freelancer" ? "Freelancer" : "Company"} profile not found`);
    }

    return { id: user.id, name: user.name, role: user.role, status: user.status, isOnboarded: user.isOnboarded, profile };
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

  async setBlocked(userId: string, blocked: boolean) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.role === "admin") {
      throw new ForbiddenException("Admin accounts cannot be blocked");
    }
    if (user.status === "deleted") {
      throw new ConflictException("Cannot change block state of a deleted user");
    }
    return this.prisma.db.user.update({
      where: { id: userId },
      data: { status: blocked ? "blocked" : "active" },
      select: ADMIN_USER_LIST_SELECT,
    });
  }

  async softDeleteUser(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.role === "admin") {
      throw new ForbiddenException("Admin accounts cannot be deleted");
    }
    return this.prisma.db.user.update({
      where: { id: userId },
      data: {
        status: "deleted",
        name: "Deleted User",
        email: `deleted-${userId}@porishrom.invalid`,
      },
      select: ADMIN_USER_LIST_SELECT,
    });
  }

  async listReviews() {
    const reviews = await this.prisma.db.review.findMany({
      select: {
        id: true,
        rating: true,
        comment: true,
        direction: true,
        targetId: true,
        createdAt: true,
        author: { select: { id: true, name: true, role: true } },
        workAssignment: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    const targetIds = [...new Set(reviews.map((review) => review.targetId))];
    const targets = await this.prisma.db.user.findMany({
      where: { id: { in: targetIds } },
      select: {
        id: true,
        name: true,
        role: true,
        freelancerProfile: { select: { id: true } },
        companyProfile: { select: { id: true, companyName: true } },
      },
    });
    const targetsById = new Map(targets.map((target) => [target.id, target]));

    return reviews.map(({ targetId, ...review }) => ({
      ...review,
      target: targetsById.get(targetId) ?? { id: targetId, name: "Unavailable user", role: null },
    }));
  }

  async removeReview(reviewId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const review = await tx.review.findUnique({
        where: { id: reviewId },
        select: { id: true, targetId: true, direction: true },
      });
      if (!review) {
        throw new NotFoundException("Review not found");
      }

      await tx.review.delete({ where: { id: reviewId } });
      const aggregate = await tx.review.aggregate({
        where: { targetId: review.targetId, direction: review.direction },
        _avg: { rating: true },
        _count: { rating: true },
      });
      const rating = {
        ratingAvg: aggregate._avg.rating ?? 0,
        ratingCount: aggregate._count.rating,
      };
      if (review.direction === "client_to_freelancer") {
        await tx.freelancerProfile.updateMany({ where: { userId: review.targetId }, data: rating });
      } else {
        await tx.companyProfile.updateMany({ where: { userId: review.targetId }, data: rating });
      }

      return { id: review.id, removed: true };
    });
  }

  listConversations() {
    return this.prisma.db.conversation.findMany({
      include: {
        connection: {
          select: {
            status: true,
            requester: { select: { id: true, name: true, role: true } },
            receiver: { select: { id: true, name: true, role: true } },
          },
        },
        _count: { select: { messages: true, workAssignments: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  listWorkAssignments() {
    return this.prisma.db.workAssignment.findMany({
      include: {
        conversation: {
          select: {
            connection: {
              select: {
                requester: { select: { id: true, name: true } },
                receiver: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    });
  }

  async broadcastNotification(adminId: string, type: string, message: string) {
    return this.prisma.db.notification.create({
      data: { userId: null, type, message, createdBy: adminId },
    });
  }

  async sendDirectMessage(adminId: string, targetUserId: string, message: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    const notification = await this.prisma.db.notification.create({
      data: { userId: targetUserId, type: "admin_direct_message", message, createdBy: adminId },
    });
    this.realtimeGateway?.emitNotificationCreated(notification);
    return notification;
  }

  async getAnalytics() {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    const [
      signupsByDay,
      activeAssignments,
      totalAssignments,
      verifiedPayments,
      totalPayments,
      usersByRole,
    ] = await Promise.all([
      this.prisma.db.$queryRaw<{ day: Date; count: bigint }[]>`
        SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
        FROM "User"
        WHERE "createdAt" >= ${since}
        GROUP BY day
        ORDER BY day ASC
      `,
      this.prisma.db.workAssignment.count({
        where: {
          status: {
            in: ["proposed", "modification_requested", "accepted", "in_progress", "submitted", "revision_requested", "delivery_accepted", "payment_pending"],
          },
        },
      }),
      this.prisma.db.workAssignment.count(),
      this.prisma.db.paymentVerification.count({ where: { status: "verified" } }),
      this.prisma.db.paymentVerification.count(),
      this.prisma.db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    ]);

    return {
      signupsByDay: signupsByDay.map((row) => ({ day: row.day, count: Number(row.count) })),
      activeAssignments,
      totalAssignments,
      paymentVerificationRate: totalPayments === 0 ? 0 : verifiedPayments / totalPayments,
      verifiedPayments,
      totalPayments,
      usersByRole: usersByRole.map((row) => ({ role: row.role, count: row._count._all })),
    };
  }

  listActionLog() {
    return this.prisma.db.adminActionLog.findMany({ orderBy: { createdAt: "desc" } });
  }

  listPayments() {
    return this.prisma.db.paymentVerification.findMany({
      include: {
        workAssignment: {
          select: {
            id: true,
            title: true,
            status: true,
            budgetAmount: true,
            currency: true,
            conversation: {
              select: {
                connection: {
                  select: {
                    requester: { select: { id: true, name: true } },
                    receiver: { select: { id: true, name: true } },
                  },
                },
              },
            },
          },
        },
      },
      // Enum ordering doesn't put "mismatch" in a useful position either way, so sort by
      // recent activity instead — the frontend highlights mismatch/disputed items visually.
      orderBy: { workAssignment: { updatedAt: "desc" } },
    });
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
