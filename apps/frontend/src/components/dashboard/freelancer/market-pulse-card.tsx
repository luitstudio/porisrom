import { Briefcase, Crown } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { MARKET_PULSE } from "@/lib/freelancer-dashboard-data";

export function MarketPulseCard() {
  return (
    <Card className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground">
            <Briefcase className="size-4.5" />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-foreground">
              {MARKET_PULSE.newJobsToday}
            </p>
            <p className="text-xs text-muted-foreground">New jobs posted today</p>
          </div>
        </div>

        <div className="flex items-center gap-3 border-t border-border pt-4">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-foreground">
            <Crown className="size-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">
              {MARKET_PULSE.topEarningSkill.skill}
            </p>
            <p className="text-xs text-muted-foreground">
              Top earning skill · {MARKET_PULSE.topEarningSkill.avgRate}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
