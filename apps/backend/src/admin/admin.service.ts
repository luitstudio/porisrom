import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
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

  async setBlocked(userId: string, blocked: boolean) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    if (user.status === "deleted") {
      throw new ConflictException("Cannot change block state of a deleted user");
    }
    return this.prisma.db.user.update({
      where: { id: userId },
      data: { status: blocked ? "blocked" : "active" },
    });
  }

  async softDeleteUser(userId: string) {
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return this.prisma.db.user.update({
      where: { id: userId },
      data: {
        status: "deleted",
        name: "Deleted User",
        email: `deleted-${userId}@porishrom.invalid`,
      },
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
    return this.prisma.db.notification.create({
      data: { userId: targetUserId, type: "admin_direct_message", message, createdBy: adminId },
    });
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
