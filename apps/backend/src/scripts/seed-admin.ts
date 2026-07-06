import "dotenv/config";

import bcrypt from "bcryptjs";
import { createPrismaClient } from "@porishrom/database";

async function main() {
  const db = createPrismaClient();
  const email = process.env.ADMIN_EMAIL ?? "admin@porishrom.local";
  const password = process.env.ADMIN_PASSWORD ?? "ChangeMe123!";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Admin already exists: ${email}`);
    await db.$disconnect();
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await db.user.create({
    data: {
      name: "Porishrom Admin",
      email,
      passwordHash,
      role: "admin",
      isOnboarded: true,
    },
  });

  console.log(`Admin created: ${email} / ${password}`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
