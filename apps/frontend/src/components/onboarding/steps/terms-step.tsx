"use client";

import * as React from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { SummaryCard } from "@/components/onboarding/summary-card";
import { TERMS_SECTIONS } from "@/lib/onboarding-data";
import type {
  CustomerProfileData,
  FreelancerProfileData,
  OnboardingRole,
  PortfolioData,
} from "@/lib/onboarding-types";

type TermsStepProps = {
  role: OnboardingRole;
  freelancerProfile: FreelancerProfileData;
  customerProfile: CustomerProfileData;
  portfolio: PortfolioData;
  accepted: boolean;
  onAcceptedChange: (accepted: boolean) => void;
  onValidityChange: (valid: boolean) => void;
};

export function TermsStep({
  role,
  freelancerProfile,
  customerProfile,
  portfolio,
  accepted,
  onAcceptedChange,
  onValidityChange,
}: TermsStepProps) {
  React.useEffect(() => {
    onValidityChange(accepted);
  }, [accepted, onValidityChange]);

  const summaryRows =
    role === "freelancer"
      ? [
          { label: "Name", value: freelancerProfile.name },
          {
            label: "Location",
            value: [freelancerProfile.district, freelancerProfile.state]
              .filter(Boolean)
              .join(", "),
          },
          { label: "Language", value: freelancerProfile.language },
          {
            label: "Professions",
            value: freelancerProfile.professions.join(", "),
          },
          { label: "Experience", value: freelancerProfile.experience },
          {
            label: "Portfolio samples",
            value: portfolio.files.length
              ? `${portfolio.files.length} uploaded`
              : "",
          },
          { label: "Skills", value: portfolio.skills.join(", ") },
        ]
      : [
          { label: "Company name", value: customerProfile.companyName },
          { label: "Location", value: customerProfile.state },
          {
            label: "Business category",
            value: customerProfile.categories.join(", "),
          },
        ];

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <div className="rounded-2xl bg-card shadow-sm">
          <Accordion className="px-2">
            {TERMS_SECTIONS.map((section) => (
              <AccordionItem key={section.title} value={section.title}>
                <AccordionTrigger className="px-2">
                  {section.title}
                </AccordionTrigger>
                <AccordionContent className="px-2 text-muted-foreground">
                  {section.body}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-accent p-4">
          <Checkbox
            checked={accepted}
            onCheckedChange={(checked) => onAcceptedChange(checked === true)}
            className="mt-0.5"
          />
          <span className="text-sm text-accent-foreground">
            Yes, I have read and accept the Terms &amp; Conditions and Privacy
            Policy.
          </span>
        </label>
      </div>

      <SummaryCard
        title="Your profile at a glance"
        rows={summaryRows}
      />
    </div>
  );
}
