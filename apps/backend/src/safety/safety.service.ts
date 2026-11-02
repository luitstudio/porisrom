import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, HttpException } from "@nestjs/common";
import type { Notification, Prisma, SafetyCaseKind } from "@porisrom/database";
import { createHash } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { auditedAdminMutation } from "../admin/audited-mutation";
import { lockMarketplacePair, hasParticipantBlock, isActiveMarketplacePair } from "../marketplace-access";
import type { ReportUserDto, ReviewSafetyCaseDto, SupportCaseDto } from "./safety.dto";

const TERMINAL = ["completed", "cancelled", "rejected"];
const receipt = (row: { id: string; status: string }) => ({ id: row.id, status: row.status });
const CASE_INCLUDE = { reporter: { select: { id: true, name: true, role: true } }, targetUser: { select: { id: true, name: true, role: true } },
  assignment: { select: { id: true, title: true, status: true, paymentVerification: { select: { id: true, status: true } } } } } as const;

@Injectable()
export class SafetyService {
  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway) {}

  private async caller(tx: Prisma.TransactionClient, id: string) {
    const user = await tx.user.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
    if (!user || user.status !== "active" || !["client", "freelancer"].includes(user.role ?? "")) throw new ForbiddenException("Active marketplace account required");
    return user;
  }
  private async quota(tx: Prisma.TransactionClient, actorId: string) {
    const count = await tx.safetyCase.count({ where: { reporterId: actorId, createdAt: { gte: new Date(Date.now() - 86400000) } } });
    if (count >= 10) throw new HttpException("Daily safety/support request limit reached. Retry later.", 429);
  }
  private emit(notifications: Notification[]) { for (const row of notifications) void this.realtime.emitNotificationCreated(row); }
  private async admins(tx: Prisma.TransactionClient, kind: SafetyCaseKind) {
    const admins = await tx.user.findMany({ where: { role: "admin", status: "active" }, select: { id: true } });
    const notifications = [];
    for (const admin of admins) notifications.push(await tx.notification.create({ data: {
      userId: admin.id, type: "safety_case_opened", message: `A new ${kind.replaceAll("_", " ")} requires administrative review.`,
    } }));
    return notifications;
  }
  async listBlocks(actorId: string) {
    return this.prisma.db.userBlock.findMany({ where: { blockerId: actorId, unblockedAt: null },
      select: { id: true, blockedUserId: true, createdAt: true, blockedUser: { select: { name: true } } }, orderBy: { createdAt: "desc" } });
  }
  async block(actorId: string, targetId: string) {
    if (actorId === targetId) throw new BadRequestException("You cannot block yourself");
    return this.prisma.db.$transaction(async (tx) => {
      await lockMarketplacePair(tx, { requesterId: actorId, receiverId: targetId });
      const actor = await this.caller(tx, actorId);
      const target = await this.caller(tx, targetId);
      if (actor.role === target.role) throw new BadRequestException("Choose a marketplace counterpart");
      const activeKey = JSON.stringify([actorId, targetId]);
      const existing = await tx.userBlock.findUnique({ where: { activeKey } });
      if (existing) return { id: existing.id, blockedUserId: targetId };
      if (await tx.userBlock.count({ where: { blockerId: actorId, createdAt: { gte: new Date(Date.now() - 86400000) } } }) >= 50) throw new HttpException("Daily block limit reached", 429);
      const block = await tx.userBlock.create({ data: { blockerId: actorId, blockedUserId: targetId, activeKey } });
      return { id: block.id, blockedUserId: targetId };
    });
  }
  async unblock(actorId: string, blockId: string) {
    return this.prisma.db.$transaction(async (tx) => {
      const block = await tx.userBlock.findUnique({ where: { id: blockId } });
      if (!block) throw new NotFoundException("Block not found");
      if (block.blockerId !== actorId) throw new ForbiddenException("Only the account that created a block can remove it");
      await lockMarketplacePair(tx, { requesterId: actorId, receiverId: block.blockedUserId });
      await this.caller(tx, actorId);
      await tx.userBlock.updateMany({ where: { id: blockId, blockerId: actorId, unblockedAt: null }, data: { unblockedAt: new Date(), activeKey: null } });
      return { unblocked: true };
    });
  }
  async report(actorId: string, dto: ReportUserDto) {
    if (actorId === dto.targetUserId) throw new BadRequestException("You cannot report yourself");
    const result = await this.prisma.db.$transaction(async (tx) => {
      await lockMarketplacePair(tx, { requesterId: actorId, receiverId: dto.targetUserId });
      await this.caller(tx, actorId);
      const target = await tx.user.findUnique({ where: { id: dto.targetUserId }, select: { role: true } });
      if (!target || !["client", "freelancer"].includes(target.role ?? "")) throw new NotFoundException("Marketplace user not found");
      let conversationId = dto.conversationId;
      if (dto.assignmentId) {
        const assignment = await tx.workAssignment.findUnique({ where: { id: dto.assignmentId }, select: { conversationId: true } });
        if (!assignment) throw new NotFoundException("Assignment not found");
        if (conversationId && conversationId !== assignment.conversationId) throw new BadRequestException("Context does not match");
        conversationId = assignment.conversationId;
      }
      if (conversationId) {
        const conversation = await tx.conversation.findUnique({ where: { id: conversationId }, include: { connection: true } });
        if (!conversation || ![conversation.connection.requesterId, conversation.connection.receiverId].includes(actorId) ||
            ![conversation.connection.requesterId, conversation.connection.receiverId].includes(dto.targetUserId)) throw new ForbiddenException("Report context must belong to these participants");
      }
      const activeKey = JSON.stringify(["report", actorId, dto.targetUserId, dto.category]);
      const existing = await tx.safetyCase.findUnique({ where: { activeKey } });
      if (existing) return { row: existing, notifications: [] };
      await this.quota(tx, actorId);
      const row = await tx.safetyCase.create({ data: { kind: "user_report", reporterId: actorId, targetUserId: dto.targetUserId,
        category: dto.category, reason: dto.reason, conversationId, assignmentId: dto.assignmentId, activeKey } });
      await tx.safetyCaseEvent.create({ data: { caseId: row.id, actorId, action: "submitted" } });
      return { row, notifications: await this.admins(tx, "user_report") };
    });
    this.emit(result.notifications); return receipt(result.row);
  }
  async support(actorId: string, dto: SupportCaseDto) {
    const result = await this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${actorId} FOR UPDATE`;
      await this.caller(tx, actorId);
      const activeKey = `support:${actorId}:${createHash("sha256").update(dto.category + dto.reason).digest("hex")}`;
      const existing = await tx.safetyCase.findUnique({ where: { activeKey } });
      if (existing) return { row: existing, notifications: [] };
      await this.quota(tx, actorId);
      const row = await tx.safetyCase.create({ data: { kind: "support", reporterId: actorId, category: dto.category, reason: dto.reason, activeKey } });
      await tx.safetyCaseEvent.create({ data: { caseId: row.id, actorId, action: "submitted" } });
      return { row, notifications: await this.admins(tx, "support") };
    });
    this.emit(result.notifications); return receipt(result.row);
  }
  private async ownAssignment(tx: Prisma.TransactionClient, actorId: string, id: string) {
    const assignment = await tx.workAssignment.findUnique({ where: { id }, include: { conversation: { include: { connection: true } } } });
    if (!assignment) throw new NotFoundException("Assignment not found");
    const pair = assignment.conversation.connection;
    if (![pair.requesterId, pair.receiverId].includes(actorId)) throw new ForbiddenException("Assignment participants only");
    await lockMarketplacePair(tx, pair);
    await tx.$queryRaw`SELECT "id" FROM "WorkAssignment" WHERE "id" = ${id} FOR UPDATE`;
    await this.caller(tx, actorId);
    return tx.workAssignment.findUniqueOrThrow({ where: { id }, include: { conversation: { include: { connection: true } } } });
  }
  async escalate(actorId: string, assignmentId: string, reason: string) {
    const result = await this.prisma.db.$transaction(async (tx) => {
      const assignment = await this.ownAssignment(tx, actorId, assignmentId);
      if (TERMINAL.includes(assignment.status) || assignment.status === "disputed") throw new ConflictException("Use the applicable payment dispute/history workflow for this assignment");
      const latest = await tx.workAssignmentEvent.findFirst({ where: { workAssignmentId: assignmentId, action: { in: ["cancel_requested", "cancel_rejected", "cancelled"] } }, orderBy: { createdAt: "desc" } });
      const pairAccounts = await tx.user.findMany({ where: { id: { in: [assignment.conversation.connection.requesterId, assignment.conversation.connection.receiverId] } }, select: { status: true, role: true } });
      const frozen = !isActiveMarketplacePair(pairAccounts) || await hasParticipantBlock(tx, assignment.conversation.connection);
      if (!assignment.cancelRequestedById && latest?.action !== "cancel_rejected" && !frozen) throw new ConflictException("Request cancellation before escalating it");
      const activeKey = `cancellation:${assignmentId}`;
      const existing = await tx.safetyCase.findUnique({ where: { activeKey } });
      if (existing) return { row: existing, notifications: [] };
      await this.quota(tx, actorId);
      const row = await tx.safetyCase.create({ data: { kind: "cancellation", reporterId: actorId, assignmentId,
        conversationId: assignment.conversationId, category: "cancellation", reason, activeKey } });
      await tx.safetyCaseEvent.create({ data: { caseId: row.id, actorId, action: "escalated" } });
      await tx.workAssignmentEvent.create({ data: { workAssignmentId: assignmentId, actorId, action: "cancellation_escalated", note: reason } });
      const notifications = await this.admins(tx, "cancellation");
      const pair = assignment.conversation.connection;
      for (const userId of [pair.requesterId, pair.receiverId]) notifications.push(await tx.notification.create({ data: {
        userId, type: "cancellation_escalated", message: "A shared assignment cancellation was sent for administrative review. No funds or assignment state were changed.",
      } }));
      return { row, notifications };
    });
    this.emit(result.notifications); return receipt(result.row);
  }
  async listMine(actorId: string) {
    return this.prisma.db.safetyCase.findMany({ where: { OR: [
      { kind: "support", reporterId: actorId },
      { kind: "cancellation", assignment: { conversation: { connection: { OR: [{ requesterId: actorId }, { receiverId: actorId }] } } } },
    ] }, include: { events: { orderBy: { createdAt: "asc" } } }, orderBy: { createdAt: "desc" }, take: 50 });
  }
  listAdmin(kind?: SafetyCaseKind) {
    return this.prisma.db.safetyCase.findMany({ where: { kind }, include: CASE_INCLUDE, orderBy: [{ status: "asc" }, { createdAt: "asc" }], take: 100 });
  }
  async detailAdmin(id: string) {
    const row = await this.prisma.db.safetyCase.findUnique({ where: { id }, include: { ...CASE_INCLUDE, events: { orderBy: { createdAt: "asc" } } } });
    if (!row) throw new NotFoundException("Case not found"); return row;
  }
  async review(adminId: string, id: string, dto: ReviewSafetyCaseDto) {
    const result = await auditedAdminMutation(this.prisma.db, adminId, "review_safety_case", undefined,
      { caseId: id, decision: dto.decision, reason: dto.reason, before: { status: "open" }, after: { status: dto.decision === "dismiss" ? "dismissed" : "resolved" } }, async (tx) => {
        const initial = await tx.safetyCase.findUnique({ where: { id } });
        if (!initial) throw new NotFoundException("Case not found");
        let assignment;
        if (initial.kind === "cancellation" && initial.assignmentId) {
          const current = await tx.workAssignment.findUniqueOrThrow({ where: { id: initial.assignmentId }, include: { conversation: { include: { connection: true } } } });
          await lockMarketplacePair(tx, current.conversation.connection);
          await tx.$queryRaw`SELECT "id" FROM "WorkAssignment" WHERE "id" = ${initial.assignmentId} FOR UPDATE`;
          assignment = await tx.workAssignment.findUniqueOrThrow({ where: { id: initial.assignmentId }, include: { conversation: { include: { connection: true } } } });
        }
        await tx.$queryRaw`SELECT "id" FROM "SafetyCase" WHERE "id" = ${id} FOR UPDATE`;
        const row = await tx.safetyCase.findUniqueOrThrow({ where: { id } });
        if (row.status !== "open") throw new ConflictException("Case already reviewed");
        if (row.kind === "cancellation" && !["cancel_assignment", "deny_cancellation", "dismiss"].includes(dto.decision)) throw new BadRequestException("Select a cancellation decision");
        if (row.kind !== "cancellation" && !["resolve", "dismiss"].includes(dto.decision)) throw new BadRequestException("This case cannot change assignment state");
        const notifications: Notification[] = [];
        if (dto.decision === "cancel_assignment") {
          if (!assignment || TERMINAL.includes(assignment.status) || assignment.status === "disputed") throw new ConflictException("This assignment changed or requires payment dispute resolution");
          await tx.workAssignment.update({ where: { id: assignment.id }, data: { status: "cancelled" } });
        } else if (dto.decision === "deny_cancellation") {
          if (!assignment || TERMINAL.includes(assignment.status) || assignment.status === "disputed") throw new ConflictException("This assignment changed or requires payment dispute resolution");
          await tx.workAssignment.update({ where: { id: assignment.id }, data: { cancelRequestedById: null } });
        }
        if (assignment) {
          await tx.workAssignmentEvent.create({ data: { workAssignmentId: assignment.id, actorId: adminId,
            action: dto.decision === "cancel_assignment" ? "admin_cancelled" : "admin_cancellation_reviewed", note: dto.reason } });
          const pair = assignment.conversation.connection;
          for (const userId of [pair.requesterId, pair.receiverId]) notifications.push(await tx.notification.create({ data: {
            userId, type: "cancellation_reviewed", message: "An administrator reviewed the shared cancellation. See assignment history; no bank transfer, refund, or settlement was performed.",
          } }));
        } else notifications.push(await tx.notification.create({ data: { userId: row.reporterId, type: "safety_case_reviewed",
          message: row.kind === "user_report" ? "Your report has been reviewed." : "Your support case has been reviewed. Open your case history for the response.",
        } }));
        const updated = await tx.safetyCase.update({ where: { id }, data: { status: dto.decision === "dismiss" ? "dismissed" : "resolved",
          activeKey: null, reviewedById: adminId, reviewedAt: new Date(), decision: dto.decision, decisionReason: dto.reason } });
        await tx.safetyCaseEvent.create({ data: { caseId: id, actorId: adminId, action: dto.decision, note: dto.reason } });
        return { updated, notifications, participants: assignment ? [assignment.conversation.connection.requesterId, assignment.conversation.connection.receiverId] : [] };
      });
    this.emit(result.notifications);
    if (result.updated.assignmentId) void this.realtime.emitWorkAssignmentUpdated(result.participants, result.updated.assignmentId);
    return result.updated;
  }
}
