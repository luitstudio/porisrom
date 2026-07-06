import "dotenv/config";

import { createPrismaClient } from "./index";

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
  "Photoshop",
  "Premiere Pro",
  "After Effects",
  "Figma",
  "SEO",
  "Copywriting",
  "React",
  "Next.js",
  "DaVinci Resolve",
  "Lightroom",
  "Illustrator",
  "WordPress",
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

  for (const name of CATEGORIES) {
    await db.category.upsert({
      where: { name },
      create: { name, slug: slugify(name) },
      update: {},
    });
  }

  for (const name of SKILLS) {
    await db.skill.upsert({
      where: { name },
      create: { name },
      update: {},
    });
  }

  console.log(`Seeded ${CATEGORIES.length} categories and ${SKILLS.length} skills.`);
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
