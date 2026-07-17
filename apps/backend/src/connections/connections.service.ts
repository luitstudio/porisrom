import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

const COOLDOWN_DAYS = 14;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const CONNECTION_INCLUDE = {
  requester: { select: { id: true, name: true, role: true } },
  receiver: { select: { id: true, name: true, role: true } },
  conversation: { select: { id: true } },
} as const;

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(requesterId: string, receiverId: string) {
    if (requesterId === receiverId) {
      throw new BadRequestException("Cannot connect with yourself");
    }

    const [requester, receiver] = await Promise.all([
      this.prisma.db.user.findUnique({ where: { id: requesterId } }),
      this.prisma.db.user.findUnique({ where: { id: receiverId } }),
    ]);

    if (!receiver) {
      throw new NotFoundException("User not found");
    }
    if (!requester?.role || !receiver.role || requester.role === receiver.role) {
      throw new BadRequestException(
        "Connections are only allowed between a freelancer and a company",
      );
    }

    const existing = await this.prisma.db.connection.findFirst({
      where: {
        OR: [
          { requesterId, receiverId },
          { requesterId: receiverId, receiverId: requesterId },
        ],
      },
    });

    if (existing) {
      if (existing.status === "pending" || existing.status === "accepted") {
        throw new ConflictException("A connection already exists between these users");
      }

      // declined: only enforce the cooldown if the same person is retrying —
      // the other party initiating fresh is a legitimate new action, not spam.
      if (existing.requesterId === requesterId && existing.respondedAt) {
        const elapsed = Date.now() - existing.respondedAt.getTime();
        if (elapsed < COOLDOWN_MS) {
          const daysLeft = Math.ceil((COOLDOWN_MS - elapsed) / (24 * 60 * 60 * 1000));
          throw new ConflictException(`You can re-send this request in ${daysLeft} day(s)`);
        }
      }

      return this.prisma.db.connection.update({
        where: { id: existing.id },
        data: { requesterId, receiverId, status: "pending", respondedAt: null },
        include: CONNECTION_INCLUDE,
      });
    }

    return this.prisma.db.connection.create({
      data: { requesterId, receiverId },
      include: CONNECTION_INCLUDE,
    });
  }

  listMine(userId: string) {
    return this.prisma.db.connection.findMany({
      where: { OR: [{ requesterId: userId }, { receiverId: userId }] },
      include: CONNECTION_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async accept(userId: string, connectionId: string) {
    await this.getOwnPendingConnection(userId, connectionId);

    // Conversation must be created first within the transaction so the connection
    // update's `conversation` include below actually sees it, rather than null.
    const [, updated] = await this.prisma.db.$transaction([
      this.prisma.db.conversation.create({ data: { connectionId } }),
      this.prisma.db.connection.update({
        where: { id: connectionId },
        data: { status: "accepted", respondedAt: new Date() },
        include: CONNECTION_INCLUDE,
      }),
    ]);

    return updated;
  }

  async decline(userId: string, connectionId: string) {
    await this.getOwnPendingConnection(userId, connectionId);

    return this.prisma.db.connection.update({
      where: { id: connectionId },
      data: { status: "declined", respondedAt: new Date() },
      include: CONNECTION_INCLUDE,
    });
  }

  private async getOwnPendingConnection(userId: string, connectionId: string) {
    const connection = await this.prisma.db.connection.findUnique({ where: { id: connectionId } });
    if (!connection) {
      throw new NotFoundException("Connection not found");
    }
    if (connection.receiverId !== userId) {
      throw new ForbiddenException("Only the receiver can respond to this connection request");
    }
    if (connection.status !== "pending") {
      throw new ConflictException("This connection request has already been responded to");
    }
    return connection;
  }
}
