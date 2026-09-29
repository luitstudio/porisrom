import Image from "next/image";
import Link from "next/link";
import { ArrowRight, BadgeIndianRupee, BriefcaseBusiness, Search, UserRound, type LucideIcon } from "lucide-react";

type JourneyStep = { number: string; title: string; description: string; icon: LucideIcon; href: string; cta: string; image: string; alt: string; tone: "cream" | "red" | "green" };

const STEPS: JourneyStep[] = [
  { number: "01", title: "Create your profile", description: "Showcase your skills, experience, and expertise so the right clients can discover you.", icon: UserRound, href: "/auth/signup", cta: "Get started", image: "/illustrations/porishrom-how-it-works/profile.png", alt: "Hand-drawn freelancer creating a professional profile on a laptop", tone: "cream" },
  { number: "02", title: "Discover matching gigs", description: "Find projects that match your skills, interests, and experience.", icon: Search, href: "/freelancers", cta: "Explore gigs", image: "/illustrations/porishrom-how-it-works/gigs.png", alt: "Hand-drawn freelancer searching through project opportunities", tone: "red" },
  { number: "03", title: "Manage your work", description: "Track projects, collaborate with clients, and keep everything organized in one place.", icon: BriefcaseBusiness, href: "/auth/login", cta: "See how it works", image: "/illustrations/porishrom-how-it-works/work.png", alt: "Hand-drawn professional managing a project checklist on a laptop", tone: "cream" },
  { number: "04", title: "Pay when work is done", description: "Agree on the scope, complete the work, and receive the agreed payment directly.", icon: BadgeIndianRupee, href: "/auth/signup", cta: "Learn about payments", image: "/illustrations/porishrom-how-it-works/payment.png", alt: "Hand-drawn freelancer celebrating a completed payment", tone: "green" },
];

