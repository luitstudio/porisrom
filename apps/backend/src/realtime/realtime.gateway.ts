import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WebSocketGateway, type OnGatewayConnection, type OnGatewayInit } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../auth/auth.service";
import { frontendOrigins } from "../auth/production-auth-config";

type AuthenticatedSocketUser = {
  userId: string;
  role: string | null;
};

type SocketHandshake = Pick<Socket["handshake"], "auth" | "headers">;

type PersistedMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  body: string;
  createdAt: Date;
  readAt: Date | null;
};

type PersistedNotification = {
  id: string;
  userId: string | null;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
};

@Injectable()
@WebSocketGateway({
  cors: {
    origin: frontendOrigins(),
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  private server?: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    server.use((socket, next) => {
      void this.authenticate(socket)
        .then(() => next())
        .catch(() => next(new Error("Unauthorized")));
    });
  }

  private async authenticate(socket: Socket) {
    const token = this.extractAccessToken(socket.handshake);
    if (!token) {
      throw new Error("Unauthorized");
    }

    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.configService.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
    } catch {
      throw new Error("Unauthorized");
    }

    if (!payload.sub || typeof payload.sub !== "string") {
      throw new Error("Unauthorized");
    }

    const user = await this.prisma.db.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, status: true },
    });
    if (!user || user.status !== "active") {
      throw new Error("Unauthorized");
    }

    socket.data.user = { userId: user.id, role: user.role } satisfies AuthenticatedSocketUser;
  }

  handleConnection(socket: Socket) {
    const user = socket.data.user as AuthenticatedSocketUser | undefined;
    if (user?.userId) {
      socket.join(this.userRoom(user.userId));
    }
  }

  async emitMessageCreated(message: PersistedMessage) {
    try {
      const conversation = await this.prisma.db.conversation.findUnique({
        where: { id: message.conversationId },
        select: { connection: { select: { requesterId: true, receiverId: true } } },
      });
      if (!conversation || !this.server) {
        return;
      }

      const { requesterId, receiverId } = conversation.connection;
      const recipientId = requesterId === message.senderId
        ? receiverId
        : receiverId === message.senderId
          ? requesterId
          : null;
      if (!recipientId) {
        return;
      }

      this.server.to(this.userRoom(recipientId)).emit("message.created", {
        id: message.id,
        conversationId: message.conversationId,
        senderId: message.senderId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
        readAt: message.readAt?.toISOString() ?? null,
      });
    } catch {
      // Realtime delivery is best-effort; REST polling remains the recovery path.
    }
  }

  emitNotificationCreated(notification: PersistedNotification) {
    if (!notification.userId || !this.server) {
      return;
    }
    this.server.to(this.userRoom(notification.userId)).emit("notification.created", {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    });
  }

  emitWorkAssignmentUpdated(userIds: string[], workAssignmentId: string) {
    if (!this.server) return;
    for (const userId of new Set(userIds)) {
      this.server.to(this.userRoom(userId)).emit("work-assignment.updated", { workAssignmentId });
    }
  }

  private extractAccessToken(handshake: SocketHandshake) {
    const authToken = handshake.auth?.token;
    if (typeof authToken === "string") {
      return authToken.trim() || null;
    }

    const authorization = handshake.headers.authorization;
    if (typeof authorization === "string") {
      return this.normalizeBearerToken(authorization);
    }

    const cookieHeader = handshake.headers.cookie;
    if (typeof cookieHeader !== "string") {
      return null;
    }
    const accessCookie = cookieHeader
      .split(";")
      .map((cookie) => cookie.trim())
      .find((cookie) => cookie.startsWith("access_token="));
    return accessCookie ? decodeURIComponent(accessCookie.slice("access_token=".length)) : null;
  }

  private normalizeBearerToken(value: string) {
    const match = /^Bearer\s+(.+)$/i.exec(value.trim());
    return match?.[1]?.trim() || null;
  }

  private userRoom(userId: string) {
    return `user:${userId}`;
  }
}
