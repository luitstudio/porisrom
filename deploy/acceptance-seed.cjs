// Run only with the unique acceptance database/container selected by the driver.
const { createPrismaClient } = require("@porisrom/database");
const bcrypt = require("bcryptjs");
(async () => {
  const db = createPrismaClient();
  try {
    const info = await db.$queryRaw`SELECT current_database() AS name`;
    if (info[0].name !== "porisrom_docker_acceptance_test") throw Error("Synthetic database required");
    const suffix = process.env.PORISROM_ACCEPTANCE_SEED_SUFFIX ?? "";
    if (suffix && !/^-[0-9]{13}$/.test(suffix)) throw Error("Invalid synthetic fixture suffix");
    const passwordHash = await bcrypt.hash("Synthetic-test-only-2026!", 4);
    const users = {};
    for (const role of ["admin", "client", "freelancer"]) {
      const id = `security-docker-acceptance${suffix}-${role}`;
      const email = `${id}@example.test`;
      const current = await db.user.findUnique({ where: { email } });
      if (current && (current.id !== id || current.role !== role)) throw Error("Fixture collision");
      users[role] = await db.user.upsert({ where: { email }, create: { id, email, name: `Synthetic Docker ${role}`, role, passwordHash, isOnboarded: true }, update: {}, select: { id: true, email: true } });
    }
    await db.freelancerProfile.upsert({ where: { userId: users.freelancer.id }, create: { userId: users.freelancer.id, verificationStatus: "approved" }, update: {} });
    await db.companyProfile.upsert({ where: { userId: users.client.id }, create: { userId: users.client.id, companyName: "Synthetic Docker Company", verificationStatus: "approved" }, update: {} });
    const connection = await db.connection.upsert({ where: { requesterId_receiverId: { requesterId: users.client.id, receiverId: users.freelancer.id } }, create: { requesterId: users.client.id, receiverId: users.freelancer.id, status: "accepted" }, update: {} });
    const conversation = await db.conversation.upsert({ where: { connectionId: connection.id }, create: { connectionId: connection.id }, update: {} });
    console.log(JSON.stringify({ users, conversationId: conversation.id }));
  } finally { await db.$disconnect(); }
})().catch(() => { console.error("Synthetic acceptance seed failed (details withheld)"); process.exitCode = 1; });
