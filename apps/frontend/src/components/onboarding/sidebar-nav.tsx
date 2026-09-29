import { Check, Lightbulb } from "lucide-react";

import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import type { Step } from "@/lib/onboarding-types";

type SidebarNavProps = {
  roleLabel: string;
  steps: Step[];
  currentStep: number;
  tip?: string;
};

export function SidebarNav({ roleLabel, steps, currentStep, tip }: SidebarNavProps) {
  const percent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-8 lg:sticky lg:top-8 lg:flex lg:self-start">
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium uppercase tracking-wide text-primary">
          {roleLabel} setup
        </span>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
          <span>{percent}%</span>
        </div>
        <Progress value={percent} />
      </div>

      <ol className="flex flex-col gap-1">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isActive = index === currentStep;
          return (
            <li key={step.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isComplete && "border-primary bg-primary text-primary-foreground",
                    isActive && "border-primary bg-background text-primary",
                    !isComplete && !isActive && "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isComplete ? <Check className="size-3.5" /> : index + 1}
                </span>
                {index < steps.length - 1 && (
                  <span
                    className={cn(
                      "my-1 h-6 w-0.5 rounded-full",
                      isComplete ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </div>
              <span
                className={cn(
                  "pt-1 text-sm font-medium",
                  isActive || isComplete ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>

      {tip && (
        <div className="flex flex-col gap-2 rounded-2xl bg-accent p-4">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-accent-foreground">
            <Lightbulb className="size-3.5" />
            Tip
          </span>
          <p className="text-xs leading-relaxed text-accent-foreground/80">{tip}</p>
        </div>
      )}
    </aside>
  );
}

export function MobileStepHeader({ roleLabel, steps, currentStep }: SidebarNavProps) {
  const percent = Math.round(((currentStep + 1) / steps.length) * 100);

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-3 lg:hidden">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span className="font-medium uppercase tracking-wide text-primary">
          {roleLabel} setup
        </span>
        <span>
          Step {currentStep + 1} of {steps.length}
        </span>
      </div>
      <Progress value={percent} />
      <div className="flex max-w-full items-center gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {steps.map((step, index) => {
          const isComplete = index < currentStep;
          const isActive = index === currentStep;
          return (
            <span
              key={step.id}
              className={cn(
                "flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap",
                isActive && "border-primary bg-accent text-foreground",
                isComplete && !isActive && "border-primary/40 text-foreground",
                !isActive && !isComplete && "border-border text-muted-foreground"
              )}
            >
              {isComplete ? (
                <Check className="size-3 text-primary" />
              ) : (
                <span>{index + 1}.</span>
              )}
              {step.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
