"use client";

import { motion, type Variants } from "framer-motion";

import { Navbar } from "@/components/layout/navbar";
import { MarketplaceSearch } from "@/components/home/marketplace-search";
import { FeatureHighlights } from "@/components/home/feature-highlights";
import { StatsStrip } from "@/components/home/stats-strip";

type HeroSectionProps = {
  isAuthenticated?: boolean;
};

const headingContainer: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const headingLine: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
};

export function HeroSection({ isAuthenticated = false }: HeroSectionProps) {
  return (
    <section className="relative flex flex-col overflow-hidden bg-linear-to-b from-peach via-white to-lavender lg:min-h-screen">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-16 size-80 rounded-full bg-peach/80 blur-3xl sm:size-112" />
        <div className="absolute -right-24 top-1/4 size-72 rounded-full bg-orchid/25 blur-3xl sm:size-96" />
        <div className="absolute left-1/2 top-1/2 size-128 -translate-x-1/2 -translate-y-1/2 rounded-full bg-lavender/60 blur-3xl" />
        <div className="absolute -bottom-24 right-1/4 size-72 rounded-full bg-blush/60 blur-3xl sm:size-96" />
      </div>

      <Navbar isAuthenticated={isAuthenticated} />

      <div className="relative mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-5 pt-24 pb-6 text-center sm:px-8 sm:pt-28 sm:pb-8 lg:pt-32 lg:pb-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="flex flex-col items-center gap-3"
        >
          <FlourishOrnament />
          <p className="text-sm font-medium uppercase tracking-wide text-primary">
            India&apos;s trusted freelance marketplace
          </p>
        </motion.div>

        <motion.h1
          variants={headingContainer}
          initial="hidden"
          animate="visible"
          className="mt-4 font-display text-4xl font-semibold leading-[1.15] text-foreground sm:text-5xl lg:mt-6 lg:text-6xl"
        >
          <motion.span variants={headingLine} className="block">
            Hire smarter. Work better.
          </motion.span>
          <motion.span
            variants={headingLine}
            className="block bg-linear-to-r from-primary via-orchid to-magenta bg-clip-text text-transparent"
          >
            Grow together.
          </motion.span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-3 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mt-6"
        >
          Porishrom connects skilled freelancers with businesses across India.
          Find trusted professionals, collaborate securely, and grow together.
        </motion.p>

        <div className="mt-6 w-full max-w-[1040px] lg:mt-10">
          <MarketplaceSearch />
        </div>

        <div className="mt-6 hidden w-full max-w-4xl lg:mt-10 lg:block">
          <FeatureHighlights />
        </div>

        <div className="mt-6 hidden w-full max-w-4xl lg:mt-8 lg:block">
          <StatsStrip />
        </div>
      </div>
    </section>
  );
}

function FlourishOrnament() {
  return (
    <svg
      width="120"
      height="28"
      viewBox="0 0 120 28"
      fill="none"
      aria-hidden="true"
      className="text-primary/50"
    >
      <path
        d="M44 14h32"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
        strokeDasharray="1 4"
      />
      <path
        d="M30 14c0-5 -4-9-9-9s-9 4-9 9 4 6 7 6c2.5 0 4-1.5 4-3.5S21.5 13 19.5 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M90 14c0-5 4-9 9-9s9 4 9 9-4 6-7 6c-2.5 0-4-1.5-4-3.5S98.5 13 100.5 13"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
