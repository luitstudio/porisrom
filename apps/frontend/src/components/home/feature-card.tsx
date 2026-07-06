import { cn } from "@/lib/utils";

type FeatureCardProps = {
  title: string;
  description: string;
  variant?: "primary" | "light" | "dark";
  className?: string;
};

const VARIANT_CLASSES: Record<NonNullable<FeatureCardProps["variant"]>, string> = {
  primary: "bg-primary text-primary-foreground",
  light: "bg-secondary text-foreground",
  dark: "bg-navy text-white",
};

export function FeatureCard({
  title,
  description,
  variant = "light",
  className,
}: FeatureCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl p-7",
        VARIANT_CLASSES[variant],
        className
      )}
    >
      <h3 className="text-xl font-semibold">{title}</h3>
      <p
        className={cn(
          "text-sm leading-relaxed",
          variant === "light" ? "text-muted-foreground" : "text-white/80"
        )}
      >
        {description}
      </p>
    </div>
  );
}
