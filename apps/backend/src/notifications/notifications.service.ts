import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  listMine(userId: string) {
    return this.prisma.db.notification.findMany({
      where: { OR: [{ userId }, { userId: null }] },
      orderBy: { createdAt: "desc" },
    });
  }

  async markRead(userId: string, id: string) {
    const notification = await this.prisma.db.notification.findUnique({ where: { id } });
    if (!notification || (notification.userId !== null && notification.userId !== userId)) {
      throw new NotFoundException("Notification not found");
    }
    return this.prisma.db.notification.update({ where: { id }, data: { isRead: true } });
  }
}
