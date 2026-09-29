import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

type ProfileCompletionBannerProps = {
  percent: number;
  ctaHref: string;
  className?: string;
};

export function ProfileCompletionBanner({
  percent,
  ctaHref,
  className,
}: ProfileCompletionBannerProps) {
  if (percent >= 100) return null;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <h2 className="text-sm font-semibold text-foreground">
            Complete your profile
          </h2>
          <span className="text-sm font-medium text-primary">
            {percent}% completed
          </span>
        </div>
        <Progress value={percent} className="mt-3" />
      </div>

      <Button render={<Link href={ctaHref} />} nativeButton={false} className="shrink-0">
        Continue Setup
        <ArrowRight className="size-4" />
      </Button>
    </div>
  );
}
