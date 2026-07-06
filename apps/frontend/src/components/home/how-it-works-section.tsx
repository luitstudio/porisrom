import { StepCard } from "@/components/home/step-card";
import { CtaLink } from "@/components/common/cta-link";

const STEPS = [
  {
    title: "Create your profile",
    description:
      "Showcase your skills, rates, and portfolio. It's your professional identity — make it shine.",
  },
  {
    title: "Discover matched gigs",
    description:
      "Browse curated opportunities matched to your expertise. Apply in seconds with your saved profile.",
  },
  {
    title: "Manage your work",
    description:
      "Track deliverables, deadlines, and client messages in one organised workspace.",
  },
  {
    title: "Get paid on time",
    description:
      "Send professional invoices and receive payments directly — no chasing, no delays.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="bg-navy py-12 sm:py-16 lg:py-24">
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="flex flex-col items-center text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-navy-muted">
            How it works
          </p>
          <h2 className="mt-3 max-w-xl font-display text-3xl font-semibold text-white sm:text-4xl">
            From signup to first payment in days
          </h2>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-2 lg:mt-12 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <StepCard key={step.title} index={i + 1} {...step} />
          ))}
        </div>

        <div className="mt-8 flex justify-center sm:mt-10 lg:mt-12">
          <CtaLink href="/how-it-works" variant="dark">
            See More
          </CtaLink>
        </div>
      </div>
    </section>
  );
}
