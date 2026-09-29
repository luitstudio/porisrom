import "dotenv/config";

import bcrypt from "bcryptjs";
import { createPrismaClient } from "@porishrom/database";

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD are required");
  }
  if (password.length < 8) {
    throw new Error("ADMIN_PASSWORD must be at least 8 characters");
  }

  const db = createPrismaClient();

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin already exists");
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

  console.log("Admin created successfully");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
