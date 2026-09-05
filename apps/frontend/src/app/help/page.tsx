import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export const metadata: Metadata = {
  title: "Help Center — Porisrom",
  description: "Get help and contact the Porisrom support team.",
};

export default async function HelpCenterPage() {
  const session = await auth();
  const isAuthenticated = Boolean(
    session?.user?.id && session.accessToken && !session.error
  );

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="flex-1 px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div className="mx-auto max-w-4xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to homepage
          </Link>

          <div className="mt-6">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
              Support
            </p>
            <h1 className="mt-3 font-display text-4xl font-semibold text-foreground sm:text-5xl">
              Help Center
            </h1>
          </div>

          <section
            className="mt-10 rounded-3xl bg-lavender/65 p-7 sm:p-10"
            aria-labelledby="contact-support-title"
          >
            <h2
              id="contact-support-title"
              className="font-display text-2xl font-semibold text-foreground sm:text-3xl"
            >
              How Can We Help You?
            </h2>
            <p className="mt-4 max-w-2xl text-base italic leading-7 text-muted-foreground">
              Have a question or facing an issue? Send us a message and our team will be
              happy to help.
            </p>
            <Link
              href="/contact"
              className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-primary/90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              Contact support
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
