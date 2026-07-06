import Link from "next/link";
import { Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

type MobileFreelancerCardProps = {
  name: string;
  initials: string;
  role: string;
  href: string;
  badge:
    | { type: "rating"; value: string }
    | { type: "status"; label: string; className: string };
};

export function MobileFreelancerCard({
  name,
  initials,
  role,
  href,
  badge,
}: MobileFreelancerCardProps) {
  return (
    <Link
      href={href}
      className="flex w-40 shrink-0 snap-start flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-transform active:scale-95"
    >
      <div className="flex items-center justify-between">
        <Avatar size="lg">
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        {badge.type === "rating" ? (
          <span className="flex items-center gap-0.5 text-xs font-semibold text-foreground">
            <Star className="size-3.5 fill-amber-400 text-amber-400" />
            {badge.value}
          </span>
        ) : (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-[11px] font-medium",
              badge.className
            )}
          >
            {badge.label}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="truncate text-sm font-semibold text-foreground">{name}</h3>
        <p className="truncate text-xs text-muted-foreground">{role}</p>
      </div>
    </Link>
  );
}
