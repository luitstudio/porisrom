import { ConflictException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { isActiveMarketplacePair, lockMarketplacePair } from "../marketplace-access";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { ResolvePaymentDisputeDto } from "./dto/resolve-payment-dispute.dto";

const DETAILS = {
  workAssignment: { include: { conversation: { include: { connection: true } } } },
  claims: { orderBy: { createdAt: "asc" as const } },
} as const;

@Injectable()
export class PaymentDisputesService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly realtime?: RealtimeGateway) {}

  async details(paymentId: string) {
    const payment = await this.prisma.db.paymentVerification.findUnique({ where: { id: paymentId }, include: DETAILS });
    if (!payment) throw new NotFoundException("Payment record not found");
    const decisions = await this.prisma.db.adminActionLog.findMany({
      where: { action: "resolve_payment_dispute", metadata: { path: ["paymentVerificationId"], equals: paymentId } },
      orderBy: { createdAt: "asc" },
    });
    return { ...payment, decisions };
  }

  async resolve(adminId: string, paymentId: string, dto: ResolvePaymentDisputeDto) {
    const result = await this.prisma.db.$transaction(async (tx) => {
      const admin = await tx.user.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
      if (admin?.role !== "admin" || admin.status !== "active") throw new ForbiddenException("Active administrator required");
      const initial = await tx.paymentVerification.findUnique({ where: { id: paymentId }, include: { workAssignment: { include: { conversation: { include: { connection: true } } } } } });
      if (!initial) throw new NotFoundException("Payment record not found");
      const pair = initial.workAssignment.conversation.connection;
      await lockMarketplacePair(tx, pair);
      const participants = await tx.user.findMany({ where: { id: { in: [pair.requesterId, pair.receiverId] } }, select: { role: true, status: true } });
      const validRoles = participants.length === 2 && participants.some((p) => p.role === "client") && participants.some((p) => p.role === "freelancer");
      if (!validRoles) throw new ConflictException("Assignment participants are not a valid marketplace pair");
      if (dto.outcome === "reopen_claims" && !isActiveMarketplacePair(participants)) throw new ConflictException("Cannot reopen claims while a participant is unavailable");
      await tx.$queryRaw`SELECT "id" FROM "PaymentVerification" WHERE "id" = ${paymentId} FOR UPDATE`;
      await tx.$queryRaw`SELECT "id" FROM "WorkAssignment" WHERE "id" = ${initial.workAssignmentId} FOR UPDATE`;
      const payment = await tx.paymentVerification.findUniqueOrThrow({ where: { id: paymentId }, include: { workAssignment: true } });
      if (payment.workAssignment.status !== "disputed" || payment.status !== "mismatch" || payment.mismatchCount !== dto.expectedMismatchCount) {
        throw new ConflictException("This dispute changed or has already been resolved. Reload before deciding.");
      }
      const assignmentStatus = dto.outcome === "complete" ? "completed" : "payment_pending";
      const paymentStatus = dto.outcome === "complete" ? "administratively_resolved" : payment.clientUtr ? "awaiting_freelancer" : "awaiting_client";
      const updated = await tx.paymentVerification.update({ where: { id: paymentId }, data: {
        status: paymentStatus,
        ...(dto.outcome === "reopen_claims" ? { mismatchCountAtReopen: payment.mismatchCount } : {}),
      } });
      await tx.workAssignment.update({ where: { id: payment.workAssignmentId }, data: { status: assignmentStatus } });
      await tx.workAssignmentEvent.create({ data: { workAssignmentId: payment.workAssignmentId, actorId: adminId,
        action: dto.outcome === "complete" ? "payment_administratively_resolved" : "payment_dispute_reopened", note: dto.reason } });
      const audit = await tx.adminActionLog.create({ data: { adminId, action: "resolve_payment_dispute", metadata: {
        paymentVerificationId: paymentId, workAssignmentId: payment.workAssignmentId, outcome: dto.outcome, reason: dto.reason,
        before: { assignmentStatus: payment.workAssignment.status, paymentStatus: payment.status, mismatchCount: payment.mismatchCount },
        after: { assignmentStatus, paymentStatus, mismatchCount: payment.mismatchCount },
      } } });
      const notifications = [];
      for (const userId of [pair.requesterId, pair.receiverId]) notifications.push(await tx.notification.create({ data: {
        userId, type: "payment_dispute_resolved", createdBy: adminId,
        message: dto.outcome === "complete"
          ? "An administrator completed manual review and marked your assignment completed. This does not verify bank settlement."
          : "An administrator reopened payment-reference claims for your assignment. Check the assignment history for the decision.",
      } }));
      return { payment: updated, auditId: audit.id, notifications, userIds: [pair.requesterId, pair.receiverId] };
    });
    for (const notification of result.notifications) void this.realtime?.emitNotificationCreated(notification);
    void this.realtime?.emitWorkAssignmentUpdated(result.userIds, result.payment.workAssignmentId);
    return { payment: result.payment, auditId: result.auditId };
  }
}
