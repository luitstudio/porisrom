"use client";

import { motion } from "framer-motion";

import { Separator } from "@/components/ui/separator";

const HIGHLIGHTS = [
  { value: "Direct Connections", label: "Clients and freelancers" },
  { value: "No Commission", label: "For either side" },
  { value: "Built-in Chat", label: "Communicate in one place" },
  { value: "Work Dashboard", label: "Track project progress" },
];

export function StatsStrip() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, delay: 0.8 }}
      className="grid w-full grid-cols-2 items-center gap-y-6 rounded-3xl border border-white/60 bg-white/40 px-6 py-6 backdrop-blur-md sm:grid-cols-4 sm:gap-y-0"
    >
      {HIGHLIGHTS.map((highlight, index) => (
        <div key={highlight.value} className="flex items-center justify-center gap-px">
          {index > 0 && (
            <Separator
              orientation="vertical"
              className="mr-6 hidden h-10 bg-foreground/10 sm:block"
            />
          )}
          <div className="flex flex-col items-center text-center">
            <span className="font-display text-lg font-semibold text-foreground sm:text-xl">
              {highlight.value}
            </span>
            <span className="mt-1 text-xs text-muted-foreground sm:text-sm">
              {highlight.label}
            </span>
          </div>
        </div>
      ))}
    </motion.div>
  );
}
