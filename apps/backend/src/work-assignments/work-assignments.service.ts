import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import type { ClaimPaymentDto } from "./dto/claim-payment.dto";
import type { CreateDeliverableDto } from "./dto/create-deliverable.dto";
import type { CreateWorkAssignmentDto } from "./dto/create-work-assignment.dto";
import type { RespondWorkAssignmentDto } from "./dto/respond-work-assignment.dto";
import type { ReviseWorkAssignmentDto } from "./dto/revise-work-assignment.dto";

const FULL_INCLUDE = {
  events: { orderBy: { createdAt: "asc" as const } },
  deliverables: { orderBy: { submittedAt: "asc" as const } },
  paymentVerification: true,
};

const TERMINAL_STATUSES = ["rejected", "cancelled", "completed"];
const SUBMITTABLE_STATUSES = ["accepted", "in_progress", "revision_requested"];
const MISMATCH_THRESHOLD = 3;

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
    return this.withDetails(assignment.id);
  }

  async findOneForParticipant(userId: string, id: string) {
    const assignment = await this.getOwnAssignment(userId, id);
    return this.withDetails(assignment.id);
  }

  async listForConversation(userId: string, conversationId: string) {
    await this.getConversationForParticipant(userId, conversationId);
    return this.prisma.db.workAssignment.findMany({
      where: { conversationId },
      include: FULL_INCLUDE,
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

    return this.withDetails(assignment.id);
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
      return this.withDetails(assignment.id);
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

    return this.withDetails(assignment.id);
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
      return this.withDetails(assignment.id);
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

    return this.withDetails(assignment.id);
  }

  async submitDeliverable(userId: string, id: string, dto: CreateDeliverableDto) {
    const assignment = await this.getOwnAssignment(userId, id);

    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (user?.role !== "freelancer") {
      throw new ForbiddenException("Only a freelancer can submit a deliverable");
    }
    if (!SUBMITTABLE_STATUSES.includes(assignment.status)) {
      throw new ConflictException("This assignment is not ready for a deliverable submission");
    }

    await this.prisma.db.deliverable.create({
      data: { workAssignmentId: id, type: dto.type, url: dto.url, note: dto.note },
    });
    await this.prisma.db.workAssignment.update({
      where: { id: assignment.id },
      data: { status: "submitted" },
    });
    await this.logEvent(assignment.id, userId, "submitted", dto.note);

    return this.withDetails(assignment.id);
  }

  async acceptDelivery(userId: string, id: string) {
    const assignment = await this.getOwnAssignment(userId, id);

    if (assignment.createdById !== userId) {
      throw new ForbiddenException(
        "Only the company that created this assignment can accept delivery",
      );
    }
    if (assignment.status !== "submitted") {
      throw new ConflictException("This assignment has no submitted delivery awaiting review");
    }

    await this.prisma.db.workAssignment.update({
      where: { id: assignment.id },
      data: { status: "payment_pending" },
    });
    await this.prisma.db.paymentVerification.upsert({
      where: { workAssignmentId: id },
      create: { workAssignmentId: id },
      update: {},
    });
    await this.logEvent(assignment.id, userId, "delivery_accepted");

    return this.withDetails(assignment.id);
  }

  async requestDeliveryRevision(userId: string, id: string, note?: string) {
    const assignment = await this.getOwnAssignment(userId, id);

    if (assignment.createdById !== userId) {
      throw new ForbiddenException(
        "Only the company that created this assignment can request a revision",
      );
    }
    if (assignment.status !== "submitted") {
      throw new ConflictException("This assignment has no submitted delivery awaiting review");
    }

    await this.prisma.db.workAssignment.update({
      where: { id: assignment.id },
      data: { status: "revision_requested" },
    });
    await this.logEvent(assignment.id, userId, "revision_requested", note);

    return this.withDetails(assignment.id);
  }

  async claimPaid(userId: string, id: string, dto: ClaimPaymentDto) {
    const assignment = await this.getOwnAssignment(userId, id);
    if (assignment.createdById !== userId) {
      throw new ForbiddenException("Only the company can claim a payment as sent");
    }
    this.assertPaymentOpen(assignment.status);

    const existing = await this.prisma.db.paymentVerification.findUnique({
      where: { workAssignmentId: id },
    });
    if (!existing) {
      throw new NotFoundException("Payment verification record not found");
    }

    const updated = await this.prisma.db.paymentVerification.update({
      where: { id: existing.id },
      data: {
        clientUtr: dto.utr,
        clientClaimedAt: new Date(),
        status: existing.freelancerUtr ? existing.status : "awaiting_freelancer",
      },
    });
    await this.logEvent(id, userId, "payment_claimed_paid");
    await this.finalizePaymentClaim(id, userId, updated);

    return this.getPayment(userId, id);
  }

  async claimReceived(userId: string, id: string, dto: ClaimPaymentDto) {
    const assignment = await this.getOwnAssignment(userId, id);
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (user?.role !== "freelancer") {
      throw new ForbiddenException("Only the freelancer can claim a payment as received");
    }
    this.assertPaymentOpen(assignment.status);

    const existing = await this.prisma.db.paymentVerification.findUnique({
      where: { workAssignmentId: id },
    });
    if (!existing) {
      throw new NotFoundException("Payment verification record not found");
    }

    const updated = await this.prisma.db.paymentVerification.update({
      where: { id: existing.id },
      data: {
        freelancerUtr: dto.utr,
        freelancerClaimedAt: new Date(),
        status: existing.clientUtr ? existing.status : "awaiting_client",
      },
    });
    await this.logEvent(id, userId, "payment_claimed_received");
    await this.finalizePaymentClaim(id, userId, updated);

    return this.getPayment(userId, id);
  }

  async getPayment(userId: string, id: string) {
    await this.getOwnAssignment(userId, id);
    return this.prisma.db.paymentVerification.findUnique({ where: { workAssignmentId: id } });
  }

  private assertPaymentOpen(status: string) {
    if (status === "disputed") {
      throw new ConflictException("This payment is disputed and awaiting admin review");
    }
    if (status !== "payment_pending") {
      throw new ConflictException("Payment verification isn't open for this assignment yet");
    }
  }

  private async finalizePaymentClaim(
    assignmentId: string,
    actorId: string,
    payment: {
      id: string;
      clientUtr: string | null;
      freelancerUtr: string | null;
      mismatchCount: number;
    },
  ) {
    if (!payment.clientUtr || !payment.freelancerUtr) {
      return;
    }

    if (payment.clientUtr === payment.freelancerUtr) {
      await this.prisma.db.paymentVerification.update({
        where: { id: payment.id },
        data: { status: "verified", verifiedAt: new Date() },
      });
      await this.prisma.db.workAssignment.update({
        where: { id: assignmentId },
        data: { status: "completed" },
      });
      await this.logEvent(assignmentId, actorId, "payment_verified");
      return;
    }

    const mismatchCount = payment.mismatchCount + 1;
    await this.prisma.db.paymentVerification.update({
      where: { id: payment.id },
      data: {
        status: "mismatch",
        mismatchCount,
        // Clear both claims so the next submission from either side is compared
        // against a genuinely fresh value, not a stale one from before this
        // mismatch — otherwise a single new claim gets checked against the other
        // party's untouched old value, inflating mismatchCount twice per actual
        // correction round instead of once.
        clientUtr: null,
        clientClaimedAt: null,
        freelancerUtr: null,
        freelancerClaimedAt: null,
      },
    });
    await this.logEvent(assignmentId, actorId, "payment_mismatch");

    if (mismatchCount >= MISMATCH_THRESHOLD) {
      await this.prisma.db.workAssignment.update({
        where: { id: assignmentId },
        data: { status: "disputed" },
      });
      await this.logEvent(assignmentId, actorId, "payment_disputed");
    }
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

  private withDetails(id: string) {
    return this.prisma.db.workAssignment.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    });
  }
}
