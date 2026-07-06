"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Search } from "lucide-react";

const EXAMPLE_GROUPS = [
  ["Video Editor", "Graphic Designer", "UI Designer"],
  ["Photographer", "Web Developer", "Content Writer"],
  ["Motion Designer", "Digital Marketer", "Video Production"],
  ["Logo Design", "Video Editor", "Web Developer"],
];

const POPULAR_TAGS = [
  "Video Editing",
  "Graphic Design",
  "Web Development",
  "Content Writing",
  "Social Media",
];

export function MarketplaceSearch() {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [exampleIndex, setExampleIndex] = React.useState(0);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setExampleIndex((i) => (i + 1) % EXAMPLE_GROUPS.length);
    }, 2800);
    return () => clearInterval(interval);
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = query.trim() ? `?service=${encodeURIComponent(query.trim())}` : "";
    router.push(`/freelancers${params}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
      className="mx-auto flex w-full flex-col items-center gap-4"
    >
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Find freelancers, skills or services"
        className="group/search grid h-[60px] w-full max-w-[1040px] grid-cols-[44px_minmax(0,1fr)_48px] items-center gap-2 rounded-full border border-[rgba(108,76,247,0.08)] bg-white p-2 shadow-[0_15px_50px_rgba(40,40,60,0.08)] transition-all duration-250 focus-within:border-primary/45 focus-within:shadow-[0_18px_60px_rgba(91,76,255,0.14)] sm:h-[90px] sm:grid-cols-[56px_minmax(0,1fr)_64px] sm:gap-5 sm:p-[13px]"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-lavender/80 text-primary sm:size-14">
          <Search className="size-5 sm:size-5" aria-hidden="true" />
        </span>

        <label htmlFor="hero-marketplace-search" className="sr-only">
          What service are you looking for?
        </label>
        <div className="flex min-w-0 flex-col items-start justify-center text-left">
          <span className="hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:block">
            What service are you looking for?
          </span>
          <input
            id="hero-marketplace-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search freelancers..."
            className="mt-0 min-w-0 w-full bg-transparent text-base font-medium text-foreground outline-none transition-colors duration-250 placeholder:text-foreground/45 focus:placeholder:text-foreground/25 sm:mt-1 sm:text-[18px] sm:placeholder:text-foreground/50"
          />
          <AnimatePresence mode="wait">
            <motion.span
              key={exampleIndex}
              initial={{ opacity: 0, y: 3 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -3 }}
              transition={{ duration: 0.25 }}
              className="hidden truncate text-sm text-muted-foreground sm:block"
              aria-hidden="true"
            >
              {EXAMPLE_GROUPS[exampleIndex].join(" • ")}
            </motion.span>
          </AnimatePresence>
        </div>

        <motion.button
          type="submit"
          aria-label="Search"
          whileHover={{ scale: 1.03, y: -2 }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.25 }}
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-[#111827] text-white shadow-[0_14px_28px_-18px_rgba(17,24,39,0.8)] transition-colors duration-250 hover:bg-primary hover:shadow-[0_18px_36px_-20px_rgba(91,76,255,0.8)] sm:size-16"
        >
          <Search className="size-5 sm:size-[22px]" aria-hidden="true" />
        </motion.button>
      </form>

      <div className="hidden w-full max-w-[1040px] items-center gap-3 overflow-hidden sm:flex">
        <span className="shrink-0 text-sm font-semibold text-foreground/75">
          Popular:
        </span>
        <div className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:justify-center sm:overflow-visible sm:pb-0">
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setQuery(tag);
                router.push(`/freelancers?service=${encodeURIComponent(tag)}`);
              }}
              className="shrink-0 rounded-full bg-lavender/70 px-4 py-2 text-sm font-medium text-primary/85 transition-all duration-250 hover:-translate-y-0.5 hover:bg-primary hover:text-white focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
