"use client";

import type { ComponentType } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRight,
  Camera,
  Clapperboard,
  Code2,
  Megaphone,
  Mic,
  PenLine,
  PenTool,
  PlaneTakeoff,
  Sparkles,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type IllustrationKey =
  | "video-editor"
  | "videographer"
  | "graphic-designer"
  | "web-developer"
  | "motion-designer"
  | "drone-operator"
  | "content-writer"
  | "social-media"
  | "voice-over";

export type IconKey =
  | "clapperboard"
  | "camera"
  | "pen-tool"
  | "code"
  | "sparkles"
  | "plane-takeoff"
  | "pen-line"
  | "megaphone"
  | "mic";

const iconMap = {
  clapperboard: Clapperboard,
  camera: Camera,
  "pen-tool": PenTool,
  code: Code2,
  sparkles: Sparkles,
  "plane-takeoff": PlaneTakeoff,
  "pen-line": PenLine,
  megaphone: Megaphone,
  mic: Mic,
} satisfies Record<IconKey, ComponentType<{ className?: string }>>;

const illustrationMap = {
  "video-editor": {
    src: "/illustrations/videoediting.webp",
    alt: "Editorial illustration of a video editor working with a video timeline",
    tint: "bg-[#5B4CFF]/[0.075]",
  },
  videographer: {
    src: "/illustrations/camera.webp",
    alt: "Editorial illustration of a videographer with a camera",
    tint: "bg-[#8D83FF]/[0.075]",
  },
  "graphic-designer": {
    src: "/illustrations/graphicdesigner.webp",
    alt: "Editorial illustration of a graphic designer creating artwork",
    tint: "bg-[#F6CDAF]/[0.11]",
  },
  "web-developer": {
    src: "/illustrations/developer.webp",
    alt: "Editorial illustration of a web developer building with code",
    tint: "bg-[#BCEEDC]/[0.11]",
  },
  "motion-designer": {
    src: "/illustrations/motiondesigner.webp",
    alt: "Editorial illustration of a motion designer using animation tools",
    tint: "bg-[#BFE6FF]/[0.11]",
  },
  "drone-operator": {
    src: "/illustrations/drone.webp",
    alt: "Editorial illustration of a drone operator flying a drone",
    tint: "bg-[#CDEBFF]/[0.11]",
  },
  "content-writer": {
    src: "/illustrations/content.webp",
    alt: "Editorial illustration of a content writer working on documents",
    tint: "bg-[#EBD9BC]/[0.11]",
  },
  "social-media": {
    src: "/illustrations/social-media.webp",
    alt: "Editorial illustration of a social media marketer reviewing analytics",
    tint: "bg-[#F7C7DD]/[0.1]",
  },
  "voice-over": {
    src: "/illustrations/voice-over-artist.webp",
    alt: "Editorial illustration of a voice over artist recording audio",
    tint: "bg-[#A89DFF]/[0.085]",
  },
} satisfies Record<
  IllustrationKey,
  {
    src: string;
    alt: string;
    tint: string;
  }
>;

type CategoryCardProps = {
  icon: IconKey;
  title: string;
  description: string;
  href: string;
  illustration: IllustrationKey;
  index: number;
};

export function CategoryCard({
  icon,
  title,
  description,
  href,
  illustration,
  index,
}: CategoryCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const Icon = iconMap[icon];
  const image = illustrationMap[illustration];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: prefersReducedMotion ? 0 : 0.45,
        delay: prefersReducedMotion ? 0 : index * 0.055,
        ease: "easeOut",
      }}
    >
      <Link
        href={href}
        className={cn(
          "group relative block min-h-[180px] rounded-3xl border border-[rgba(108,76,247,0.08)] bg-white p-5 shadow-[0_18px_52px_-42px_rgba(91,76,247,0.45)] transition-all duration-300 ease-out sm:min-h-[270px] sm:rounded-[32px] sm:p-8",
          "hover:-translate-y-1.5 hover:border-primary/55 hover:shadow-[0_26px_70px_-32px_rgba(91,76,255,0.48)]",
          "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        )}
      >
        <div
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit]",
            image.tint
          )}
        />
        <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/55 blur-2xl sm:-right-16 sm:-top-16 sm:size-52" />
        <div className="pointer-events-none absolute bottom-5 left-8 hidden h-px w-28 rotate-[-8deg] bg-primary/10 sm:block" />

        <div className="relative z-10 flex min-h-[140px] items-center gap-3 sm:min-h-[206px] sm:gap-5">
          <div className="relative z-10 flex w-[48%] min-w-0 flex-col items-start sm:w-[44%]">
            <span className="flex size-10 items-center justify-center rounded-full border border-[#ECEAFF] bg-white/80 text-primary shadow-[0_12px_30px_-24px_rgba(91,76,255,0.5)] transition-colors duration-300 group-hover:border-primary/35 group-hover:bg-primary group-hover:text-white sm:size-12">
              <Icon className="size-4 sm:size-5" />
            </span>

            <h3 className="mt-5 text-[18px] font-bold leading-snug text-foreground sm:mt-7">
              {title}
            </h3>
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground sm:mt-3">
              {description}
            </p>

            <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary sm:mt-6">
              Explore
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </span>
          </div>

          <div
            className="pointer-events-none absolute bottom-[-8px] right-[-8px] flex w-[50%] items-end justify-end sm:bottom-[-14px] sm:right-[-14px] sm:w-[58%]"
          >
            <Image
              src={image.src}
              alt={image.alt}
              width={1536}
              height={1024}
              priority={false}
              sizes="(min-width: 1280px) 230px, (min-width: 768px) 27vw, 45vw"
              className="h-auto w-full object-contain drop-shadow-[0_18px_30px_rgba(91,76,255,0.12)] transition-transform duration-300 group-hover:scale-[1.03]"
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
