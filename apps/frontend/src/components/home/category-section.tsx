"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

import { CANONICAL_CATEGORIES, categoryHref } from "@/lib/service-categories";

type Category = {
  slug: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  tint: string;
};

const CATEGORIES: Category[] = [
  {
    slug: CANONICAL_CATEGORIES.videoEditor.slug,
    title: CANONICAL_CATEGORIES.videoEditor.name,
    description:
      "Hire a skilled video editor to transform your raw clips into engaging videos for YouTube, social media, businesses, events, and more.",
    image: "/illustrations/videoediting.webp",
    imageAlt: "Illustration of a video editor working with a video timeline",
    tint: "bg-lavender",
  },
  {
    slug: CANONICAL_CATEGORIES.videographerPhotographer.slug,
    title: CANONICAL_CATEGORIES.videographerPhotographer.name,
    description:
      "Find a professional videographer or photographer to capture moments, products, events, and stories in high-quality visuals.",
    image: "/illustrations/camera.webp",
    imageAlt: "Illustration of a professional using a camera",
    tint: "bg-[#EEEAFE]",
  },
  {
    slug: CANONICAL_CATEGORIES.graphicDesigner.slug,
    title: CANONICAL_CATEGORIES.graphicDesigner.name,
    description:
      "Hire a professional graphic designer to create visuals that make your brand stand out — from logos and social media graphics to marketing materials.",
    image: "/illustrations/graphicdesigner.webp",
    imageAlt: "Illustration of a graphic designer creating brand artwork",
    tint: "bg-peach",
  },
  {
    slug: CANONICAL_CATEGORIES.webDeveloper.slug,
    title: CANONICAL_CATEGORIES.webDeveloper.name,
    description:
      "Hire a skilled web developer to build fast, responsive, and reliable websites that meet your needs.",
    image: "/illustrations/developer.webp",
    imageAlt: "Illustration of a web developer working with code",
    tint: "bg-[#DDF5EC]",
  },
  {
    slug: CANONICAL_CATEGORIES.motionDesigner.slug,
    title: CANONICAL_CATEGORIES.motionDesigner.name,
    description:
      "Turn ideas, graphics, and text into engaging animations that bring your brand to life.",
    image: "/illustrations/motiondesigner.webp",
    imageAlt: "Illustration of a motion designer creating animation",
    tint: "bg-[#DDEEFF]",
  },
  {
    slug: CANONICAL_CATEGORIES.droneOperator.slug,
    title: CANONICAL_CATEGORIES.droneOperator.name,
    description:
      "Find a professional drone operator to capture beautiful aerial footage for businesses, events, and projects.",
    image: "/illustrations/drone.webp",
    imageAlt: "Illustration of a drone operator capturing aerial footage",
    tint: "bg-[#E2F2FF]",
  },
  {
    slug: CANONICAL_CATEGORIES.contentWriter.slug,
    title: CANONICAL_CATEGORIES.contentWriter.name,
    description:
      "Find a content writer to create engaging content for websites, social media, marketing, and brands.",
    image: "/illustrations/content.webp",
    imageAlt: "Illustration of a content writer working on an article",
    tint: "bg-[#F5EBD9]",
  },
  {
    slug: CANONICAL_CATEGORIES.socialMediaMarketer.slug,
    title: CANONICAL_CATEGORIES.socialMediaMarketer.name,
    description:
      "Find a social media marketer to grow your brand, reach the right audience, and increase engagement.",
    image: "/illustrations/social-media.webp",
    imageAlt: "Illustration of a social media marketer reviewing a campaign",
    tint: "bg-blush",
  },
  {
    slug: CANONICAL_CATEGORIES.voiceOverArtist.slug,
    title: CANONICAL_CATEGORIES.voiceOverArtist.name,
    description:
      "Find a professional voiceover artist to give your content the right voice, tone, and emotion.",
    image: "/illustrations/voice-over-artist.webp",
    imageAlt: "Illustration of a voiceover artist recording at a microphone",
    tint: "bg-[#E9E5FF]",
  },
];

const AUTOPLAY_DELAY_MS = 3500;

function getRelativeIndex(index: number, activeIndex: number) {
  let relative = (index - activeIndex + CATEGORIES.length) % CATEGORIES.length;
  if (relative > CATEGORIES.length / 2) relative -= CATEGORIES.length;
  return relative;
}

