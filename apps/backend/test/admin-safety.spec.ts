import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdminService } from "../src/admin/admin.service";
import type { PrismaService } from "../src/prisma/prisma.service";

function serviceFor(user: { id: string; role: string; status: string }) {
  const update = vi.fn().mockResolvedValue({ id: user.id, status: "active" });
  const db = {
    $queryRaw: vi.fn(),
    adminActionLog: { create: vi.fn() },
    user: { findUnique: vi.fn(async ({ where }) => where.id === "moderator" ? { id: "moderator", role: "admin", status: "active" } : user), update },
    authSession: { updateMany: vi.fn() },
    connection: { findMany: vi.fn().mockResolvedValue([]) },
  };
  const service = new AdminService({ db: { ...db, $transaction: (fn: (tx: typeof db) => unknown) => fn(db) } } as unknown as PrismaService);
  return { service, update };
}

describe("admin destructive-action safety", () => {
  it.each([
    ["self", "admin-self"],
    ["another admin", "admin-other"],
  ])("rejects blocking %s", async (_label, userId) => {
    const { service, update } = serviceFor({ id: userId, role: "admin", status: "active" });

    await expect(service.setBlocked(userId, true, "moderator")).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["self", "admin-self"],
    ["another admin", "admin-other"],
  ])("rejects deleting %s", async (_label, userId) => {
    const { service, update } = serviceFor({ id: userId, role: "admin", status: "active" });

    await expect(service.softDeleteUser(userId, "moderator")).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["freelancer", "client"])("preserves block behavior for %s users", async (role) => {
    const { service, update } = serviceFor({ id: `${role}-1`, role, status: "active" });

    await service.setBlocked(`${role}-1`, true, "moderator");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "blocked" } }));
  });

  it.each(["freelancer", "client"])("preserves delete behavior for %s users", async (role) => {
    const { service, update } = serviceFor({ id: `${role}-1`, role, status: "active" });

    await service.softDeleteUser(`${role}-1`, "moderator");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "deleted", name: "Deleted User" }),
    }));
  });
});
