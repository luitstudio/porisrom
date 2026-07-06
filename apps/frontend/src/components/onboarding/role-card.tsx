import { Check, Clock, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type RoleCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  benefits: string[];
  setupTime: string;
  selected: boolean;
  onSelect: () => void;
};

export function RoleCard({
  icon: Icon,
  title,
  description,
  benefits,
  setupTime,
  selected,
  onSelect,
}: RoleCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "group relative flex flex-col gap-5 rounded-3xl border-2 bg-card p-8 text-left shadow-sm transition-all duration-200",
        selected
          ? "scale-[1.02] border-primary shadow-lg shadow-primary/10"
          : "border-border hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md"
      )}
    >
      <span
        className={cn(
          "absolute top-6 right-6 flex size-7 items-center justify-center rounded-full border-2 transition-all",
          selected
            ? "scale-100 border-primary bg-primary text-primary-foreground opacity-100"
            : "scale-75 border-border bg-background text-transparent opacity-0"
        )}
      >
        <Check className="size-4" />
      </span>

      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-2xl transition-colors",
          selected ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
        )}
      >
        <Icon className="size-6" />
      </span>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-display text-2xl font-semibold text-foreground">
            {title}
          </h3>
          <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            <Clock className="size-3.5" />
            {setupTime}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {benefits.map((benefit) => (
          <Badge key={benefit} variant="secondary" className="rounded-full">
            {benefit}
          </Badge>
        ))}
      </div>
    </button>
  );
}
