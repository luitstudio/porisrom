import type { Prisma, Role } from "@porisrom/database";
import bcrypt from "bcryptjs";

export const SYNTHETIC_TEST_PASSWORD = "Synthetic-test-only-2026!";

export function assertIsolatedSecurityDatabase(url: string | undefined) {
  if (process.env.NODE_ENV !== "test" || !url) throw new Error("Security fixtures require explicit test mode and database URL");
  const target = new URL(url);
  if (!["127.0.0.1", "localhost", "::1"].includes(target.hostname) || !target.pathname.endsWith("_test")) {
    throw new Error("Security fixtures refuse non-local or non-test databases");
  }
}

export async function ensureSecurityUsers(db: Pick<Prisma.TransactionClient, "user">, namespace: string, url: string | undefined) {
  assertIsolatedSecurityDatabase(url);
  if (!/^security-[a-zA-Z0-9-]+$/.test(namespace)) throw new Error("Invalid synthetic fixture namespace");
  const passwordHash = await bcrypt.hash(SYNTHETIC_TEST_PASSWORD, 4);
  const users = {} as Record<"admin" | "client" | "freelancer", { id: string; email: string }>;
  for (const role of ["admin", "client", "freelancer"] as const) {
    const id = `${namespace}-${role}`; const email = `${id}@example.test`;
    const existing = await db.user.findUnique({ where: { email }, select: { id: true, role: true } });
    if (existing && (existing.id !== id || existing.role !== role)) throw new Error("Refusing to promote or overwrite a different fixture identity");
    users[role] = await db.user.upsert({ where: { email }, create: {
      id, email, name: `Synthetic ${role}`, role: role as Role, passwordHash, isOnboarded: true,
    }, update: {}, select: { id: true, email: true } });
  }
  return users;
}
