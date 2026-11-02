import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string) {
    const notifications = await this.prisma.db.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      include: {
        readStates: {
          where: { userId },
          select: { readAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return notifications.map(({ readStates, ...notification }) => ({
      ...notification,
      isRead: notification.userId === null ? readStates.length > 0 : notification.isRead,
    }));
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.db.notification.findUnique({ where: { id } });
    if (!notification || (notification.userId !== null && notification.userId !== userId)) {
      throw new NotFoundException("Notification not found");
    }
    if (notification.userId === null) {
      await this.prisma.db.notificationReadState.upsert({
        where: { notificationId_userId: { notificationId: id, userId } },
        create: { notificationId: id, userId },
        update: { readAt: new Date() },
      });
      return { ...notification, isRead: true };
    }

    return this.prisma.db.notification.update({ where: { id }, data: { isRead: true } });
  }
}
