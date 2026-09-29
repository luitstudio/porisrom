import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { PaymentVerification } from "@porishrom/database";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import type { ClaimPaymentDto } from "./dto/claim-payment.dto";
import type { CreateDeliverableDto } from "./dto/create-deliverable.dto";
import type { CreateWorkAssignmentDto } from "./dto/create-work-assignment.dto";
import type { RespondWorkAssignmentDto } from "./dto/respond-work-assignment.dto";
import type { ReviseWorkAssignmentDto } from "./dto/revise-work-assignment.dto";

const FULL_INCLUDE = {
  events: { orderBy: { createdAt: "asc" as const } },
  deliverables: { orderBy: { submittedAt: "asc" as const } },
  paymentVerification: true,
  reviews: true,
};

const TERMINAL_STATUSES = ["rejected", "cancelled", "completed"];
const SUBMITTABLE_STATUSES = ["accepted", "in_progress", "revision_requested"];
const MISMATCH_THRESHOLD = 3;

@Injectable()
export class WorkAssignmentsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  async create(userId: string, conversationId: string, dto: CreateWorkAssignmentDto) {
    const conversation = await this.getConversationForParticipant(userId, conversationId);

    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (user?.role !== "client") {
      throw new ForbiddenException("Only a company can create a work assignment");
    }

    const result = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.workAssignment.create({
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
      await tx.workAssignmentEvent.create({
        data: { workAssignmentId: created.id, actorId: userId, action: "proposed" },
      });
      const notification = await tx.notification.create({
        data: {
          userId:
            conversation.connection.requesterId === userId
              ? conversation.connection.receiverId
              : conversation.connection.requesterId,
          type: "work_assignment_proposed",
          message: "You received a new work assignment.",
        },
      });
      return { assignment: created, notification };
    });

