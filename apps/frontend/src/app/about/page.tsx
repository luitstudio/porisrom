import Link from "next/link";
import {
  ArrowLeft,
  ArrowUpRight,
  BriefcaseBusiness,
  Check,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export const metadata: Metadata = {
  title: "About Porisrom",
  description:
    "Learn how Porisrom connects clients with skilled freelance professionals on one platform.",
};

const JOURNEY_POINTS = [
  { label: "Find the right talent", icon: Search },
  { label: "Showcase your skills", icon: UserRound },
  { label: "Create opportunities", icon: Sparkles },
];

export default async function AboutPage() {
  const session = await auth();
  const isAuthenticated = Boolean(
    session?.user?.id && session.accessToken && !session.error
  );

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="flex-1 px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to homepage
          </Link>

          <section className="relative isolate mt-4 overflow-hidden rounded-[30px] bg-navy px-6 py-14 text-white sm:rounded-[38px] sm:px-10 sm:py-18 lg:px-16 lg:py-20">
            <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary/35 via-transparent to-orchid/30" />
            <div className="absolute -left-24 -top-28 -z-10 size-80 rounded-full border border-white/10" />
            <div className="absolute -bottom-40 right-[-4%] -z-10 size-112 rounded-full bg-primary/20 blur-3xl" />

            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="max-w-3xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lavender">
                  About Porisrom
                </p>
                <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                  Where skills meet opportunities.
                </h1>
                <p className="mt-6 max-w-2xl text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                  Porisrom brings clients and skilled professionals together, making it
                  easier to find the right expertise, discover meaningful projects, and
                  grow through better connections.
                </p>
                <p className="mt-6 font-display text-xl font-semibold text-lavender sm:text-2xl">
                  One Platform. Endless Opportunities.
                </p>
              </div>

              <MarketplaceIllustration />
            </div>
          </section>

          <section className="grid gap-8 py-16 sm:py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16 lg:py-24">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Our platform
              </p>
              <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
                What is Porisrom?
              </h2>
            </div>

            <div className="rounded-3xl border border-border bg-peach/45 p-6 sm:p-8 lg:p-10">
              <p className="text-base leading-8 text-muted-foreground">
                Porisrom is a freelance marketplace that connects clients with skilled
                professionals across a wide range of services. From graphic design and
                video editing to photography, web development, content creation, and
                more, Porisrom makes it easier for clients to find the right expertise
                and for freelancers to discover opportunities that match their skills.
              </p>
              <p className="mt-5 text-base leading-8 text-muted-foreground">
                Whether you have a project that needs the right talent or a skill
                you&apos;re ready to put to work, Porisrom brings both sides together on
                one platform.
              </p>
            </div>
          </section>

          <section className="relative overflow-hidden rounded-[30px] bg-lavender/55 px-6 py-12 sm:rounded-[38px] sm:px-10 sm:py-16 lg:px-14">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                  Built for both sides
                </p>
                <h2 className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl">
                  Why Porisrom?
                </h2>

                <div className="mt-8 grid gap-3">
                  {JOURNEY_POINTS.map(({ label, icon: Icon }) => (
                    <div
                      key={label}
                      className="flex items-center gap-3 rounded-2xl border border-white/80 bg-white/75 px-4 py-3.5"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-white">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold text-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl bg-white p-6 shadow-[0_24px_70px_-48px_rgba(20,21,43,0.5)] sm:p-8 lg:p-10">
                <p className="text-base leading-8 text-muted-foreground">
                  Finding the right talent or the right opportunity shouldn&apos;t be
                  complicated. Porisrom is designed to make the process simpler, more
                  direct, and transparent for both clients and freelancers.
                </p>
                <p className="mt-5 text-base leading-8 text-muted-foreground">
                  Clients can discover professionals based on their specific
                  requirements, while freelancers can find projects that match their
                  skills and expertise. From connecting and communicating to tracking
                  work and completing projects, Porisrom brings the experience together
                  in one place.
                </p>
                <p className="mt-5 text-base leading-8 text-muted-foreground">
                  With direct collaboration and no commission charged to either clients
                  or freelancers, Porisrom is built to create meaningful connections and
                  open more opportunities for everyone.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link
                    href="/freelancers"
                    className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Find freelancers
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="inline-flex min-h-11 items-center rounded-full border border-primary/20 bg-white px-5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                  >
                    Join Porisrom
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function MarketplaceIllustration() {
  return (
    <div className="relative mx-auto h-72 w-full max-w-md" aria-hidden="true">
      <div className="absolute left-0 top-8 w-[58%] -rotate-4 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-orchid/50">
            <UserRound className="size-5" />
          </span>
          <div className="flex-1">
            <div className="h-2 w-4/5 rounded-full bg-white/30" />
            <div className="mt-2 h-2 w-1/2 rounded-full bg-white/15" />
          </div>
        </div>
        <div className="mt-6 flex gap-2">
          {[1, 2, 3].map((item) => (
            <span key={item} className="h-2 flex-1 rounded-full bg-lavender/30" />
          ))}
        </div>
      </div>

      <div className="absolute right-0 top-20 w-[58%] rotate-4 rounded-3xl border border-white/20 bg-white/12 p-5 shadow-2xl backdrop-blur-md">
        <BriefcaseBusiness className="size-9 text-lavender" />
        <div className="mt-5 h-2 w-3/4 rounded-full bg-white/30" />
        <div className="mt-3 h-2 w-full rounded-full bg-white/15" />
        <div className="mt-2 h-2 w-2/3 rounded-full bg-white/15" />
      </div>

      <div className="absolute bottom-1 left-1/2 flex size-20 -translate-x-1/2 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_24px_50px_-18px_rgba(100,94,238,0.9)]">
        <UsersRound className="size-9" />
      </div>
      <div className="absolute bottom-16 right-4 flex size-9 items-center justify-center rounded-full bg-white text-primary shadow-lg">
        <Check className="size-4" />
      </div>
    </div>
  );
}
