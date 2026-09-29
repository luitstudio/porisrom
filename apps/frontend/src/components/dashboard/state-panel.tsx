import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type StatePanelProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
};

export function StatePanel({ icon: Icon, title, description, action }: StatePanelProps) {
  return (
    <Card className="min-w-0 bg-muted/70 text-center shadow-none">
      <CardContent className="flex flex-col items-center px-5 py-3 sm:px-6">
        <span className="flex size-10 items-center justify-center rounded-[var(--radius-control)] bg-accent text-primary">
          <Icon className="size-5" aria-hidden="true" />
        </span>
        <h3 className="mt-3 font-heading text-card-title font-semibold text-foreground">{title}</h3>
        <p className="mt-1 max-w-md text-muted-body text-muted-foreground">{description}</p>
        {action && <div className="mt-4">{action}</div>}
      </CardContent>
    </Card>
  );
}
