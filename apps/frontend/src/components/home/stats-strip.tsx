"use client";

import { motion } from "framer-motion";

import { Separator } from "@/components/ui/separator";

const STATS = [
  { value: "25K+", label: "Active Freelancers" },
  { value: "8K+", label: "Projects Posted" },
  { value: "12K+", label: "Projects Completed" },
  { value: "4.9★", label: "Average Rating" },
];

export function StatsStrip() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="grid w-full grid-cols-2 items-center gap-y-6 rounded-3xl border border-white/60 bg-white/40 px-6 py-6 backdrop-blur-md sm:grid-cols-4 sm:gap-y-0"
    >
      {STATS.map((stat, index) => (
        <div key={stat.label} className="flex items-center justify-center gap-px">
          {index > 0 && (
            <Separator
              orientation="vertical"
              className="mr-6 hidden h-10 bg-foreground/10 sm:block"
            />
          )}
          <div className="flex flex-col items-center text-center">
            <span className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
              {stat.value}
            </span>
            <span className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {stat.label}
            </span>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
