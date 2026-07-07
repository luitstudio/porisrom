"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { completeOnboardingAction } from "@/app/onboarding/actions";
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
  const { data: session, status, update } = useSession();
  const role = (session?.user.role ?? null) as OnboardingRole | null;

  // Landing here right after signup/login is a client-side transition following a
  // Server Action's redirect(), which doesn't remount the root SessionProvider — so
  // the very first useSession() read can still reflect the pre-sign-in (unauthenticated)
  // state even though the session cookie is already valid. Force one resync on mount.
  const [hasSynced, setHasSynced] = React.useState(false);
  React.useEffect(() => {
    if (hasSynced || status === "loading") return;
    if (status === "unauthenticated") {
      void update().finally(() => setHasSynced(true));
    } else {
      setHasSynced(true);
    }
  }, [hasSynced, status, update]);

  const [stepIndex, setStepIndex] = React.useState(0);
  const [validity, setValidity] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);

  const [freelancerProfile, setFreelancerProfile] = React.useState(EMPTY_FREELANCER_PROFILE);
  const [customerProfile, setCustomerProfile] = React.useState(EMPTY_CUSTOMER_PROFILE);
  const [portfolio, setPortfolio] = React.useState(EMPTY_PORTFOLIO);
  const [accepted, setAccepted] = React.useState(false);

  const steps = role ? STEPS[role] : [];
  const currentStep = steps[stepIndex];
  const isLastStep = stepIndex === steps.length - 1;
  const canContinue = currentStep ? validity[currentStep.id] ?? false : false;

  function setStepValid(stepId: string, valid: boolean) {
    setValidity((prev) => (prev[stepId] === valid ? prev : { ...prev, [stepId]: valid }));
  }

  async function handleFinish() {
    if (!role) return;
    setPending(true);
    setActionError(null);

    const result = await completeOnboardingAction(
      role,
      role === "freelancer"
        ? {
            about: freelancerProfile.about,
            address: freelancerProfile.address,
            state: freelancerProfile.state,
            district: freelancerProfile.district,
            language: freelancerProfile.language,
            experience: freelancerProfile.experience,
            professions: freelancerProfile.professions,
            skills: portfolio.skills,
            links: portfolio.links,
          }
        : {
            companyName: customerProfile.companyName,
            about: customerProfile.about,
            address: customerProfile.address,
            state: customerProfile.state,
          }
    );

    if ("error" in result) {
      setPending(false);
      setActionError(result.error);
      return;
    }

    // The backend now has isOnboarded=true, but the NextAuth JWT (which the
    // middleware gates /dashboard on) still has the stale pre-onboarding value
    // until we push this update through explicitly.
    await update({ isOnboarded: true });
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

  if (status === "loading" || !hasSynced) {
    return null;
  }

  if (!role) {
    // Role is chosen at signup now, so this shouldn't happen in normal flow —
    // treat it as a session/auth problem rather than offering a role picker here.
    return (
      <div className="flex min-h-screen items-center justify-center px-4 text-center text-sm text-muted-foreground">
        We couldn&apos;t determine your account type. Please log out and log back in.
      </div>
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
    >
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            {stepCopy.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{stepCopy.description}</p>
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
