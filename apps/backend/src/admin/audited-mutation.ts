import { ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@porisrom/database";
import type { PrismaDb } from "../prisma/prisma.service";

export async function auditedAdminMutation<T>(db: PrismaDb, adminId: string, action: string,
  targetUserId: string | undefined, metadata: Prisma.InputJsonValue | undefined,
  mutate: (tx: Prisma.TransactionClient) => Promise<T>) {
  return db.$transaction(async (tx) => {
    const admin = await tx.user.findUnique({ where: { id: adminId }, select: { role: true, status: true } });
    if (admin?.role !== "admin" || admin.status !== "active") throw new ForbiddenException("Active administrator required");
    const result = await mutate(tx);
    await tx.adminActionLog.create({ data: { adminId, targetUserId, action, metadata } });
    return result;
  });
}
