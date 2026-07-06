import { TrendingUp } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MARKET_PULSE, TRENDING_SKILLS } from "@/lib/freelancer-dashboard-data";

export function TrendingSkillsCard() {
  return (
    <Card className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="font-display text-base">Trending Skills in Assam</CardTitle>
        <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
          <TrendingUp className="size-3.5" />
          {MARKET_PULSE.demandScoreChange}
        </span>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5">
        {TRENDING_SKILLS.map((item) => (
          <div key={item.skill}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="font-medium text-foreground">{item.skill}</span>
              <span className="text-xs font-semibold text-muted-foreground">{item.demand}%</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${item.demand}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
