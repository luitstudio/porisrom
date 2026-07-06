"use client";

import { motion } from "framer-motion";
import { Handshake, Lock, ShieldCheck, Star, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type Highlight = {
  title: string;
  description: string;
  icon: LucideIcon;
  badgeClassName: string;
};

const HIGHLIGHTS: Highlight[] = [
  {
    title: "Verified Freelancers",
    description: "Every profile is identity-checked and skill-reviewed.",
    icon: ShieldCheck,
    badgeClassName: "bg-lavender text-primary",
  },
  {
    title: "Secure Payments",
    description: "Milestone-based escrow keeps every project protected.",
    icon: Lock,
    badgeClassName: "bg-peach text-foreground",
  },
  {
    title: "Transparent Reviews",
    description: "Real ratings from real clients, visible on every profile.",
    icon: Star,
    badgeClassName: "bg-blush text-foreground",
  },
  {
    title: "Direct Collaboration",
    description: "Message, share files, and manage work without middlemen.",
    icon: Handshake,
    badgeClassName: "bg-orchid/15 text-orchid",
  },
];

export function FeatureHighlights() {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {HIGHLIGHTS.map((highlight, index) => (
        <motion.div
          key={highlight.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 + index * 0.08 }}
          whileHover={{ y: -2 }}
          className="flex flex-col items-center gap-3 rounded-2xl p-4 text-center transition-shadow hover:shadow-[0_12px_30px_-12px_rgba(20,21,43,0.12)] sm:items-start sm:text-left"
        >
          <span
            className={cn(
              "flex size-10 items-center justify-center rounded-xl",
              highlight.badgeClassName
            )}
          >
            <highlight.icon className="size-5" />
          </span>
          <div className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-foreground">{highlight.title}</h3>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {highlight.description}
            </p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
