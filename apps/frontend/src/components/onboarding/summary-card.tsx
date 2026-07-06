import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

type SummaryRow = {
  label: string;
  value: string;
};

type SummaryCardProps = {
  title: string;
  rows: SummaryRow[];
};

export function SummaryCard({ title, rows }: SummaryCardProps) {
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader>
        <CardTitle className="text-sm font-semibold text-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <div key={row.label}>
            <div className="flex items-start justify-between gap-4 text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="text-right font-medium text-foreground">
                {row.value || "—"}
              </span>
            </div>
            {index < rows.length - 1 && <Separator className="mt-3" />}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
