import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from "@nestjs/common";
import type { Prisma } from "@porishrom/database";

import { PrismaService } from "../prisma/prisma.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";

const COOLDOWN_DAYS = 14;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

const CONNECTION_INCLUDE = {
  requester: { select: { id: true, name: true, role: true } },
  receiver: { select: { id: true, name: true, role: true } },
  conversation: { select: { id: true } },
} as const;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly realtimeGateway?: RealtimeGateway,
  ) {}

  async create(requesterId: string, receiverId: string) {
    if (requesterId === receiverId) {
      throw new BadRequestException("Cannot connect with yourself");
    }

    const pairKey = JSON.stringify([requesterId, receiverId].sort());

    const result = await this.prisma.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${pairKey}, 0))::text AS lock_value`;

      const [requester, receiver] = await Promise.all([
        tx.user.findUnique({
          where: { id: requesterId },
          select: { id: true, role: true, status: true },
        }),
        tx.user.findUnique({
          where: { id: receiverId },
          select: { id: true, role: true, status: true },
        }),
      ]);

      if (
        !requester ||
        requester.status !== "active" ||
        (requester.role !== "freelancer" && requester.role !== "client")
      ) {
        throw new ForbiddenException("Your account cannot create connections");
      }
      if (!receiver) {
        throw new NotFoundException("User not found");
      }

      const expectedReceiverRole = requester.role === "freelancer" ? "client" : "freelancer";
      if (receiver.status !== "active" || receiver.role !== expectedReceiverRole) {
        throw new BadRequestException(
          "Connections are only allowed between active freelancers and companies",
        );
      }

      const existing = await tx.connection.findFirst({
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

        const connection = await tx.connection.update({
          where: { id: existing.id },
          data: { requesterId, receiverId, status: "pending", respondedAt: null },
          include: CONNECTION_INCLUDE,
        });
        const notification = await tx.notification.create({
          data: {
            userId: receiverId,
            type: "connection_requested",
            message: "You have a new connection request.",
          },
        });
        return { connection, notification };
      }

      const connection = await tx.connection.create({
        data: { requesterId, receiverId },
        include: CONNECTION_INCLUDE,
      });
      const notification = await tx.notification.create({
        data: {
          userId: receiverId,
          type: "connection_requested",
          message: "You have a new connection request.",
        },
      });
      return { connection, notification };
    });
    this.realtimeGateway?.emitNotificationCreated(result.notification);
    return result.connection;
  }

  listMine(userId: string) {
    return this.prisma.db.connection.findMany({
      where: { OR: [{ requesterId: userId }, { receiverId: userId }] },
      include: CONNECTION_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
  }

  async accept(userId: string, connectionId: string) {
    const result = await this.prisma.db.$transaction(async (tx) => {
      const connection = await this.lockOwnPendingConnection(tx, userId, connectionId);
      await tx.conversation.create({ data: { connectionId } });
      const updated = await tx.connection.update({
        where: { id: connectionId },
        data: { status: "accepted", respondedAt: new Date() },
        include: CONNECTION_INCLUDE,
      });
      const notification = await tx.notification.create({
        data: {
          userId: connection.requesterId,
          type: "connection_accepted",
          message: "Your connection request was accepted.",
        },
      });
      return { connection: updated, notification };
    });
    this.realtimeGateway?.emitNotificationCreated(result.notification);
    return result.connection;
  }

  async decline(userId: string, connectionId: string) {
    const result = await this.prisma.db.$transaction(async (tx) => {
      const connection = await this.lockOwnPendingConnection(tx, userId, connectionId);
      const updated = await tx.connection.update({
        where: { id: connectionId },
        data: { status: "declined", respondedAt: new Date() },
        include: CONNECTION_INCLUDE,
      });
      const notification = await tx.notification.create({
        data: {
          userId: connection.requesterId,
          type: "connection_declined",
          message: "Your connection request was declined.",
        },
      });
      return { connection: updated, notification };
    });
    this.realtimeGateway?.emitNotificationCreated(result.notification);
    return result.connection;
  }

  private async lockOwnPendingConnection(
    tx: Prisma.TransactionClient,
    userId: string,
    connectionId: string,
  ) {
    await tx.$queryRaw`SELECT "id" FROM "Connection" WHERE "id" = ${connectionId} FOR UPDATE`;
    const connection = await tx.connection.findUnique({
      where: { id: connectionId },
      include: {
        requester: { select: { role: true, status: true } },
        receiver: { select: { role: true, status: true } },
      },
    });
    if (!connection) {
      throw new NotFoundException("Connection not found");
    }
    if (connection.receiverId !== userId) {
      throw new ForbiddenException("Only the receiver can respond to this connection request");
    }
    if (connection.status !== "pending") {
      throw new ConflictException("This connection request has already been responded to");
    }
    const validPair =
      (connection.requester.role === "client" && connection.receiver.role === "freelancer") ||
      (connection.requester.role === "freelancer" && connection.receiver.role === "client");
    if (
      connection.requester.status !== "active" ||
      connection.receiver.status !== "active" ||
      !validPair
    ) {
      throw new ConflictException("This connection request is no longer actionable");
    }
    return connection;
  }
}
