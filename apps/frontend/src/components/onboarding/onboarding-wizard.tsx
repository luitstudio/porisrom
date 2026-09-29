"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { completeOnboardingAction, uploadIdentityDocumentAction } from "@/app/onboarding/actions";
import { OnboardingDashboardShell } from "@/components/onboarding/onboarding-dashboard-shell";
import { CustomerProfileStep } from "@/components/onboarding/steps/customer-profile-step";
import { FreelancerProfileStep } from "@/components/onboarding/steps/freelancer-profile-step";
import { PortfolioStep } from "@/components/onboarding/steps/portfolio-step";
import { TermsStep } from "@/components/onboarding/steps/terms-step";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { STEP_TIPS } from "@/lib/onboarding-data";
import {
  EMPTY_CUSTOMER_PROFILE,
  EMPTY_FREELANCER_PROFILE,
  EMPTY_PORTFOLIO,
  type OnboardingRole,
  type Step,
  type TaxonomyItem,
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

type OnboardingWizardProps = {
  freelancerCategories: TaxonomyItem[];
  freelancerSkills: TaxonomyItem[];
  companyCategories: TaxonomyItem[];
};

export function OnboardingWizard({
  freelancerCategories,
  freelancerSkills,
  companyCategories,
}: OnboardingWizardProps) {
  const router = useRouter();
  const { data: session, status, update } = useSession();
  const role = (session?.user.role ?? null) as OnboardingRole | null;

  // Landing here right after signup/login is a client-side transition following a
  // Server Action's redirect(), which doesn't remount the root SessionProvider — so
  // the very first useSession() read can still reflect the pre-sign-in (unauthenticated)
  // state even though the session cookie is already valid. Force one resync on mount.
  const hasRequestedSessionSync = React.useRef(false);
  const [hasCompletedSessionSync, setHasCompletedSessionSync] = React.useState(false);
  React.useEffect(() => {
    if (status !== "unauthenticated" || hasRequestedSessionSync.current) return;
    hasRequestedSessionSync.current = true;
    void update().finally(() => setHasCompletedSessionSync(true));
  }, [status, update]);

  const hasSynced = status === "authenticated" || hasCompletedSessionSync;

  const [stepIndex, setStepIndex] = React.useState(0);
  const [validity, setValidity] = React.useState<Record<string, boolean>>({});
  const [pending, setPending] = React.useState(false);
  const [completed, setCompleted] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [identityDocumentStatus, setIdentityDocumentStatus] = React.useState<"not_submitted" | "pending">("not_submitted");

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
    if (!role || pending) return;
    setPending(true);
    setActionError(null);
    try {
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
              categoryIds: freelancerProfile.professions.map((category) => category.id),
              skillIds: portfolio.skills.map((skill) => skill.id),
              links: portfolio.links,
            }
          : {
              companyName: customerProfile.companyName,
              about: customerProfile.about,
              address: customerProfile.address,
              state: customerProfile.state,
              categoryIds: customerProfile.categories.map((category) => category.id),
            }
      );

      if ("error" in result) {
        setPending(false);
        setActionError(result.error);
        return;
      }

      if (role === "freelancer" && freelancerProfile.aadhaarFiles[0]) {
        const documentForm = new FormData();
        documentForm.set("document", freelancerProfile.aadhaarFiles[0]);
        const documentResult = await uploadIdentityDocumentAction(documentForm);
        if ("error" in documentResult) {
          setPending(false);
          setActionError(documentResult.error);
          return;
        }
        setIdentityDocumentStatus(documentResult.status);
      }

      await update({ isOnboarded: true });
      setCompleted(true);
      router.push(result.redirectTo);
    } catch {
      setPending(false);
      setActionError("We couldn’t finish setting up your profile. Please try again.");
    }
  }

  function handleContinue() {
    if (pending || !canContinue) return;
    if (isLastStep) {
      void handleFinish();
      return;
    }
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function handleBack() {
    if (pending) return;
    setActionError(null);
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  if (status === "loading" || !hasSynced) {
    return <OnboardingLoadingState />;
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
  const validationHint =
    currentStep.id === "profile"
      ? role === "freelancer"
        ? "Enter your full name and select at least one category to continue."
        : "Enter your company name and select at least one business category to continue."
      : currentStep.id === "portfolio"
        ? "Select at least one canonical skill to continue."
        : "Accept the Terms and Privacy Policy to finish setup.";

  return (
    <OnboardingDashboardShell
      roleLabel={roleLabel}
      steps={steps}
      currentStep={stepIndex}
      tip={STEP_TIPS[currentStep.id]}
    >
      <div className="flex min-w-0 flex-col gap-5 sm:gap-6">
        <div className="min-w-0">
          <h1 className="break-words font-display text-xl font-semibold leading-tight text-foreground min-[375px]:text-2xl sm:text-3xl">
            {stepCopy.title}
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{stepCopy.description}</p>
        </div>

        {steps.map((step) => (
          <div key={step.id} className={cn(step.id !== currentStep.id && "hidden")}>
            {step.id === "profile" && role === "freelancer" && (
              <FreelancerProfileStep
                value={freelancerProfile}
                onChange={setFreelancerProfile}
                onValidityChange={(valid) => setStepValid(step.id, valid)}
                categories={freelancerCategories}
                identityDocumentStatus={identityDocumentStatus}
              />
            )}
            {step.id === "profile" && role === "client" && (
              <CustomerProfileStep
                value={customerProfile}
                onChange={setCustomerProfile}
                onValidityChange={(valid) => setStepValid(step.id, valid)}
                categories={companyCategories}
              />
            )}
            {step.id === "portfolio" && (
              <PortfolioStep
                value={portfolio}
                onChange={setPortfolio}
                onValidityChange={(valid) => setStepValid(step.id, valid)}
                skills={freelancerSkills}
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

        {!canContinue && !pending && (
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {validationHint}
          </p>
        )}

        {actionError && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{actionError}</AlertDescription>
          </Alert>
        )}

        {completed && (
          <Alert aria-live="polite">
            <CheckCircle2 className="size-4 text-primary" />
            <AlertDescription>Profile setup complete. Taking you to your dashboard…</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 items-center gap-3 border-t border-border pt-5 sm:pt-6">
          {stepIndex > 0 ? (
            <Button className="min-h-11 justify-self-start px-4" variant="ghost" onClick={handleBack} disabled={pending}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <span />
          )}

          <Button className="min-h-11 w-full justify-self-end px-4 min-[375px]:w-auto" onClick={handleContinue} disabled={!canContinue || pending}>
            {pending ? (
              <>
                {completed ? <CheckCircle2 className="size-4" /> : <Loader2 className="size-4 animate-spin" />}
                {completed ? "Redirecting…" : "Saving…"}
              </>
            ) : (
              <>
                {isLastStep ? "Finish setup" : "Continue"}
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </OnboardingDashboardShell>
  );
}

function OnboardingLoadingState() {
  return (
    <div className="min-h-screen overflow-x-clip bg-background px-3 py-5 min-[375px]:px-4 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-6xl animate-pulse" aria-label="Loading onboarding" aria-busy="true">
        <div className="h-11 w-28 rounded-lg bg-muted" />
        <div className="mt-8 h-2 w-full rounded-full bg-muted" />
        <div className="mt-8 h-8 w-56 max-w-[80%] rounded-lg bg-muted" />
        <div className="mt-3 h-4 w-full max-w-md rounded bg-muted" />
        <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="h-44 rounded-xl bg-muted" />
          <div className="h-44 rounded-xl bg-muted lg:col-span-2" />
          <div className="h-44 rounded-xl bg-muted" />
          <div className="h-44 rounded-xl bg-muted lg:col-span-2" />
        </div>
      </div>
    </div>
  );
}
