import type { LucideIcon } from "lucide-react";

type ComingSoonProps = {
  title: string;
  description: string;
  icon: LucideIcon;
};

export function ComingSoon({ title, description, icon: Icon }: ComingSoonProps) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-20">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-accent text-foreground">
          <Icon className="size-6" />
        </span>
        <h1 className="mt-5 font-display text-xl font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        <span className="mt-5 inline-flex items-center rounded-full bg-secondary px-3 py-1 text-xs font-medium text-muted-foreground">
          Coming soon
        </span>
      </div>
    </div>
  );
}
