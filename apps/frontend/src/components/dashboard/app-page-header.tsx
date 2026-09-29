import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AppPageHeaderProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export function AppPageHeader({ title, description, action, className }: AppPageHeaderProps) {
  return (
    <header className={cn("flex min-w-0 flex-wrap items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        <h1 className="break-words font-display text-page-title font-semibold text-foreground">{title}</h1>
        {description && <p className="mt-2 max-w-2xl text-muted-body text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}
