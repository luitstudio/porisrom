import { TrendingUp } from "lucide-react";

import { KPI_STATS } from "@/lib/freelancer-dashboard-data";

export function KpiRow({ className = "" }: { className?: string }) {
  return (
    <div className={`grid grid-cols-2 gap-4 lg:grid-cols-4 ${className}`}>
      {KPI_STATS.map((stat) => (
        <div
          key={stat.label}
          className="rounded-2xl border border-border bg-card p-5 shadow-[0_1px_2px_rgba(20,21,43,0.04)]"
        >
          <p className="text-xs font-medium text-muted-foreground">{stat.label}</p>
          <p className="mt-2 font-display text-2xl font-semibold text-foreground">{stat.value}</p>
          <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-primary">
            <TrendingUp className="size-3.5" />
            {stat.trend}
          </p>
        </div>
      ))}
    </div>
  );
}
