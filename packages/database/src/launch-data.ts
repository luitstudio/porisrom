import bcrypt from "bcryptjs";

import { createPrismaClient } from "./index";

type DatabaseClient = ReturnType<typeof createPrismaClient>;

type LaunchFreelancer = {
  key: string;
  categoryName: string;
  district: string;
  experienceLevel: string;
};

type LaunchCompany = {
  key: string;
  categoryNames: string[];
};

export const LAUNCH_FREELANCERS: LaunchFreelancer[] = [
  { key: "video-editor", categoryName: "Video Editor", district: "Kamrup Metropolitan", experienceLevel: "1–2 years" },
  { key: "videographer-photographer", categoryName: "Video Grapher & Photographer", district: "Dibrugarh", experienceLevel: "1–2 years" },
  { key: "graphic-designer", categoryName: "Graphic Designer", district: "Jorhat", experienceLevel: "1–2 years" },
  { key: "web-developer", categoryName: "Web Developer", district: "Kamrup Metropolitan", experienceLevel: "1–2 years" },
  { key: "motion-designer", categoryName: "Motion Designer", district: "Nagaon", experienceLevel: "1–2 years" },
  { key: "drone-operator", categoryName: "Drone Operator", district: "Sonitpur", experienceLevel: "1–2 years" },
  { key: "content-writer", categoryName: "Content Writer", district: "Cachar", experienceLevel: "1–2 years" },
  { key: "social-media-marketer", categoryName: "Social Media Marketer", district: "Tinsukia", experienceLevel: "1–2 years" },
  { key: "voice-over-artist", categoryName: "Voice Over Artist", district: "Sivasagar", experienceLevel: "1–2 years" },
];

export const LAUNCH_COMPANIES: LaunchCompany[] = [
  { key: "client-01", categoryNames: ["Web Developer", "Graphic Designer"] },
  { key: "client-02", categoryNames: ["Video Editor", "Motion Designer"] },
  { key: "client-03", categoryNames: ["Content Writer", "Social Media Marketer"] },
  { key: "client-04", categoryNames: ["Video Grapher & Photographer", "Drone Operator"] },
  { key: "client-05", categoryNames: ["Voice Over Artist"] },
  { key: "client-06", categoryNames: ["Web Developer", "Content Writer"] },
];

function demoEmail(kind: "freelancer" | "client", key: string) {
  return `demo.${kind}.${key}@porishrom.local`;
}

function profileStatusFromEnvironment(): "pending" | "approved" {
  const configured = process.env.LAUNCH_DEMO_PROFILE_STATUS?.trim().toLowerCase();
  if (!configured || configured === "pending") return "pending";
  if (configured === "approved") return "approved";
  throw new Error("LAUNCH_DEMO_PROFILE_STATUS must be either pending or approved");
}

function requiredDemoPassword() {
  const password = process.env.LAUNCH_DEMO_PASSWORD;
  if (!password) {
    throw new Error("LAUNCH_DEMO_PASSWORD is required when SEED_LAUNCH_DATA=true");
  }
  if (password.length < 8) {
    throw new Error("LAUNCH_DEMO_PASSWORD must be at least 8 characters");
  }
  return password;
}

export async function seedLaunchData(db: DatabaseClient) {
  const passwordHash = await bcrypt.hash(requiredDemoPassword(), 10);
  const verificationStatus = profileStatusFromEnvironment();
  const categories = await db.category.findMany({
    include: { skills: { select: { id: true } } },
  });
  const categoryByName = new Map(categories.map((category) => [category.name, category]));

  for (const record of LAUNCH_FREELANCERS) {
    const category = categoryByName.get(record.categoryName);
    if (!category) throw new Error(`Missing canonical category: ${record.categoryName}`);

    await db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: demoEmail("freelancer", record.key) },
        create: {
          name: `Demo Freelancer — ${record.categoryName}`,
          email: demoEmail("freelancer", record.key),
          passwordHash,
          role: "freelancer",
          status: "active",
          isOnboarded: true,
          profileCompleteness: 100,
        },
        update: { passwordHash },
        select: { id: true, role: true },
      });
      if (user.role !== "freelancer") {
        throw new Error(`Launch demo email is already assigned to another role: ${record.key}`);
      }

      const profile = await tx.freelancerProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          bio: `Demo profile for ${record.categoryName} discovery testing in Assam.`,
          address: "Demo address",
          state: "Assam",
          district: record.district,
          languages: ["English"],
          experienceLevel: record.experienceLevel,
          verificationStatus,
        },
        update: {},
        select: { id: true },
      });

      await tx.freelancerCategory.createMany({
        data: [{ freelancerProfileId: profile.id, categoryId: category.id }],
        skipDuplicates: true,
      });
      if (category.skills.length > 0) {
        await tx.freelancerSkill.createMany({
          data: category.skills.map((skill) => ({
            freelancerProfileId: profile.id,
            skillId: skill.id,
          })),
          skipDuplicates: true,
        });
      }
    });
  }

  for (const record of LAUNCH_COMPANIES) {
    const categoryIds = record.categoryNames.map((categoryName) => {
      const category = categoryByName.get(categoryName);
      if (!category) throw new Error(`Missing canonical category: ${categoryName}`);
      return category.id;
    });

    await db.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: demoEmail("client", record.key) },
        create: {
          name: `Demo Client ${record.key.slice(-2)}`,
          email: demoEmail("client", record.key),
          passwordHash,
          role: "client",
          status: "active",
          isOnboarded: true,
          profileCompleteness: 100,
        },
        update: { passwordHash },
        select: { id: true, role: true },
      });
      if (user.role !== "client") {
        throw new Error(`Launch demo email is already assigned to another role: ${record.key}`);
      }

      const profile = await tx.companyProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          companyName: `Demo Company ${record.key.slice(-2)}`,
          about: "Demo company profile for marketplace workflow testing in Assam.",
          address: "Demo address",
          state: "Assam",
          verificationStatus,
        },
        update: {},
        select: { id: true },
      });

      await tx.companyCategory.createMany({
        data: categoryIds.map((categoryId) => ({
          companyProfileId: profile.id,
          categoryId,
        })),
        skipDuplicates: true,
      });
    });
  }

  return {
    freelancers: LAUNCH_FREELANCERS.length,
    companies: LAUNCH_COMPANIES.length,
    verificationStatus,
  };
}