    this.realtimeGateway?.emitNotificationCreated(result.notification);
    return this.withDetails(userId, result.assignment.id);
  }

  async findOneForParticipant(userId: string, id: string) {
    const assignment = await this.getOwnAssignment(userId, id);
    return this.withDetails(userId, assignment.id);
  }

  async listForConversation(userId: string, conversationId: string) {
    await this.getConversationForParticipant(userId, conversationId);
    const assignments = await this.prisma.db.workAssignment.findMany({
      where: { conversationId },
      include: FULL_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return assignments.map((assignment) => this.redactAssignmentPayment(assignment, userId));
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

    const notification = await this.prisma.db.$transaction(async (tx) => {
      await tx.workAssignment.update({
        where: { id: assignment.id },
        data: { status: nextStatus },
      });
      await tx.workAssignmentEvent.create({
        data: {
          workAssignmentId: assignment.id,
          actorId: userId,
          action: dto.action,
          note: dto.note,
        },
      });
      if (dto.action === "accept" || dto.action === "reject") {
        return tx.notification.create({
          data: {
            userId: assignment.createdById,
            type:
              dto.action === "accept"
                ? "work_assignment_accepted"
                : "work_assignment_rejected",
            message:
              dto.action === "accept"
                ? "Your work assignment was accepted."
                : "Your work assignment was rejected.",
          },
        });
      }
      return null;
    });
    if (notification) this.realtimeGateway?.emitNotificationCreated(notification);

    await this.emitFinancialUpdate(assignment.id);
    return this.withDetails(userId, assignment.id);
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
      await this.prisma.db.$transaction(async (tx) => {
        await tx.workAssignment.update({
          where: { id: assignment.id },
          data: { status: "rejected" },
        });
        await tx.workAssignmentEvent.create({
          data: {
            workAssignmentId: assignment.id,
            actorId: userId,
            action: "rejected",
            note: dto.note,
          },
        });
      });
      return this.withDetails(userId, assignment.id);
    }

    await this.prisma.db.$transaction(async (tx) => {
      await tx.workAssignment.update({
        where: { id: assignment.id },
        data: {
          status: "proposed",
          ...(dto.title ? { title: dto.title } : {}),
          ...(dto.description ? { description: dto.description } : {}),
          ...(dto.budgetAmount !== undefined ? { budgetAmount: dto.budgetAmount } : {}),
          ...(dto.dueDate ? { dueDate: new Date(dto.dueDate) } : {}),
        },
      });
      await tx.workAssignmentEvent.create({
        data: {
          workAssignmentId: assignment.id,
          actorId: userId,
          action: "revised",
          note: dto.note,
        },
      });
    });

    return this.withDetails(userId, assignment.id);
  }

  async cancel(userId: string, id: string, note?: string) {
    const assignment = await this.getOwnAssignment(userId, id);

    if (TERMINAL_STATUSES.includes(assignment.status)) {
      throw new ConflictException("This assignment has already reached a final state");
    }

    if (!assignment.cancelRequestedById) {
      await this.prisma.db.$transaction(async (tx) => {
        await tx.workAssignment.update({
          where: { id: assignment.id },
          data: { cancelRequestedById: userId },
        });
        await tx.workAssignmentEvent.create({
          data: {
            workAssignmentId: assignment.id,
            actorId: userId,
            action: "cancel_requested",
            note,
          },
        });
      });
      return this.withDetails(userId, assignment.id);
    }

    if (assignment.cancelRequestedById === userId) {
      throw new ConflictException(
        "You already requested cancellation — waiting for the other party to confirm",
      );
    }

    await this.prisma.db.$transaction(async (tx) => {
      await tx.workAssignment.update({
        where: { id: assignment.id },
        data: { status: "cancelled" },
      });
      await tx.workAssignmentEvent.create({
        data: { workAssignmentId: assignment.id, actorId: userId, action: "cancelled", note },
      });
    });

    await this.emitFinancialUpdate(assignment.id);
    return this.withDetails(userId, assignment.id);
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

    await this.prisma.db.$transaction(async (tx) => {
      await tx.deliverable.create({
        data: { workAssignmentId: id, type: dto.type, url: dto.url, note: dto.note },
      });
      await tx.workAssignment.update({
        where: { id: assignment.id },
        data: { status: "submitted" },
      });
      await tx.workAssignmentEvent.create({
        data: {
          workAssignmentId: assignment.id,
          actorId: userId,
          action: "submitted",
          note: dto.note,
        },
      });
    });

    await this.emitFinancialUpdate(assignment.id);
    return this.withDetails(userId, assignment.id);
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

    await this.prisma.db.$transaction(async (tx) => {
      await tx.workAssignment.update({
        where: { id: assignment.id },
        data: { status: "payment_pending" },
      });
      await tx.paymentVerification.upsert({
        where: { workAssignmentId: id },
        create: { workAssignmentId: id },
        update: {},
      });
      await tx.workAssignmentEvent.create({
        data: {
          workAssignmentId: assignment.id,
          actorId: userId,
          action: "delivery_accepted",
        },
      });
    });

    await this.emitFinancialUpdate(assignment.id);
    return this.withDetails(userId, assignment.id);
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

    await this.prisma.db.$transaction(async (tx) => {
      await tx.workAssignment.update({
        where: { id: assignment.id },
        data: { status: "revision_requested" },
      });
      await tx.workAssignmentEvent.create({
        data: {
          workAssignmentId: assignment.id,
          actorId: userId,
          action: "revision_requested",
          note,
        },
      });
    });

    return this.withDetails(userId, assignment.id);
  }

  async claimPaid(userId: string, id: string, dto: ClaimPaymentDto) {
    const assignment = await this.getOwnAssignment(userId, id);
    if (assignment.createdById !== userId) {
      throw new ForbiddenException("Only the company can claim a payment as sent");
    }
    return this.processPaymentClaim(id, userId, dto.utr, "client");
  }

  async claimReceived(userId: string, id: string, dto: ClaimPaymentDto) {
    await this.getOwnAssignment(userId, id);
    const user = await this.prisma.db.user.findUnique({ where: { id: userId } });
    if (user?.role !== "freelancer") {
      throw new ForbiddenException("Only the freelancer can claim a payment as received");
    }
    return this.processPaymentClaim(id, userId, dto.utr, "freelancer");
  }

  async getPayment(userId: string, id: string) {
    const assignment = await this.getOwnAssignment(userId, id);
    const payment = await this.prisma.db.paymentVerification.findUnique({
      where: { workAssignmentId: id },
    });
    return payment
      ? this.paymentResponse(payment, assignment.createdById === userId ? "client" : "freelancer")
      : null;
  }

  async financialHistory(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (user?.role !== "freelancer" && user?.role !== "client") {
      throw new ForbiddenException("Only marketplace participants can view financial history");
    }

    const assignments = await this.prisma.db.workAssignment.findMany({
      where: {
        conversation: {
          connection: { OR: [{ requesterId: userId }, { receiverId: userId }] },
        },
      },
      include: {
        paymentVerification: true,
        deliverables: { select: { submittedAt: true }, orderBy: { submittedAt: "desc" }, take: 1 },
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

    const history = assignments.map((assignment) => {
      const connection = assignment.conversation.connection;
      const counterparty = connection.requester.id === userId ? connection.receiver : connection.requester;
      const party = assignment.createdById === userId ? "client" : "freelancer";
      const payment = assignment.paymentVerification;
      return {
        id: assignment.id,
        title: assignment.title,
        amount: Number(assignment.budgetAmount),
        currency: assignment.currency,
        assignmentStatus: assignment.status,
        createdAt: assignment.createdAt,
        updatedAt: assignment.updatedAt,
        deliverableSubmittedAt: assignment.deliverables[0]?.submittedAt ?? null,
        counterpartyName: counterparty.name,
        payment: payment ? this.paymentResponse(payment, party) : null,
      };
    });
    const verified = history.filter((item) => item.payment?.status === "verified");
    const active = history.filter((item) => !TERMINAL_STATUSES.includes(item.assignmentStatus));
    const pending = history.filter((item) => item.assignmentStatus === "payment_pending");
    return {
      role: user.role,
      summary: {
        totalAssignments: history.length,
        activeAssignments: active.length,
        completedAssignments: history.filter((item) => item.assignmentStatus === "completed").length,
        verifiedAmount: verified.reduce((total, item) => total + item.amount, 0),
        pendingAmount: pending.reduce((total, item) => total + item.amount, 0),
        activeWorkValue: active.reduce((total, item) => total + item.amount, 0),
        averageCompletedAssignmentValue: verified.length
          ? verified.reduce((total, item) => total + item.amount, 0) / verified.length
          : 0,
      },
      history,
    };
  }

  private async processPaymentClaim(
    assignmentId: string,
    actorId: string,
    utr: string,
    party: "client" | "freelancer",
  ) {
    const payment = await this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "PaymentVerification" WHERE "workAssignmentId" = ${assignmentId} FOR UPDATE`;

      const assignment = await tx.workAssignment.findUnique({
        where: { id: assignmentId },
        select: { status: true },
      });
      if (!assignment) {
        throw new NotFoundException("Work assignment not found");
      }
      this.assertPaymentOpen(assignment.status);

      const existing = await tx.paymentVerification.findUnique({
        where: { workAssignmentId: assignmentId },
      });
      if (!existing) {
        throw new NotFoundException("Payment verification record not found");
      }

      const claimedAt = new Date();
      let updated = await tx.paymentVerification.update({
        where: { id: existing.id },
        data:
          party === "client"
            ? {
                clientUtr: utr,
                clientClaimedAt: claimedAt,
                status: existing.freelancerUtr ? existing.status : "awaiting_freelancer",
              }
            : {
                freelancerUtr: utr,
                freelancerClaimedAt: claimedAt,
                status: existing.clientUtr ? existing.status : "awaiting_client",
              },
      });
      await tx.workAssignmentEvent.create({
        data: {
          workAssignmentId: assignmentId,
          actorId,
          action: party === "client" ? "payment_claimed_paid" : "payment_claimed_received",
        },
      });

      if (!updated.clientUtr || !updated.freelancerUtr) {
        return updated;
      }

      if (updated.clientUtr === updated.freelancerUtr) {
        updated = await tx.paymentVerification.update({
          where: { id: updated.id },
          data: { status: "verified", verifiedAt: new Date() },
        });
        await tx.workAssignment.update({
          where: { id: assignmentId },
          data: { status: "completed" },
        });
        await tx.workAssignmentEvent.create({
          data: { workAssignmentId: assignmentId, actorId, action: "payment_verified" },
        });
        return updated;
      }

      const mismatchCount = updated.mismatchCount + 1;
      updated = await tx.paymentVerification.update({
        where: { id: updated.id },
        data: {
          status: "mismatch",
          mismatchCount,
          clientUtr: null,
          clientClaimedAt: null,
          freelancerUtr: null,
          freelancerClaimedAt: null,
        },
      });
      await tx.workAssignmentEvent.create({
        data: { workAssignmentId: assignmentId, actorId, action: "payment_mismatch" },
      });

      if (mismatchCount >= MISMATCH_THRESHOLD) {
        await tx.workAssignment.update({
          where: { id: assignmentId },
          data: { status: "disputed" },
        });
        await tx.workAssignmentEvent.create({
          data: { workAssignmentId: assignmentId, actorId, action: "payment_disputed" },
        });
      }

      return updated;
    });

    await this.emitFinancialUpdate(assignmentId);
    return this.paymentResponse(payment, party);
  }

  private assertPaymentOpen(status: string) {
    if (status === "disputed") {
      throw new ConflictException("This payment is disputed and awaiting admin review");
    }
    if (status !== "payment_pending") {
      throw new ConflictException("Payment verification isn't open for this assignment yet");
    }
  }

  private paymentResponse(payment: PaymentVerification, party: "client" | "freelancer") {
    return {
      id: payment.id,
      workAssignmentId: payment.workAssignmentId,
      status: payment.status,
      mismatchCount: payment.mismatchCount,
      verifiedAt: payment.verifiedAt,
      ...(party === "client"
        ? { clientUtr: payment.clientUtr, clientClaimedAt: payment.clientClaimedAt }
        : {
            freelancerUtr: payment.freelancerUtr,
            freelancerClaimedAt: payment.freelancerClaimedAt,
          }),
    };
  }

  private redactAssignmentPayment<
    T extends { createdById: string; paymentVerification: PaymentVerification | null },
  >(assignment: T, userId: string) {
    return {
      ...assignment,
      paymentVerification: assignment.paymentVerification
        ? this.paymentResponse(
            assignment.paymentVerification,
            assignment.createdById === userId ? "client" : "freelancer",
          )
        : null,
    };
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

  private async withDetails(userId: string, id: string) {
    const assignment = await this.prisma.db.workAssignment.findUnique({
      where: { id },
      include: FULL_INCLUDE,
    });
    return assignment ? this.redactAssignmentPayment(assignment, userId) : null;
  }

  private async emitFinancialUpdate(assignmentId: string) {
    if (!this.realtimeGateway) return;
    const assignment = await this.prisma.db.workAssignment.findUnique({
      where: { id: assignmentId },
      select: { conversation: { select: { connection: { select: { requesterId: true, receiverId: true } } } } },
    });
    if (!assignment) return;
    const connection = assignment.conversation.connection;
    this.realtimeGateway.emitWorkAssignmentUpdated(
      [connection.requesterId, connection.receiverId],
      assignmentId,
    );
  }
}
