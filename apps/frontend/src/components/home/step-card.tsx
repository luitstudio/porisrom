type StepCardProps = {
  index: number;
  title: string;
  description: string;
};

export function StepCard({ index, title, description }: StepCardProps) {
  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-white p-6">
      <span className="inline-flex w-fit items-center rounded-full border border-primary/30 px-3 py-1 text-xs font-medium text-primary">
        {String(index).padStart(2, "0")}
      </span>
      <div className="flex flex-col gap-2">
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
