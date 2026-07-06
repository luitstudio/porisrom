import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { JOB_PIPELINE } from "@/lib/freelancer-dashboard-data";

export function ActiveJobsCard() {
  const total = JOB_PIPELINE.reduce((sum, stage) => sum + stage.count, 0);

  return (
    <Card className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
      <CardHeader>
        <CardTitle className="font-display text-lg">Active Jobs</CardTitle>
        <CardDescription>Where your applications stand right now</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-secondary">
          {JOB_PIPELINE.map((stage) => (
            <div
              key={stage.stage}
              style={{ width: `${(stage.count / total) * 100}%`, backgroundColor: stage.color }}
            />
          ))}
        </div>
        <ul className="flex flex-col gap-2.5">
          {JOB_PIPELINE.map((stage) => (
            <li key={stage.stage} className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2 text-muted-foreground">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: stage.color }}
                />
                {stage.stage}
              </span>
              <span className="font-semibold text-foreground">{stage.count}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
