import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { ReviewDirection } from "@porishrom/database";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateReviewDto } from "./dto/create-review.dto";

const AUTHOR_INCLUDE = { author: { select: { id: true, name: true } } } as const;

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, workAssignmentId: string, dto: CreateReviewDto) {
    const assignment = await this.prisma.db.workAssignment.findUnique({
      where: { id: workAssignmentId },
      include: { conversation: { include: { connection: true } } },
    });
    if (!assignment) {
      throw new NotFoundException("Work assignment not found");
    }

    const { connection } = assignment.conversation;
    if (connection.requesterId !== userId && connection.receiverId !== userId) {
      throw new ForbiddenException("You are not a participant of this work assignment");
    }
    if (assignment.status !== "completed") {
      throw new ConflictException("You can only review a completed assignment");
    }

    const targetId =
      connection.requesterId === userId ? connection.receiverId : connection.requesterId;
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    const direction: ReviewDirection =
      user?.role === "client" ? "client_to_freelancer" : "freelancer_to_client";

    const existing = await this.prisma.db.review.findUnique({
      where: { workAssignmentId_direction: { workAssignmentId, direction } },
    });
    if (existing) {
      throw new ConflictException("You've already reviewed this assignment");
    }

    const review = await this.prisma.db.review.create({
      data: {
        workAssignmentId,
        authorId: userId,
        targetId,
        direction,
        rating: dto.rating,
        comment: dto.comment,
      },
      include: AUTHOR_INCLUDE,
    });

    await this.recomputeRating(targetId, direction);

    return review;
  }

  async listForFreelancer(freelancerProfileId: string) {
    const profile = await this.prisma.db.freelancerProfile.findUnique({
      where: { id: freelancerProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Freelancer profile not found");
    }
    return this.prisma.db.review.findMany({
      where: { targetId: profile.userId, direction: "client_to_freelancer" },
      include: AUTHOR_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async listForCompany(companyProfileId: string) {
    const profile = await this.prisma.db.companyProfile.findUnique({
      where: { id: companyProfileId },
    });
    if (!profile) {
      throw new NotFoundException("Company profile not found");
    }
    return this.prisma.db.review.findMany({
      where: { targetId: profile.userId, direction: "freelancer_to_client" },
      include: AUTHOR_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  private async recomputeRating(targetId: string, direction: ReviewDirection) {
    const agg = await this.prisma.db.review.aggregate({
      where: { targetId, direction },
      _avg: { rating: true },
      _count: { rating: true },
    });
    const ratingAvg = agg._avg.rating ?? 0;
    const ratingCount = agg._count.rating;

    if (direction === "client_to_freelancer") {
      await this.prisma.db.freelancerProfile.updateMany({
        where: { userId: targetId },
        data: { ratingAvg, ratingCount },
      });
    } else {
      await this.prisma.db.companyProfile.updateMany({
        where: { userId: targetId },
        data: { ratingAvg, ratingCount },
      });
    }
  }
}
