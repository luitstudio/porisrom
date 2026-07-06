import Image from "next/image";
import Link from "next/link";
import {
  Camera,
  Clapperboard,
  Code2,
  Megaphone,
  PenLine,
  PenTool,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

type Category = {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  freelancerCount: string;
  href: string;
  image: string;
  imageAlt: string;
  tintClassName: string;
  badgeClassName: string;
};

const CATEGORIES: Category[] = [
  {
    icon: Code2,
    title: "Programming",
    subtitle: "Web & apps",
    freelancerCount: "2.4K Freelancers",
    href: "/categories/web-developers",
    image: "/illustrations/developer.webp",
    imageAlt: "Illustration of a web developer working on code",
    tintClassName: "bg-[#5B4CFF]/[0.07]",
    badgeClassName: "bg-lavender text-primary",
  },
  {
    icon: Clapperboard,
    title: "Video Editing",
    subtitle: "Reels & films",
    freelancerCount: "1.8K Freelancers",
    href: "/categories/video-editor",
    image: "/illustrations/videoediting.webp",
    imageAlt: "Illustration of a video editor editing a timeline",
    tintClassName: "bg-[#5B4CFF]/[0.08]",
    badgeClassName: "bg-peach text-foreground",
  },
  {
    icon: PenTool,
    title: "Graphic Design",
    subtitle: "Logos & branding",
    freelancerCount: "3.1K Freelancers",
    href: "/categories/graphic-designer",
    image: "/illustrations/graphicdesigner.webp",
    imageAlt: "Illustration of a graphic designer creating visuals",
    tintClassName: "bg-[#F6CDAF]/[0.1]",
    badgeClassName: "bg-blush text-foreground",
  },
  {
    icon: Camera,
    title: "Photography",
    subtitle: "Shoots & retouching",
    freelancerCount: "1.2K Freelancers",
    href: "/categories/photographer",
    image: "/illustrations/camera.webp",
    imageAlt: "Illustration of a photographer holding a camera",
    tintClassName: "bg-[#F7E6CA]/[0.11]",
    badgeClassName: "bg-orchid/15 text-orchid",
  },
  {
    icon: Megaphone,
    title: "Marketing",
    subtitle: "SEO & social",
    freelancerCount: "1.5K Freelancers",
    href: "/categories/social-media",
    image: "/illustrations/social-media.webp",
    imageAlt: "Illustration of a social media marketer reviewing analytics",
    tintClassName: "bg-[#F7C7DD]/[0.1]",
    badgeClassName: "bg-lavender text-primary",
  },
  {
    icon: PenLine,
    title: "Writing",
    subtitle: "Content & copy",
    freelancerCount: "2.0K Freelancers",
    href: "/categories/content-writer",
    image: "/illustrations/content.webp",
    imageAlt: "Illustration of a content writer working on a document",
    tintClassName: "bg-[#EBD9BC]/[0.1]",
    badgeClassName: "bg-peach text-foreground",
  },
];

export function MobileFeaturedCategories() {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Browse by Category</h2>
        <Link
          href="/categories"
          className="min-h-11 px-2 py-2 text-xs font-medium text-primary"
        >
          View all
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        {CATEGORIES.map((category) => (
          <Link
            key={category.title}
            href={category.href}
            className="relative min-h-[178px] rounded-[22px] border border-primary/10 bg-white p-4 shadow-[0_16px_36px_-30px_rgba(20,21,43,0.28)] active:scale-[0.98]"
          >
            <div className={cn("absolute inset-0 rounded-[inherit]", category.tintClassName)} />
            <div className="pointer-events-none absolute right-1 top-4 w-[42%]">
              <Image
                src={category.image}
                alt={category.imageAlt}
                width={1536}
                height={1024}
                priority={false}
                sizes="(max-width: 768px) 38vw, 160px"
                className="h-auto w-full object-contain drop-shadow-[0_12px_20px_rgba(91,76,255,0.12)]"
              />
            </div>

            <div className="relative z-10 flex h-full min-h-[146px] flex-col">
              <span
                className={cn(
                  "flex size-9 items-center justify-center rounded-full shadow-[0_10px_22px_-18px_rgba(20,21,43,0.4)]",
                  category.badgeClassName
                )}
              >
                <category.icon className="size-[18px]" />
              </span>

              <div className="mt-auto max-w-[66%]">
                <h3 className="text-[16px] font-bold leading-tight text-foreground">
                  {category.title}
                </h3>
                <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                  {category.subtitle}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-[13px] font-medium text-primary">
                  {category.freelancerCount}
                  <span aria-hidden="true">→</span>
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
