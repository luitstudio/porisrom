import Link from "next/link";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type MobileServiceCardProps = {
  icon: LucideIcon;
  title: string;
  meta: string;
  href: string;
  badgeClassName?: string;
};

export function MobileServiceCard({
  icon: Icon,
  title,
  meta,
  href,
  badgeClassName = "bg-lavender text-primary",
}: MobileServiceCardProps) {
  return (
    <Link
      href={href}
      className="flex w-36 shrink-0 snap-start flex-col gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm transition-transform active:scale-95"
    >
      <span
        className={cn(
          "flex size-10 items-center justify-center rounded-xl",
          badgeClassName
        )}
      >
        <Icon className="size-5" />
      </span>
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold leading-snug text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground">{meta}</p>
      </div>
    </Link>
  );
}
