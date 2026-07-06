"use client";

import { motion } from "framer-motion";
import { Camera, Check, Code2, IndianRupee, PenTool, Star } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const SKILL_BADGES = [
  { icon: Code2, label: "Developer" },
  { icon: PenTool, label: "Designer" },
  { icon: Camera, label: "Photographer" },
];

export function MarketplaceIllustration() {
  return (
    <div aria-hidden="true" className="pointer-events-none relative h-full w-full select-none">
      <FloatingCard className="absolute right-0 top-2" delay={0.2}>
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback>AS</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">UI/UX Designer</span>
            <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
              <Star className="size-3 fill-amber-400 text-amber-400" />
              4.9 (120)
            </span>
          </div>
        </div>
      </FloatingCard>

      <FloatingCard className="absolute left-0 top-24" delay={0.4}>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-lavender text-primary">
            <Check className="size-3.5" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">Project Completed</span>
            <span className="text-[11px] text-muted-foreground">2 days ago</span>
          </div>
        </div>
      </FloatingCard>

      <FloatingCard className="absolute bottom-20 right-4" delay={0.55}>
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-blush text-foreground">
            <IndianRupee className="size-3.5" />
          </span>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-foreground">Logo Design</span>
            <span className="text-[11px] text-muted-foreground">₹6,000 earned</span>
          </div>
        </div>
      </FloatingCard>

      <FloatingCard className="absolute bottom-0 left-6" delay={0.7}>
        <div className="flex items-center gap-1 text-amber-500">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} className="size-3 fill-current" />
          ))}
          <span className="ml-1 text-[11px] font-medium text-muted-foreground">
            Client Review
          </span>
        </div>
      </FloatingCard>

      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2.5">
        {SKILL_BADGES.map(({ icon: Icon, label }) => (
          <span
            key={label}
            className="flex items-center gap-1 rounded-full border border-white/80 bg-white/90 px-2.5 py-1 text-[11px] font-medium text-foreground shadow-sm"
          >
            <Icon className="size-3" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

function FloatingCard({
  className,
  delay = 0,
  children,
}: {
  className?: string;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: [0, -6, 0] }}
      transition={{
        opacity: { duration: 0.5, delay },
        y: { duration: 4, repeat: Infinity, ease: "easeInOut", delay },
      }}
      className={`rounded-2xl border border-white/80 bg-white/90 p-3 shadow-[0_12px_30px_-12px_rgba(20,21,43,0.18)] backdrop-blur-md ${className ?? ""}`}
    >
      {children}
    </motion.div>
  );
}
