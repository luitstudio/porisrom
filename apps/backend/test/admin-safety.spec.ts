import { ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { AdminService } from "../src/admin/admin.service";
import type { PrismaService } from "../src/prisma/prisma.service";

function serviceFor(user: { id: string; role: string; status: string }) {
  const update = vi.fn().mockResolvedValue({ id: user.id, status: "active" });
  const service = new AdminService({
    db: {
      user: {
        findUnique: vi.fn().mockResolvedValue(user),
        update,
      },
    },
  } as unknown as PrismaService);
  return { service, update };
}

describe("admin destructive-action safety", () => {
  it.each([
    ["self", "admin-self"],
    ["another admin", "admin-other"],
  ])("rejects blocking %s", async (_label, userId) => {
    const { service, update } = serviceFor({ id: userId, role: "admin", status: "active" });

    await expect(service.setBlocked(userId, true)).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it.each([
    ["self", "admin-self"],
    ["another admin", "admin-other"],
  ])("rejects deleting %s", async (_label, userId) => {
    const { service, update } = serviceFor({ id: userId, role: "admin", status: "active" });

    await expect(service.softDeleteUser(userId)).rejects.toBeInstanceOf(ForbiddenException);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["freelancer", "client"])("preserves block behavior for %s users", async (role) => {
    const { service, update } = serviceFor({ id: `${role}-1`, role, status: "active" });

    await service.setBlocked(`${role}-1`, true);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "blocked" } }));
  });

  it.each(["freelancer", "client"])("preserves delete behavior for %s users", async (role) => {
    const { service, update } = serviceFor({ id: `${role}-1`, role, status: "active" });

    await service.softDeleteUser(`${role}-1`);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: "deleted", name: "Deleted User" }),
    }));
  });
});
