import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  supportingText?: string;
  status?: ReactNode;
};

export function MetricCard({ icon: Icon, label, value, supportingText, status }: MetricCardProps) {
  return (
    <Card className="min-w-0 shadow-[var(--shadow-subtle)]">
      <CardContent className="flex min-w-0 flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-accent text-primary">
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {status}
        </div>
        <div className="min-w-0">
          <p className="text-label font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 break-words font-display text-section-title font-semibold text-foreground">{value}</p>
          {supportingText && <p className="mt-1 text-metadata text-muted-foreground">{supportingText}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
