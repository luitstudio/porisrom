import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PORTFOLIO_SCORE, PORTFOLIO_SUGGESTIONS } from "@/lib/freelancer-dashboard-data";

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function PortfolioCard() {
  const offset = CIRCUMFERENCE * (1 - PORTFOLIO_SCORE / 100);

  return (
    <Card className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
      <CardHeader>
        <CardTitle className="font-display text-lg">Portfolio Score</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center gap-5">
          <svg width="96" height="96" viewBox="0 0 96 96" className="shrink-0">
            <circle cx="48" cy="48" r={RADIUS} fill="none" stroke="var(--secondary)" strokeWidth="9" />
            <circle
              cx="48"
              cy="48"
              r={RADIUS}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={offset}
              transform="rotate(-90 48 48)"
            />
            <text
              x="48"
              y="48"
              textAnchor="middle"
              dominantBaseline="central"
              fill="var(--foreground)"
              fontSize="22"
              fontWeight="600"
            >
              {PORTFOLIO_SCORE}
            </text>
          </svg>
          <div>
            <p className="font-display text-2xl font-semibold text-foreground">
              {PORTFOLIO_SCORE}/100
            </p>
            <p className="text-xs text-muted-foreground">Stronger profiles get hired faster</p>
          </div>
        </div>

        <ul className="flex flex-col gap-2">
          {PORTFOLIO_SUGGESTIONS.map((suggestion) => (
            <li key={suggestion} className="flex items-start gap-2 text-xs text-muted-foreground">
              <ArrowRight className="mt-0.5 size-3 shrink-0 text-primary" />
              {suggestion}
            </li>
          ))}
        </ul>

        <Link
          href="/dashboard/freelancer/portfolio"
          className="text-xs font-semibold text-primary hover:underline"
        >
          Improve your portfolio
        </Link>
      </CardContent>
    </Card>
  );
}
