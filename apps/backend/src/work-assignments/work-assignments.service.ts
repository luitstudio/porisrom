import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { CreateWorkAssignmentDto } from "./dto/create-work-assignment.dto";
import type { RespondWorkAssignmentDto } from "./dto/respond-work-assignment.dto";
import type { ReviseWorkAssignmentDto } from "./dto/revise-work-assignment.dto";

const EVENTS_INCLUDE = {
  events: { orderBy: { createdAt: "asc" as const } },
};

const TERMINAL_STATUSES = ["rejected", "cancelled", "completed"];

@Injectable()
export class WorkAssignmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, conversationId: string, dto: CreateWorkAssignmentDto) {
    await this.getConversationForParticipant(userId, conversationId);

    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (user?.role !== "client") {
      throw new ForbiddenException("Only a company can create a work assignment");
    }

    const assignment = await this.prisma.db.workAssignment.create({
      data: {
        conversationId,
        createdById: userId,
        title: dto.title,
        description: dto.description,
        budgetAmount: dto.budgetAmount,
        currency: dto.currency ?? "INR",
        dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      },
    });

    await this.logEvent(assignment.id, userId, "proposed");
    return this.withEvents(assignment.id);
  }

  async findOneForParticipant(userId: string, id: string) {
    const assignment = await this.getOwnAssignment(userId, id);
    return this.withEvents(assignment.id);
  }

  async listForConversation(userId: string, conversationId: string) {
    await this.getConversationForParticipant(userId, conversationId);
    return this.prisma.db.workAssignment.findMany({
      where: { conversationId },
      include: EVENTS_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async respond(userId: string, id: string, dto: RespondWorkAssignmentDto) {
    const assignment = await this.getOwnAssignment(userId, id);

    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (user?.role !== "freelancer") {
      throw new ForbiddenException("Only a freelancer can respond to a work assignment");
    }
    if (assignment.status !== "proposed") {
      throw new ConflictException("This assignment is not awaiting a response");
    }

    const nextStatus =
      dto.action === "accept"
        ? "accepted"
        : dto.action === "reject"
          ? "rejected"
          : "modification_requested";

    await this.prisma.db.workAssignment.update({
      where: { id: assignment.id },
      data: { status: nextStatus },
    });
    await this.logEvent(assignment.id, userId, dto.action, dto.note);

    return this.withEvents(assignment.id);
  }

  async revise(userId: string, id: string, dto: ReviseWorkAssignmentDto) {
    const assignment = await this.getOwnAssignment(userId, id);

    if (assignment.createdById !== userId) {
      throw new ForbiddenException("Only the company that created this assignment can revise it");
    }
    if (assignment.status !== "modification_requested") {
      throw new ConflictException("This assignment has no pending modification request");
    }

    if (dto.action === "reject") {
      await this.prisma.db.workAssignment.update({
        where: { id: assignment.id },
        data: { status: "rejected" },
      });
      await this.logEvent(assignment.id, userId, "rejected", dto.note);
      return this.withEvents(assignment.id);
    }

    await this.prisma.db.workAssignment.update({
      where: { id: assignment.id },
      data: {
        status: "proposed",
        ...(dto.title ? { title: dto.title } : {}),
        ...(dto.description ? { description: dto.description } : {}),
        ...(dto.budgetAmount !== undefined ? { budgetAmount: dto.budgetAmount } : {}),
        ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
      },
    });
    await this.logEvent(assignment.id, userId, "revised", dto.note);

    return this.withEvents(assignment.id);
  }

  async cancel(userId: string, id: string, note?: string) {
    const assignment = await this.getOwnAssignment(userId, id);

    if (TERMINAL_STATUSES.includes(assignment.status)) {
      throw new ConflictException("This assignment has already reached a final state");
    }

    if (!assignment.cancelRequestedById) {
      await this.prisma.db.workAssignment.update({
        where: { id: assignment.id },
        data: { cancelRequestedById: userId },
      });
      await this.logEvent(assignment.id, userId, "cancel_requested", note);
      return this.withEvents(assignment.id);
    }

    if (assignment.cancelRequestedById === userId) {
      throw new ConflictException(
        "You already requested cancellation — waiting for the other party to confirm",
      );
    }

    await this.prisma.db.workAssignment.update({
      where: { id: assignment.id },
      data: { status: "cancelled" },
    });
    await this.logEvent(assignment.id, userId, "cancelled", note);

    return this.withEvents(assignment.id);
  }

  private async getConversationForParticipant(userId: string, conversationId: string) {
    const conversation = await this.prisma.db.conversation.findUnique({
      where: { id: conversationId },
      include: { connection: true },
    });
    if (!conversation) {
      throw new NotFoundException("Conversation not found");
    }
    if (
      conversation.connection.requesterId !== userId &&
      conversation.connection.receiverId !== userId
    ) {
      throw new ForbiddenException("You are not a participant of this conversation");
    }
    return conversation;
  }

  private async getOwnAssignment(userId: string, id: string) {
    const assignment = await this.prisma.db.workAssignment.findUnique({
      where: { id },
      include: { conversation: { include: { connection: true } } },
    });
    if (!assignment) {
      throw new NotFoundException("Work assignment not found");
    }
    const { connection } = assignment.conversation;
    if (connection.requesterId !== userId && connection.receiverId !== userId) {
      throw new ForbiddenException("You are not a participant of this work assignment");
    }
    return assignment;
  }

  private async logEvent(workAssignmentId: string, actorId: string, action: string, note?: string) {
    await this.prisma.db.workAssignmentEvent.create({
      data: { workAssignmentId, actorId, action, note },
    });
  }

  private withEvents(id: string) {
    return this.prisma.db.workAssignment.findUnique({
      where: { id },
      include: EVENTS_INCLUDE,
    });
  }
}
