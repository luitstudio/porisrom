"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Search } from "lucide-react";

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
      className="mx-auto flex w-full max-w-[980px] flex-col items-center gap-5"
    >
      <div className="group/search relative w-full">
        <div
          className="pointer-events-none absolute -inset-1 rounded-[26px] bg-linear-to-r from-primary/30 via-orchid/25 to-magenta/25 opacity-0 blur-xl transition-opacity duration-300 group-focus-within/search:opacity-100"
          aria-hidden="true"
        />

        <form
          onSubmit={handleSubmit}
          role="search"
          aria-label="Find freelancers, skills or services"
          className="relative grid min-h-[68px] w-full grid-cols-[56px_minmax(0,1fr)_56px] items-stretch overflow-hidden rounded-[22px] border border-[#E5E5EE] bg-white/95 shadow-[0_18px_55px_-30px_rgba(20,21,43,0.38)] backdrop-blur-sm transition-[border-color,box-shadow] duration-300 focus-within:border-primary/40 focus-within:shadow-[0_22px_65px_-30px_rgba(91,76,255,0.45)] sm:min-h-[76px] sm:grid-cols-[68px_minmax(0,1fr)_132px]"
        >
          <span className="flex items-center justify-center border-r border-border/80 bg-lavender/45 text-primary transition-colors group-focus-within/search:bg-lavender/80">
            <Search className="size-5" aria-hidden="true" />
          </span>

          <label htmlFor="hero-marketplace-search" className="sr-only">
            What service are you looking for?
          </label>
          <input
            id="hero-marketplace-search"
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by service, skill, or profession"
            className="min-w-0 bg-transparent px-4 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground/70 focus:placeholder:text-muted-foreground/40 sm:px-6 sm:text-base"
          />

          <motion.button
            type="submit"
            aria-label="Search"
            whileHover={{ scale: 0.98 }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="m-2 flex items-center justify-center gap-2 rounded-[14px] bg-navy px-3 text-sm font-semibold text-white shadow-[0_12px_28px_-16px_rgba(17,18,42,0.8)] transition-colors hover:bg-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:m-2.5 sm:px-5"
          >
            <Search className="size-4 sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">Search</span>
            <ArrowRight className="hidden size-4 sm:block" aria-hidden="true" />
          </motion.button>
        </form>
      </div>

      <div className="w-full overflow-hidden">
        <p className="text-left text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Popular services
        </p>
        <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto px-1 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible sm:pb-0">
          {POPULAR_TAGS.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => {
                setQuery(tag);
                router.push(`/freelancers?service=${encodeURIComponent(tag)}`);
              }}
              className="shrink-0 rounded-xl border border-border/90 bg-white px-4 py-2.5 text-sm font-medium text-foreground/75 shadow-[0_8px_24px_-20px_rgba(20,21,43,0.45)] transition-[transform,border-color,color,box-shadow] hover:-translate-y-0.5 hover:border-primary/35 hover:text-primary hover:shadow-[0_14px_30px_-20px_rgba(91,76,255,0.35)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transform-none"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
