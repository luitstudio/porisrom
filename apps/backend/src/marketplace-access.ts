import { ForbiddenException } from "@nestjs/common";
import type { Prisma } from "@porisrom/database";

type Account = { role: string | null; status: string };
export type ParticipantPair = { requesterId: string; receiverId: string };

export async function hasParticipantBlock(db: Pick<Prisma.TransactionClient, "userBlock">, pair: ParticipantPair) {
  return !!await db.userBlock.findFirst({ where: { unblockedAt: null, OR: [
    { blockerId: pair.requesterId, blockedUserId: pair.receiverId },
    { blockerId: pair.receiverId, blockedUserId: pair.requesterId },
  ] }, select: { id: true } });
}

export async function assertNoParticipantBlock(db: Pick<Prisma.TransactionClient, "userBlock">, pair: ParticipantPair) {
  if (await hasParticipantBlock(db, pair)) throw new ForbiddenException("This relationship is read-only. Use safety settings or administrative escalation.");
}

export function isActiveMarketplacePair(users: Account[]) {
  return users.length === 2 && users.every((user) => user.status === "active") &&
    users.some((user) => user.role === "client") && users.some((user) => user.role === "freelancer");
}

// Moderation locks the same User rows. Hold these locks until the mutation commits:
// a status change and an authorized marketplace write cannot cross each other.
export async function lockMarketplacePair(tx: Prisma.TransactionClient, pair: ParticipantPair) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" IN (${pair.requesterId}, ${pair.receiverId}) ORDER BY "id" FOR UPDATE`;
}

export async function assertMarketplaceWritable(tx: Prisma.TransactionClient, pair: ParticipantPair) {
  await lockMarketplacePair(tx, pair);
  const users = await tx.user.findMany({
    where: { id: { in: [pair.requesterId, pair.receiverId] } },
    select: { role: true, status: true },
  });
  if (!isActiveMarketplacePair(users)) {
    throw new ForbiddenException("This conversation and its assignments are read-only because an account is unavailable. Contact support.");
  }
  await assertNoParticipantBlock(tx, pair);
}