export function CategorySection() {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [isPaused, setIsPaused] = React.useState(false);

  const showPrevious = React.useCallback(() => {
    setActiveIndex((current) => (current - 1 + CATEGORIES.length) % CATEGORIES.length);
  }, []);

  const showNext = React.useCallback(() => {
    setActiveIndex((current) => (current + 1) % CATEGORIES.length);
  }, []);

  React.useEffect(() => {
    if (prefersReducedMotion || isPaused) return;

    const interval = window.setInterval(showNext, AUTOPLAY_DELAY_MS);
    return () => window.clearInterval(interval);
  }, [isPaused, prefersReducedMotion, showNext]);

  return (
    <section
      className="relative overflow-hidden px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-28"
      aria-labelledby="category-showcase-title"
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-br from-white via-white to-lavender/45"
        aria-hidden="true"
      />

      <div className="mx-auto grid max-w-7xl items-center gap-12 lg:grid-cols-[0.82fr_1.18fr] lg:gap-8 xl:gap-14">
        <div className="max-w-xl lg:pr-6">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Find freelancers
          </p>
          <h2
            id="category-showcase-title"
            className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-[-0.025em] text-foreground sm:text-5xl lg:text-[3.4rem] xl:text-6xl"
          >
            Find freelancers for every type of work
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
            From creative work to technology, marketing, and content — find skilled
            professionals who can bring your project to life.
          </p>
          <Link
            href="/freelancers"
            className="mt-8 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-[0_14px_34px_-20px_rgba(91,76,255,0.75)] transition-all hover:-translate-y-0.5 hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transform-none"
          >
            Explore freelancers
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div
          className="relative min-w-0"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocusCapture={() => setIsPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget)) setIsPaused(false);
          }}
        >
          <motion.div
            role="region"
            aria-roledescription="carousel"
            aria-label="Freelancer categories"
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft") {
                event.preventDefault();
                showPrevious();
              }
              if (event.key === "ArrowRight") {
                event.preventDefault();
                showNext();
              }
            }}
            drag={prefersReducedMotion ? false : "x"}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.14}
            onDragEnd={(_, info) => {
              if (info.offset.x < -45 || info.velocity.x < -350) showNext();
              if (info.offset.x > 45 || info.velocity.x > 350) showPrevious();
            }}
            className="relative h-[500px] touch-pan-y overflow-hidden rounded-[32px] bg-lavender/50 outline-none ring-offset-4 ring-offset-background focus-visible:ring-3 focus-visible:ring-ring/50 sm:h-[560px] lg:h-[590px] lg:rounded-[40px]"
            style={{ perspective: "1200px" }}
          >
            <div
              className="pointer-events-none absolute inset-x-12 top-10 h-px bg-primary/15"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-white/65 blur-3xl"
              aria-hidden="true"
            />

            {CATEGORIES.map((category, index) => {
              const relativeIndex = getRelativeIndex(index, activeIndex);
              const isActive = relativeIndex === 0;
              const isVisible = Math.abs(relativeIndex) <= 1;

              return (
                <motion.button
                  key={category.title}
                  type="button"
                  aria-label={`${isActive ? "Explore" : "Show"} ${category.title}`}
                  aria-current={isActive ? "true" : undefined}
                  aria-hidden={!isVisible}
                  tabIndex={isVisible ? 0 : -1}
                  onClick={() =>
                    isActive
                      ? router.push(categoryHref(category))
                      : setActiveIndex(index)
                  }
                  initial={false}
                  animate={{
                    x: isActive ? "-50%" : relativeIndex < 0 ? "-111%" : "11%",
                    y: "-50%",
                    scale: isActive ? 1 : 0.84,
                    rotateY: isActive ? 0 : relativeIndex < 0 ? 8 : -8,
                    opacity: isActive ? 1 : isVisible ? 0.48 : 0,
                  }}
                  transition={{
                    duration: prefersReducedMotion ? 0 : 0.55,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="absolute left-1/2 top-1/2 h-[420px] w-[82%] max-w-[390px] overflow-hidden rounded-[28px] border border-white/80 bg-white text-left shadow-[0_32px_70px_-36px_rgba(20,21,43,0.45)] focus-visible:ring-3 focus-visible:ring-primary/45 focus-visible:outline-none sm:h-[480px] sm:w-[66%] lg:h-[500px] lg:w-[64%]"
                  style={{
                    zIndex: isActive ? 3 : isVisible ? 2 : 1,
                    pointerEvents: isVisible ? "auto" : "none",
                  }}
                >
                  <div className={`relative h-[58%] overflow-hidden ${category.tint}`}>
                    <span className="absolute left-5 top-5 z-10 rounded-full border border-white/70 bg-white/75 px-3 py-1 text-xs font-semibold tracking-[0.12em] text-primary backdrop-blur-sm">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <Image
                      src={category.image}
                      alt={category.imageAlt}
                      fill
                      priority={index === 0}
                      sizes="(min-width: 1280px) 390px, (min-width: 1024px) 32vw, (min-width: 640px) 46vw, 74vw"
                      className="object-contain object-bottom px-5 pt-8 drop-shadow-[0_22px_30px_rgba(91,76,255,0.16)]"
                    />
                  </div>

                  <div className="flex h-[42%] flex-col px-5 py-5 sm:px-6 sm:py-6">
                    <h3 className="font-display text-xl font-semibold leading-tight text-foreground sm:text-2xl">
                      {category.title}
                    </h3>
                    <p className="mt-3 line-clamp-4 text-sm leading-6 text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </motion.button>
              );
            })}
          </motion.div>

          <div className="mt-5 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2" aria-label="Choose a category">
              {CATEGORIES.map((category, index) => (
                <button
                  key={category.title}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-label={`Go to ${category.title}`}
                  aria-current={index === activeIndex ? "true" : undefined}
                  className={`h-2 rounded-full transition-[width,background-color] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transition-none ${
                    index === activeIndex ? "w-6 bg-primary" : "w-2 bg-primary/20 hover:bg-primary/40"
                  }`}
                />
              ))}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={showPrevious}
                aria-label="Previous category"
                className="flex size-11 items-center justify-center rounded-full border border-primary/15 bg-white text-foreground shadow-sm transition-colors hover:border-primary/35 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={showNext}
                aria-label="Next category"
                className="flex size-11 items-center justify-center rounded-full border border-primary/15 bg-white text-foreground shadow-sm transition-colors hover:border-primary/35 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <ArrowRight className="size-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          <p className="sr-only" aria-live="polite">
            Showing {CATEGORIES[activeIndex].title}, category {activeIndex + 1} of {CATEGORIES.length}
          </p>
        </div>
      </div>
    </section>
  );
}