const cardTone = { cream: "bg-[#f7f3e9] text-[#171815]", red: "bg-[#ef3826] text-[#fff9ef]", green: "bg-[#075a50] text-[#fff9ef]" } as const;

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="scroll-mt-24 overflow-hidden bg-[#141512] py-14 sm:py-20 lg:py-24" aria-labelledby="how-it-works-title">
      <div className="mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8">
        <div className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-12">
          <div className="max-w-[43rem]">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#ef3826] sm:text-sm">How it works</p>
            <h2 id="how-it-works-title" className="mt-4 font-display text-4xl font-semibold leading-[0.94] tracking-[-0.055em] text-[#fff9ef] sm:text-6xl lg:text-[4.6rem]">
              It all starts with the right profile{" "}<span className="text-[#9be65b]">and the right connection.</span>
            </h2>
            <p className="mt-6 max-w-[38rem] text-base leading-7 text-[#d7d5cc] sm:text-lg">From creating your profile to getting paid, Porishrom makes freelancing simple, transparent, and human.</p>
          </div>

          <div className="relative min-h-[260px] overflow-hidden rounded-[24px] bg-[#f7f3e9] sm:min-h-[350px] sm:rounded-[28px] lg:min-h-[390px]">
            <Image src="/illustrations/porishrom-how-it-works/hero-collaboration.png" alt="Hand-drawn Porishrom freelancer and client collaborating over project work" fill sizes="(min-width: 1024px) 52vw, 100vw" className="object-cover object-center" />
          </div>
        </div>

        <ol className="relative mt-12 grid gap-5 sm:mt-16 md:grid-cols-2 lg:mt-20 lg:grid-cols-4 lg:gap-3">
          <svg aria-hidden="true" viewBox="0 0 1200 80" preserveAspectRatio="none" className="pointer-events-none absolute -top-11 left-[8%] hidden h-16 w-[84%] lg:block">
            <path d="M0 44 C80 15 180 66 300 40 S490 14 600 42 S790 66 900 38 S1090 20 1200 43" fill="none" stroke="#9be65b" strokeWidth="4" strokeLinecap="round" />
          </svg>
          <div aria-hidden="true" className="absolute bottom-8 left-6 top-8 w-px bg-[#9be65b]/70 md:hidden" />
          {STEPS.map((step, index) => {
            const Icon = step.icon;
            const darkTone = step.tone !== "cream";
            const numberTone = index === 1 ? "border-[#fff9ef] bg-[#ef3826] text-[#fff9ef]" : index === 3 ? "border-[#141512] bg-[#9be65b] text-[#141512]" : "border-[#141512] bg-[#f7f3e9] text-[#141512]";
            return (
              <li key={step.number} className="relative min-w-0 pl-12 md:pl-0">
                <div className={`absolute left-0 top-7 z-10 flex size-12 items-center justify-center rounded-full border-2 text-lg font-black tracking-[-0.04em] shadow-[0_0_0_6px_#141512] md:-top-6 md:left-8 lg:-top-7 lg:left-9 ${numberTone}`}>{step.number}</div>
                <article className={`group relative flex min-h-[430px] flex-col overflow-hidden rounded-[24px] p-6 pt-8 transition-transform duration-300 hover:-translate-y-1 motion-reduce:transform-none sm:min-h-[460px] sm:rounded-[28px] sm:p-7 sm:pt-9 ${cardTone[step.tone]}`}>
                  <div aria-hidden="true" className={`pointer-events-none absolute inset-y-0 left-0 z-[1] hidden w-[70%] md:block ${step.tone === "cream" ? "bg-gradient-to-r from-[#f7f3e9] via-[#f7f3e9]/95 to-transparent" : step.tone === "red" ? "bg-gradient-to-r from-[#ef3826] via-[#ef3826]/95 to-transparent" : "bg-gradient-to-r from-[#075a50] via-[#075a50]/95 to-transparent"}`} />
                  <div className="relative z-10 max-w-[15rem] md:max-w-[13.75rem]">
                    <span className={`flex size-10 items-center justify-center rounded-full ${darkTone ? "bg-[#fff9ef] text-[#171815]" : "bg-[#9be65b] text-[#171815]"}`}><Icon className="size-5" strokeWidth={2.25} aria-hidden="true" /></span>
                    <h3 className="mt-5 text-2xl font-bold leading-[1.02] tracking-[-0.04em] sm:text-[1.7rem]">{step.title}</h3>
                    <p className={`mt-4 max-w-[15rem] text-sm leading-6 ${darkTone ? "text-[#fff9ef]/90" : "text-[#45443e]"}`}>{step.description}</p>
                  </div>
                  <Image src={step.image} alt={step.alt} width={900} height={1200} sizes="(min-width: 1024px) 24vw, (min-width: 768px) 40vw, 86vw" className={`pointer-events-none relative z-[2] mt-4 h-[175px] w-full self-end object-contain object-right-bottom transition-transform duration-300 group-hover:-translate-y-1 motion-reduce:transform-none md:absolute md:bottom-0 md:right-0 md:mt-0 md:h-auto md:w-[54%] md:max-w-[245px] ${step.tone === "red" || step.tone === "green" ? "mix-blend-screen" : ""}`} />
                  <Link href={step.href} className={`relative z-10 mt-4 inline-flex min-h-11 items-center gap-3 self-start text-sm font-bold focus-visible:ring-3 focus-visible:ring-[#9be65b] focus-visible:outline-none md:mt-auto ${darkTone ? "text-[#fff9ef]" : "text-[#171815]"}`}>
                    <span className={`flex size-10 items-center justify-center rounded-full transition-transform group-hover:translate-x-1 motion-reduce:transform-none ${darkTone ? "bg-[#fff9ef] text-[#171815]" : "bg-[#ef3826] text-[#fff9ef]"}`}><ArrowRight className="size-5" aria-hidden="true" /></span>{step.cta}
                  </Link>
                </article>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
