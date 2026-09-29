import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type BentoCardProps = {
  title: string;
  icon?: LucideIcon;
  span?: "1" | "2" | "3";
  rowSpan?: "1" | "2";
  className?: string;
  children: React.ReactNode;
};

export function BentoCard({
  title,
  icon: Icon,
  span = "1",
  rowSpan = "1",
  className,
  children,
}: BentoCardProps) {
  return (
    <Card
      className={cn(
        "min-w-0 gap-4 border-0 shadow-sm",
        span === "2" && "lg:col-span-2",
        span === "3" && "lg:col-span-3",
        rowSpan === "2" && "lg:row-span-2",
        className
      )}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {Icon && <Icon className="size-4 text-primary" />}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col gap-4">{children}</CardContent>
    </Card>
  );
}
