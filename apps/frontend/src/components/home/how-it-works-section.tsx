import {
  BadgeIndianRupee,
  BriefcaseBusiness,
  Search,
  UserRound,
  type LucideIcon,
} from "lucide-react";

type JourneyStep = {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon;
};

const STEPS: JourneyStep[] = [
  {
    number: "01",
    title: "Create your profile",
    description:
      "Start by creating your profile on Porisrom. Freelancers can showcase their skills, experience, and expertise, while clients can share their requirements and discover the right professionals for their projects.",
    icon: UserRound,
  },
  {
    number: "02",
    title: "Discover matching gigs",
    description:
      "Discover the right match for your needs. Clients can find experts based on their project requirements, while freelancers can discover opportunities that match their skills and expertise.",
    icon: Search,
  },
  {
    number: "03",
    title: "Manage your work",
    description:
      "Once a project begins, clients and freelancers each get a dedicated dashboard to manage and monitor the work. Track progress, stay updated on important activities, and communicate directly through the built-in chat box — all in one place.",
    icon: BriefcaseBusiness,
  },
  {
    number: "04",
    title: "Pay when work is done",
    description:
      "Agree on the project scope and rates mutually before getting started. Once the work is completed, the client can make the agreed payment directly to the freelancer. Simple, transparent, and based on mutual understanding.",
    icon: BadgeIndianRupee,
  },
];

export function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-24 bg-navy py-14 sm:py-20 lg:py-24"
      aria-labelledby="how-it-works-title"
    >
      <div className="mx-auto max-w-7xl px-5 sm:px-8 lg:px-10">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-navy-muted">
            How it works
          </p>
          <h2
            id="how-it-works-title"
            className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl lg:text-5xl"
          >
            It all starts with the right profile and the right connection.
          </h2>
        </div>

        <ol className="mt-10 sm:mt-12 lg:mt-16 lg:grid lg:grid-cols-4">
          {STEPS.map((step, index) => {
            const Icon = step.icon;

            return (
              <li
                key={step.number}
                className="group relative flex gap-5 pb-10 last:pb-0 lg:block lg:pr-8 lg:pb-0 lg:last:pr-0"
              >
                {index < STEPS.length - 1 && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-6 top-12 w-px bg-white/20 lg:bottom-auto lg:left-6 lg:top-6 lg:h-px lg:w-full"
                  />
                )}

                <div className="relative z-10 flex size-12 shrink-0 items-center justify-center rounded-full border border-white/25 bg-navy text-sm font-semibold tracking-[0.08em] text-white shadow-[0_0_0_8px_var(--color-navy)]">
                  {step.number}
                </div>

                <div className="min-w-0 pt-1 lg:mt-7 lg:pt-0">
                  <span
                    aria-hidden="true"
                    className="mb-5 hidden size-10 items-center justify-center rounded-xl bg-white/10 text-lavender lg:flex"
                  >
                    <Icon className="size-5" strokeWidth={1.8} />
                  </span>

                  <div className="flex items-center gap-3 lg:block">
                    <span
                      aria-hidden="true"
                      className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-lavender lg:hidden"
                    >
                      <Icon className="size-[18px]" strokeWidth={1.8} />
                    </span>
                    <h3 className="text-lg font-semibold text-white">{step.title}</h3>
                  </div>

                  <p className="mt-3 max-w-xl text-sm leading-6 text-navy-muted lg:max-w-none">
                    {step.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
