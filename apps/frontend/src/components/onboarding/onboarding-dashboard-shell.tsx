import Link from "next/link";

import { MobileStepHeader, SidebarNav } from "@/components/onboarding/sidebar-nav";
import type { Step } from "@/lib/onboarding-types";

type OnboardingDashboardShellProps = {
  roleLabel: string;
  steps: Step[];
  currentStep: number;
  tip?: string;
  onSwitchRole: () => void;
  children: React.ReactNode;
};

export function OnboardingDashboardShell({
  roleLabel,
  steps,
  currentStep,
  tip,
  onSwitchRole,
  children,
}: OnboardingDashboardShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
          <Link href="/" className="font-display text-lg font-semibold text-foreground">
            Porisrom
          </Link>
          <button
            type="button"
            onClick={onSwitchRole}
            className="text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Not a {roleLabel.toLowerCase()}? Switch
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:flex-row lg:gap-12 lg:px-8 lg:py-12">
        <SidebarNav roleLabel={roleLabel} steps={steps} currentStep={currentStep} tip={tip} />
        <MobileStepHeader roleLabel={roleLabel} steps={steps} currentStep={currentStep} />

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
