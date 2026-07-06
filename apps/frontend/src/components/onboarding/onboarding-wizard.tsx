"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { completeOnboardingAction, setRoleAction } from "@/app/onboarding/actions";
import { RoleSelectionScreen } from "@/components/onboarding/role-selection-screen";
import { OnboardingDashboardShell } from "@/components/onboarding/onboarding-dashboard-shell";
import { CustomerProfileStep } from "@/components/onboarding/steps/customer-profile-step";
import { FreelancerProfileStep } from "@/components/onboarding/steps/freelancer-profile-step";
import { PortfolioStep } from "@/components/onboarding/steps/portfolio-step";
import { TermsStep } from "@/components/onboarding/steps/terms-step";
import { Button } from "@/components/ui/button";
import { STEP_TIPS } from "@/lib/onboarding-data";
import {
  EMPTY_CUSTOMER_PROFILE,
  EMPTY_FREELANCER_PROFILE,
  EMPTY_PORTFOLIO,
  type OnboardingRole,
  type Step,
} from "@/lib/onboarding-types";

const STEPS: Record<OnboardingRole, Step[]> = {
  client: [
    { id: "profile", label: "Business profile" },
    { id: "terms", label: "Terms & review" },
  ],
  freelancer: [
    { id: "profile", label: "Profile" },
    { id: "portfolio", label: "Portfolio" },
    { id: "terms", label: "Terms & review" },
  ],
};

const STEP_TITLES: Record<string, { title: string; description: string }> = {
  profile: {
    title: "Create your profile",
    description: "This is what clients and freelancers will see first.",
  },
  portfolio: {
    title: "Portfolio management",
    description: "Show off your best work — first impressions matter.",
  },
  terms: {
    title: "Terms & review",
    description: "Double-check everything before you go live.",
  },
};

export function OnboardingWizard() {
  const router = useRouter();
  const { update: updateSession } = useSession();
  const [phase, setPhase] = React.useState<"role" | "form">("role");
  const [role, setRole] = React.useState<OnboardingRole | null>(null);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [validity, setValidity] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [freelancerProfile, setFreelancerProfile] = React.useState(
    EMPTY_FREELANCER_PROFILE
  );
  const [customerProfile, setCustomerProfile] = React.useState(
    EMPTY_CUSTOMER_PROFILE
  );
  const [portfolio, setPortfolio] = React.useState(EMPTY_PORTFOLIO);
  const [accepted, setAccepted] = React.useState(false);

  const steps = role ? STEPS[role] : [];
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const canContinue = currentStep ? validity[currentStep.id] ?? false : false;

  function setStepValid(stepId: string, valid: boolean) {
    setValidity((prev) =>
      prev[stepId] === valid ? prev : { ...prev, [stepId]: valid }
    );
  }

  function handleSwitchRole() {
    setPhase("role");
    setStepIndex(0);
    setValidity({});
    setActionError(null);
  }

  async function handleRoleContinue() {
    if (!role) return;
    setPending(true);
    setActionError(null);
    const result = await setRoleAction(role);
    setPending(false);
    if ("error" in result) {
      setActionError(result.error);
      return;
    }
    setPhase("form");
  }

  async function handleFinish() {
    if (!role) return;
    setPending(true);
    setActionError(null);

    const checks: Record<string, boolean> =
      role === "freelancer"
        ? {
            avatar: Boolean(freelancerProfile.avatarFile),
            language: freelancerProfile.language.length > 0,
            location: freelancerProfile.state.length > 0,
            professions: freelancerProfile.professions.length > 0,
            experience: freelancerProfile.experience.length > 0,
            about: freelancerProfile.about.trim().length > 0,
            portfolioSamples: portfolio.files.length > 0,
            skills: portfolio.skills.length > 0,
          }
        : {
            logo: Boolean(customerProfile.logoFile),
            address: customerProfile.address.length > 0,
            categories: customerProfile.categories.length > 0,
            about: customerProfile.about.trim().length > 0,
          };

    const result = await completeOnboardingAction(role, checks);
    if ("error" in result) {
      setPending(false);
      setActionError(result.error);
      return;
    }

    await updateSession({ role, isOnboarded: true });
    setPending(false);
    router.push(result.redirectTo);
  }

  function handleContinue() {
    if (isLastStep) {
      void handleFinish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function handleBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (phase === "role" || !role) {
    return (
      <RoleSelectionScreen
        value={role}
        onChange={setRole}
        onContinue={() => void handleRoleContinue()}
        pending={pending}
        error={actionError}
      />
    );
  }

  const roleLabel = role === "freelancer" ? "Freelancer" : "Client";
  const stepCopy = STEP_TITLES[currentStep.id];

  return (
    <OnboardingDashboardShell
      roleLabel={roleLabel}
      steps={steps}
      currentStep={stepIndex}
      tip={STEP_TIPS[currentStep.id]}
      onSwitchRole={handleSwitchRole}
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            {stepCopy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {stepCopy.description}
          </p>
        </div>

        {steps.map((step) => (
          <div key={step.id} className={cn(step.id !== currentStep.id && "hidden")}>
            {step.id === "profile" && role === "freelancer" && (
              <FreelancerProfileStep
                value={freelancerProfile}
                onChange={setFreelancerProfile}
                onValidityChange={(valid) => setStepValid(step.id, valid)}
              />
            )}
            {step.id === "profile" && role === "client" && (
              <CustomerProfileStep
                value={customerProfile}
                onChange={setCustomerProfile}
                onValidityChange={(valid) => setStepValid(step.id, valid)}
              />
            )}
            {step.id === "portfolio" && (
              <PortfolioStep
                value={portfolio}
                onChange={setPortfolio}
                onValidityChange={(valid) => setStepValid(step.id, valid)}
              />
            )}
            {step.id === "terms" && (
              <TermsStep
                role={role}
                freelancerProfile={freelancerProfile}
                customerProfile={customerProfile}
                portfolio={portfolio}
                accepted={accepted}
                onAcceptedChange={setAccepted}
                onValidityChange={(valid) => setStepValid(step.id, valid)}
              />
            )}
          </div>
        ))}

        {actionError && <p className="text-sm text-destructive">{actionError}</p>}

        <div className="flex items-center justify-between gap-3 border-t border-border pt-6">
          {stepIndex > 0 ? (
            <Button variant="ghost" onClick={handleBack} disabled={pending}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <span />
          )}

          <Button onClick={handleContinue} disabled={!canContinue || pending}>
            {pending ? "Saving..." : isLastStep ? "Finish setup" : "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </div>
    </OnboardingDashboardShell>
  );
}
