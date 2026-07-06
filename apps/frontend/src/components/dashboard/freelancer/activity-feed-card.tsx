import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ACTIVITY_FEED } from "@/lib/freelancer-dashboard-data";

export function ActivityFeedCard({ title = "Activity Feed" }: { title?: string }) {
  return (
    <Card className="border-border shadow-[0_1px_2px_rgba(20,21,43,0.04)]">
      <CardHeader>
        <CardTitle className="font-display text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="flex flex-col gap-4">
          {ACTIVITY_FEED.map((item, index) => (
            <li key={`${item.title}-${index}`} className="relative flex gap-3 pl-1">
              <div className="relative flex w-2 flex-col items-center">
                <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                {index < ACTIVITY_FEED.length - 1 && (
                  <span className="mt-1 w-px flex-1 bg-border" />
                )}
              </div>
              <div className="pb-1">
                <p className="text-sm text-foreground">
                  <span className="font-medium">{item.title}</span>{" "}
                  <span className="text-muted-foreground">{item.detail}</span>
                </p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.time}</p>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
