import { TrendingUp } from "lucide-react";

import { KPI_STATS } from "@/lib/freelancer-dashboard-data";

export function KpiCarousel() {
  return (
    <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
      {KPI_STATS.map((stat) => (
        <div
          key={stat.label}
          className="flex w-[150px] shrink-0 snap-start flex-col rounded-2xl border border-border bg-card p-4"
        >
          <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
          <p className="mt-2 font-display text-xl font-semibold text-foreground">{stat.value}</p>
          <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-primary">
            <TrendingUp className="size-3" />
            {stat.trend}
          </p>
        </div>
      ))}
    </div>
  );
}
