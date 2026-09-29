import Link from "next/link";

import { MobileStepHeader, SidebarNav } from "@/components/onboarding/sidebar-nav";
import type { Step } from "@/lib/onboarding-types";

type OnboardingDashboardShellProps = {
  roleLabel: string;
  steps: Step[];
  currentStep: number;
  tip?: string;
  children: React.ReactNode;
};

export function OnboardingDashboardShell({
  roleLabel,
  steps,
  currentStep,
  tip,
  children,
}: OnboardingDashboardShellProps) {
  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between px-3 min-[375px]:px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex min-h-11 items-center font-display text-lg font-semibold text-foreground">
            Porisrom
          </Link>
        </div>
      </header>

      <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-5 px-3 py-5 min-[375px]:px-4 sm:gap-8 sm:px-6 sm:py-8 lg:flex-row lg:gap-12 lg:px-8 lg:py-12">
        <SidebarNav roleLabel={roleLabel} steps={steps} currentStep={currentStep} tip={tip} />
        <MobileStepHeader roleLabel={roleLabel} steps={steps} currentStep={currentStep} />

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
