"use client";

import { ArrowRight, Briefcase, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { RoleCard } from "@/components/onboarding/role-card";
import { ROLE_BENEFITS, ROLE_SETUP_TIME } from "@/lib/onboarding-data";
import type { OnboardingRole } from "@/lib/onboarding-types";

type RoleSelectionScreenProps = {
  value: OnboardingRole | null;
  onChange: (role: OnboardingRole) => void;
  onContinue: () => void;
  pending?: boolean;
  error?: string | null;
};

export function RoleSelectionScreen({
  value,
  onChange,
  onContinue,
  pending = false,
  error = null,
}: RoleSelectionScreenProps) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-16 sm:px-6">
      <div className="flex w-full max-w-4xl flex-col gap-10">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-sm font-medium uppercase tracking-wide text-primary">
            Welcome to Porisrom
          </span>
          <h1 className="font-display text-3xl font-semibold text-foreground sm:text-4xl">
            How would you like to get started?
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Choose the workspace that fits you — you can always set up the
            other side later.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <RoleCard
            icon={Briefcase}
            title="I'm a Freelancer"
            description="Showcase your skills, build a portfolio, and get hired by clients across Assam."
            benefits={ROLE_BENEFITS.freelancer}
            setupTime={ROLE_SETUP_TIME.freelancer}
            selected={value === "freelancer"}
            onSelect={() => onChange("freelancer")}
          />
          <RoleCard
            icon={Users}
            title="I'm a Client"
            description="Hire trusted freelancers, manage projects, and grow your business."
            benefits={ROLE_BENEFITS.client}
            setupTime={ROLE_SETUP_TIME.client}
            selected={value === "client"}
            onSelect={() => onChange("client")}
          />
        </div>

        <div
          className={cn(
            "flex justify-center transition-all duration-300",
            value ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
          )}
        >
          <Button size="lg" onClick={onContinue} disabled={!value || pending}>
            {pending ? "Saving..." : "Continue"}
            <ArrowRight className="size-4" />
          </Button>
        </div>

        {error && (
          <p className="text-center text-sm text-destructive">{error}</p>
        )}
      </div>
    </div>
  );
}
