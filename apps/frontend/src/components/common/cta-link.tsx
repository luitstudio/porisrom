import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";

type CtaLinkProps = {
  href: string;
  children: React.ReactNode;
  variant?: "solid" | "outline" | "dark";
  className?: string;
};

const VARIANT_CLASSES: Record<NonNullable<CtaLinkProps["variant"]>, string> = {
  solid: "bg-primary text-primary-foreground hover:bg-primary/90",
  outline:
    "border border-foreground/15 bg-background text-foreground hover:bg-foreground/5",
  dark: "border border-white/20 bg-transparent text-white hover:bg-white/10",
};

export function CtaLink({
  href,
  children,
  variant = "solid",
  className,
}: CtaLinkProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-medium transition-colors",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
      <ArrowUpRight className="size-4" />
    </Link>
  );
}
