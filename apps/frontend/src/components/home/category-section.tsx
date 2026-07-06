import Link from "next/link";

import {
  CategoryCard,
  type IconKey,
  type IllustrationKey,
} from "@/components/home/category-card";

type Category = {
  title: string;
  description: string;
  icon: IconKey;
  href: string;
  illustration: IllustrationKey;
};

const CATEGORIES: Category[] = [
  {
    title: "Video Editor",
    description: "Edit cinematic stories with timeline precision, pacing, and polished delivery.",
    icon: "clapperboard",
    href: "/categories/video-editor",
    illustration: "video-editor",
  },
  {
    title: "Videographer",
    description: "Capture product films, events, and campaign visuals with a production-ready eye.",
    icon: "camera",
    href: "/categories/photographer",
    illustration: "videographer",
  },
  {
    title: "Graphic Designer",
    description: "Design refined brand assets, campaign visuals, and clean digital compositions.",
    icon: "pen-tool",
    href: "/categories/graphic-designer",
    illustration: "graphic-designer",
  },
  {
    title: "Web Developer",
    description: "Build fast websites, dashboards, and product experiences for modern teams.",
    icon: "code",
    href: "/categories/web-developers",
    illustration: "web-developer",
  },
  {
    title: "Motion Designer",
    description: "Bring interfaces, explainers, and product stories to life with subtle motion.",
    icon: "sparkles",
    href: "/categories/motion-designer",
    illustration: "motion-designer",
  },
  {
    title: "Drone Operator",
    description: "Create aerial shots, location coverage, and cinematic outdoor perspectives.",
    icon: "plane-takeoff",
    href: "/categories/drone-operator",
    illustration: "drone-operator",
  },
  {
    title: "Content Writer",
    description: "Shape articles, landing pages, scripts, and brand narratives that convert.",
    icon: "pen-line",
    href: "/categories/content-writer",
    illustration: "content-writer",
  },
  {
    title: "Social Media Marketer",
    description: "Plan growth campaigns, analytics loops, and platform-native content systems.",
    icon: "megaphone",
    href: "/categories/social-media",
    illustration: "social-media",
  },
  {
    title: "Voice Over Artist",
    description: "Record crisp narrations, ads, explainers, and branded audio with studio polish.",
    icon: "mic",
    href: "/categories/voice-over-artist",
    illustration: "voice-over",
  },
];

export function CategorySection() {
  return (
    <section className="relative overflow-hidden px-5 py-24 sm:px-8 lg:px-10">
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className="absolute left-1/2 top-10 size-[520px] -translate-x-1/2 rounded-full bg-primary/[0.045] blur-3xl" />
        <div className="absolute -left-20 bottom-10 size-80 rounded-full bg-orchid/[0.06] blur-3xl" />
        <div className="absolute right-0 top-1/3 size-72 rounded-full bg-lavender/45 blur-3xl" />
        <DecorativeLines />
        <TinyStars />
      </div>

      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Browse by category
            </p>
            <h2 className="mt-4 font-display text-4xl font-semibold leading-tight text-foreground sm:text-5xl">
              Find{" "}
              <span className="bg-linear-to-r from-primary via-orchid to-magenta bg-clip-text text-transparent">
                work
              </span>{" "}
              in your{" "}
              <span className="bg-linear-to-r from-primary via-orchid to-magenta bg-clip-text text-transparent">
                field
              </span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground">
              Explore focused creative, technical, and production categories built for
              modern freelance teams and premium client work.
            </p>
          </div>

          <Link
            href="/categories"
            className="inline-flex h-11 items-center justify-center rounded-full border border-[#ECEAFF] bg-white px-5 text-sm font-semibold text-foreground shadow-[0_14px_40px_-28px_rgba(91,76,255,0.45)] transition-all hover:-translate-y-0.5 hover:border-primary/45 hover:text-primary hover:shadow-[0_20px_50px_-30px_rgba(91,76,255,0.5)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            View all categories
          </Link>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {CATEGORIES.map((category, index) => (
            <CategoryCard key={category.title} index={index} {...category} />
          ))}
        </div>
      </div>
    </section>
  );
}

function TinyStars() {
  return (
    <svg className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
      <path d="M86 96L89 103L96 106L89 109L86 116L83 109L76 106L83 103L86 96Z" fill="#5B4CFF" opacity="0.12" />
      <path d="M1180 86L1186 101L1202 107L1186 113L1180 128L1174 113L1158 107L1174 101L1180 86Z" fill="#8D83FF" opacity="0.14" />
      <circle cx="18%" cy="68%" r="3" fill="#A89DFF" opacity="0.14" />
      <circle cx="78%" cy="78%" r="4" fill="#5B4CFF" opacity="0.08" />
    </svg>
  );
}

function DecorativeLines() {
  return (
    <svg className="absolute inset-0 h-full w-full" fill="none" aria-hidden="true">
      <path
        d="M-40 210C130 120 260 130 420 215C610 316 760 286 940 178C1090 88 1230 76 1410 160"
        stroke="#5B4CFF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.06"
      />
      <path
        d="M110 650C250 542 430 536 586 624C720 700 900 680 1054 560"
        stroke="#8D83FF"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.07"
      />
    </svg>
  );
}
