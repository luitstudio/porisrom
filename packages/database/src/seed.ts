import "dotenv/config";

import { createPrismaClient } from "./index";
import { seedLaunchData } from "./launch-data";

// Mirrors apps/frontend/src/lib/onboarding-data.ts's PROFESSION_CATEGORIES / SKILL_SUGGESTIONS
// so search filters line up with what the onboarding wizard already offers.
const CATEGORIES = [
  "Video Editor",
  "Video Grapher & Photographer",
  "Graphic Designer",
  "Web Developer",
  "Motion Designer",
  "Drone Operator",
  "Content Writer",
  "Social Media Marketer",
  "Voice Over Artist",
];

const SKILLS = [
  { name: "Photoshop", categoryName: "Graphic Designer" },
  { name: "Premiere Pro", categoryName: "Video Editor" },
  { name: "After Effects", categoryName: "Motion Designer" },
  { name: "Figma", categoryName: "Graphic Designer" },
  { name: "SEO", categoryName: "Social Media Marketer" },
  { name: "Copywriting", categoryName: "Content Writer" },
  { name: "React", categoryName: "Web Developer" },
  { name: "Next.js", categoryName: "Web Developer" },
  { name: "DaVinci Resolve", categoryName: "Video Editor" },
  { name: "Lightroom", categoryName: "Video Grapher & Photographer" },
  { name: "Illustrator", categoryName: "Graphic Designer" },
  { name: "WordPress", categoryName: "Web Developer" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function main() {
  const db = createPrismaClient();
  const categoryIds = new Map<string, string>();

  for (const name of CATEGORIES) {
    const slug = slugify(name);
    const category = await db.category.upsert({
      where: { name },
      create: { name, slug },
      update: { slug },
    });
    categoryIds.set(name, category.id);
  }

  for (const { name, categoryName } of SKILLS) {
    const categoryId = categoryIds.get(categoryName);
    if (!categoryId) {
      throw new Error(`Missing seeded category for skill: ${name}`);
    }

    await db.skill.upsert({
      where: { name },
      create: { name, categoryId },
      update: { categoryId },
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories and ${SKILLS.length} skills.`);

  if (process.env.SEED_LAUNCH_DATA?.trim().toLowerCase() === "true") {
    const result = await seedLaunchData(db);
    console.log(
      `Seeded launch demo records: ${result.freelancers} freelancers and ${result.companies} companies (${result.verificationStatus}).`,
    );
  } else {
    console.log("Launch demo records skipped. Set SEED_LAUNCH_DATA=true to include them.");
  }
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
