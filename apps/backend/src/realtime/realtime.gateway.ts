import { Injectable, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { WebSocketGateway, type OnGatewayConnection, type OnGatewayInit } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";

import { PrismaService } from "../prisma/prisma.service";
import type { JwtPayload } from "../auth/auth.service";
import { frontendOrigins } from "../auth/production-auth-config";
import { activeSessionUser } from "../auth/session-access";
import { RealtimeClusterService } from "./realtime-cluster.service";
import { hasParticipantBlock } from "../marketplace-access";

type AuthenticatedSocketUser = {
  userId: string;
  role: string | null;
  sessionId: string;
  expiresAt: number;
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
    @Optional() private readonly cluster?: RealtimeClusterService,
  ) {}

  afterInit(server: Server) {
    this.server = server;
    this.cluster?.attach(server);
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

    const user = await activeSessionUser(this.prisma, payload);
    if (!payload.exp || payload.exp * 1000 <= Date.now()) throw new Error("Unauthorized");
    socket.data.user = { userId: user.userId, role: user.role, sessionId: user.sessionId,
      expiresAt: Math.min(payload.exp * 1000, user.sessionExpiresAt.getTime()) } satisfies AuthenticatedSocketUser;
  }

  handleConnection(socket: Socket) {
    const user = socket.data.user as AuthenticatedSocketUser | undefined;
    if (user?.userId) {
      socket.join(this.userRoom(user.userId));
      socket.join(`session:${user.sessionId}`);
      socket.use((_packet, next) => {
        void activeSessionUser(this.prisma, { sub: user.userId, sid: user.sessionId, role: user.role })
          .then(() => { if (user.expiresAt <= Date.now()) throw new Error("Expired session"); next(); })
          .catch(() => { socket.disconnect(true); next(new Error("Unauthorized")); });
      });
      const timer = setTimeout(() => socket.disconnect(true), Math.min(2147483647, Math.max(0, user.expiresAt - Date.now())));
      timer.unref();
      socket.once("disconnect", () => clearTimeout(timer));
    }
  }

  disconnectUser(userId: string) {
    this.server?.in(this.userRoom(userId)).disconnectSockets(true);
  }

  disconnectSession(sessionId: string) {
    this.server?.in(`session:${sessionId}`).disconnectSockets(true);
  }

  private async emitToActiveUser(userId: string, event: string, value: unknown) {
    if (!this.server) return;
    const sockets = await this.server.in(this.userRoom(userId)).fetchSockets();
    for (const socket of sockets) {
      const user = socket.data.user as AuthenticatedSocketUser | undefined;
      try {
        if (!user || user.userId !== userId || user.expiresAt <= Date.now()) throw new Error("Expired session");
        await activeSessionUser(this.prisma, { sub: user.userId, sid: user.sessionId, role: user.role });
        socket.emit(event, value);
      } catch {
        socket.disconnect(true);
      }
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

      const sender = await this.prisma.db.user.findUnique({ where: { id: message.senderId }, select: { status: true } });
      if (sender?.status !== "active") return;
      if (await hasParticipantBlock(this.prisma.db, { requesterId, receiverId })) return;
      await this.emitToActiveUser(recipientId, "message.created", {
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

  async emitNotificationCreated(notification: PersistedNotification) {
    if (!notification.userId || !this.server) {
      return;
    }
    try { await this.emitToActiveUser(notification.userId, "notification.created", {
      id: notification.id,
      type: notification.type,
      message: notification.message,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    }); } catch { /* REST remains the recovery path; never bypass session checks. */ }
  }

  async emitWorkAssignmentUpdated(userIds: string[], workAssignmentId: string) {
    if (!this.server) return;
    for (const userId of new Set(userIds)) {
      try { await this.emitToActiveUser(userId, "work-assignment.updated", { workAssignmentId }); } catch { /* Recover through REST. */ }
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
