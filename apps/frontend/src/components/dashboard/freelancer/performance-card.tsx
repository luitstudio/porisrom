"use client";

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { PERFORMANCE_STATS, PROFILE_VIEWS_TREND } from "@/lib/freelancer-dashboard-data";

const chartConfig: ChartConfig = {
  views: {
    label: "Profile views",
    color: "var(--primary)",
  },
};

export function PerformanceCard() {
  return (
    <Card className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
      <CardHeader className="flex-row items-start justify-between">
        <div>
          <CardTitle className="font-display text-lg">My Freelance Performance</CardTitle>
          <CardDescription>Profile views over the last 7 days</CardDescription>
        </div>
        <div className="flex gap-5">
          {PERFORMANCE_STATS.map((stat) => (
            <div key={stat.label} className="text-right">
              <p className="font-display text-xl font-semibold text-foreground">
                {stat.value}
                <span className="text-sm font-medium text-muted-foreground">{stat.suffix}</span>
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="aspect-auto h-[180px] w-full">
          <AreaChart data={PROFILE_VIEWS_TREND} margin={{ left: 0, right: 0, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id="fillViews" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--color-views)" stopOpacity={0.35} />
                <stop offset="95%" stopColor="var(--color-views)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="day"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              fontSize={12}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Area
              dataKey="views"
              type="monotone"
              fill="url(#fillViews)"
              stroke="var(--color-views)"
              strokeWidth={2.5}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
