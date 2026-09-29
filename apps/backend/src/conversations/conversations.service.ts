import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

@Injectable()
export class ConversationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  listMine(userId: string) {
    return this.prisma.db.conversation.findMany({
      where: {
        connection: { OR: [{ requesterId: userId }, { receiverId: userId }] },
      },
      include: {
        connection: {
          include: {
            requester: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
        },
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async listMessages(userId: string, conversationId: string) {
    await this.assertParticipant(userId, conversationId);
    return this.prisma.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendMessage(userId: string, conversationId: string, body: string) {
    const conversation = await this.assertParticipant(userId, conversationId);
    const recipientId =
      conversation.connection.requesterId === userId
        ? conversation.connection.receiverId
        : conversation.connection.requesterId;
    const result = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.message.create({
        data: { conversationId, senderId: userId, body },
      });
      const notification = await tx.notification.create({
        data: {
          userId: recipientId,
          type: "message_received",
          message: "You received a new message.",
        },
      });
      return { message: created, notification };
    });
    void this.realtimeGateway.emitMessageCreated(result.message);
    this.realtimeGateway.emitNotificationCreated(result.notification);
    return result.message;
  }

  private async assertParticipant(userId: string, conversationId: string) {
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
}
