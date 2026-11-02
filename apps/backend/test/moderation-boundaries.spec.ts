import { describe, expect, it, vi } from "vitest";
import { ConversationsService } from "../src/conversations/conversations.service";
import { LeaderboardService } from "../src/leaderboard/leaderboard.service";
import { ConnectionsService } from "../src/connections/connections.service";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { Reflector } from "@nestjs/core";
import { AdminController } from "../src/admin/admin.controller";

describe("moderation boundaries", () => {
  it.each(["blocked", "deleted"])("freezes an established conversation with a %s counterparty", async (status) => {
    const connection = { requesterId: "client", receiverId: "freelancer" };
    const message = { id: "message" };
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      user: { findMany: vi.fn().mockResolvedValue([
        { id: "client", role: "client", status: "active" },
        { id: "freelancer", role: "freelancer", status },
      ]) },
      message: { create: vi.fn().mockResolvedValue(message) },
      notification: { create: vi.fn().mockResolvedValue({}) },
    };
    const db = { conversation: { findUnique: vi.fn().mockResolvedValue({ connection }) }, $transaction: (fn: (tx: unknown) => unknown) => fn(tx) };
    const service = new ConversationsService({ db } as never, { emitMessageCreated: vi.fn(), emitNotificationCreated: vi.fn() } as never);
    await expect(service.sendMessage("client", "conversation", "hello")).rejects.toMatchObject({ status: 403 });
    expect(tx.message.create).not.toHaveBeenCalled();
  });

  it("filters leaderboard eligibility by current account role and status", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const service = new LeaderboardService({ db: { freelancerProfile: { findMany } } } as never);
    await service.listFreelancers();
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ user: { role: "freelancer", status: "active" } }) }));
  });

  it.each(["blocked", "deleted"])("denies responding to an existing connection from a %s user", async (status) => {
    const connection = { id: "connection", requesterId: "client", receiverId: "freelancer", status: "pending",
      requester: { role: "client", status }, receiver: { role: "freelancer", status: "active" } };
    const write = vi.fn();
    const tx = { $queryRaw: vi.fn(), connection: { findUnique: vi.fn().mockResolvedValue(connection), update: write },
      conversation: { create: write }, notification: { create: write } };
    const service = new ConnectionsService({ db: { $transaction: (fn: (client: typeof tx) => unknown) => fn(tx) } } as never);
    await expect(service.accept("freelancer", "connection")).rejects.toMatchObject({ status: 409 });
    await expect(service.decline("freelancer", "connection")).rejects.toMatchObject({ status: 409 });
    expect(write).not.toHaveBeenCalled();
  });

  it.each(["client", "freelancer", "admin"])("preserves admin moderation authorization for %s", (role) => {
    const guard = new RolesGuard(new Reflector());
    const context = { getClass: () => AdminController, getHandler: () => AdminController.prototype.setBlocked,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }) };
    if (role === "admin") expect(guard.canActivate(context as never)).toBe(true);
    else expect(() => guard.canActivate(context as never)).toThrow();
  });
});
