import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { NotificationsService } from "../src/notifications/notifications.service";
import type { PrismaService } from "../src/prisma/prisma.service";

function serviceWithDb(db: object) {
  return new NotificationsService({ db } as unknown as PrismaService);
}

const broadcast = {
  id: "broadcast-1",
  userId: null,
  type: "announcement",
  message: "System update",
  isRead: false,
  createdBy: "admin-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
};

const secondBroadcast = {
  ...broadcast,
  id: "broadcast-2",
  message: "Second update",
  createdAt: new Date("2026-01-02T00:00:00.000Z"),
};

describe("NotificationsService broadcast read state", () => {
  it("lists broadcast read state independently for each user", async () => {
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([{ ...broadcast, readStates: [] }])
      .mockResolvedValueOnce([{ ...broadcast, readStates: [{ readAt: new Date("2026-01-03T00:00:00.000Z") }] }])
      .mockResolvedValueOnce([{ ...broadcast, readStates: [] }]);
    const service = serviceWithDb({ notification: { findMany } });

    await expect(service.listMine("user-a")).resolves.toMatchObject([{ id: "broadcast-1", isRead: false }]);
    await expect(service.listMine("user-a")).resolves.toMatchObject([{ id: "broadcast-1", isRead: true }]);
    await expect(service.listMine("user-b")).resolves.toMatchObject([{ id: "broadcast-1", isRead: false }]);

    expect(findMany).toHaveBeenCalledWith({
      where: { OR: [{ userId: "user-a" }, { userId: null }] },
      include: {
        readStates: {
          where: { userId: "user-a" },
          select: { readAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(findMany).toHaveBeenLastCalledWith({
      where: { OR: [{ userId: "user-b" }, { userId: null }] },
      include: {
        readStates: {
          where: { userId: "user-b" },
          select: { readAt: true },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });
  });

  it("keeps multiple broadcasts independent for one user", async () => {
    const service = serviceWithDb({
      notification: {
        findMany: vi.fn().mockResolvedValue([
          { ...secondBroadcast, readStates: [] },
          { ...broadcast, readStates: [{ readAt: new Date("2026-01-03T00:00:00.000Z") }] },
        ]),
      },
    });

    await expect(service.listMine("user-a")).resolves.toMatchObject([
      { id: "broadcast-2", isRead: false },
      { id: "broadcast-1", isRead: true },
    ]);
  });

  it("marks only the caller read for a broadcast notification", async () => {
    const upsert = vi.fn().mockResolvedValue({
      notificationId: "broadcast-1",
      userId: "user-a",
      readAt: new Date("2026-01-03T00:00:00.000Z"),
    });
    const update = vi.fn();
    const service = serviceWithDb({
      notification: {
        findUnique: vi.fn().mockResolvedValue(broadcast),
        update,
      },
      notificationReadState: { upsert },
    });

    await expect(service.markRead("user-a", "broadcast-1")).resolves.toMatchObject({
      id: "broadcast-1",
      isRead: true,
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { notificationId_userId: { notificationId: "broadcast-1", userId: "user-a" } },
      create: { notificationId: "broadcast-1", userId: "user-a" },
      update: { readAt: expect.any(Date) },
    });
    expect(update).not.toHaveBeenCalled();
  });

  it("uses the legacy row isRead path for direct notifications", async () => {
    const direct = { ...broadcast, id: "direct-1", userId: "user-a" };
    const update = vi.fn().mockResolvedValue({ ...direct, isRead: true });
    const upsert = vi.fn();
    const service = serviceWithDb({
      notification: {
        findUnique: vi.fn().mockResolvedValue(direct),
        update,
      },
      notificationReadState: { upsert },
    });

    await expect(service.markRead("user-a", "direct-1")).resolves.toMatchObject({
      id: "direct-1",
      isRead: true,
    });
    expect(update).toHaveBeenCalledWith({ where: { id: "direct-1" }, data: { isRead: true } });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("denies marking another user's direct notification read", async () => {
    const update = vi.fn();
    const upsert = vi.fn();
    const service = serviceWithDb({
      notification: {
        findUnique: vi.fn().mockResolvedValue({ ...broadcast, id: "direct-1", userId: "user-a" }),
        update,
      },
      notificationReadState: { upsert },
    });

    await expect(service.markRead("user-b", "direct-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
    expect(upsert).not.toHaveBeenCalled();
  });
});
