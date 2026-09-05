import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Mail, MessageCircle, Send } from "lucide-react";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

const SUPPORT_EMAIL = "support@porisrom.com";

export const metadata: Metadata = {
  title: "Contact Us — Porisrom",
  description: "Contact the Porisrom team by email.",
};

export default async function ContactPage() {
  const session = await auth();
  const isAuthenticated = Boolean(
    session?.user?.id && session.accessToken && !session.error
  );

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="flex flex-1 items-center px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to homepage
          </Link>

          <section className="relative isolate mt-4 overflow-hidden rounded-[30px] bg-navy px-6 py-14 text-white sm:rounded-[38px] sm:px-10 sm:py-16 lg:px-16 lg:py-20">
            <div className="absolute inset-0 -z-10 bg-linear-to-br from-primary/35 via-transparent to-orchid/30" />
            <div className="absolute -left-28 -top-28 -z-10 size-80 rounded-full border border-white/10" />
            <div className="absolute -bottom-40 right-[-4%] -z-10 size-112 rounded-full bg-primary/20 blur-3xl" />

            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="max-w-2xl">
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-lavender">
                  Contact Us
                </p>
                <h1 className="mt-4 font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl">
                  We&apos;re here to help.
                </h1>
                <p className="mt-6 text-base leading-7 text-white/70 sm:text-lg sm:leading-8">
                  Have a question or facing an issue? Send us an email and the Porisrom
                  team will be happy to help.
                </p>

                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none motion-reduce:transform-none"
                >
                  <Mail className="size-4" aria-hidden="true" />
                  Email Porisrom
                  <ArrowUpRight className="size-4" aria-hidden="true" />
                </a>

                <p className="mt-4 text-sm text-white/60">
                  Or write directly to{" "}
                  <a
                    href={`mailto:${SUPPORT_EMAIL}`}
                    className="font-medium text-white underline decoration-white/35 underline-offset-4 hover:decoration-white focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-white/60 focus-visible:outline-none"
                  >
                    {SUPPORT_EMAIL}
                  </a>
                </p>
              </div>

              <ContactIllustration />
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

function ContactIllustration() {
  return (
    <div className="relative mx-auto h-72 w-full max-w-sm" aria-hidden="true">
      <div className="absolute left-1 top-12 w-[70%] -rotate-5 rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
        <MessageCircle className="size-9 text-lavender" />
        <div className="mt-6 h-2 w-full rounded-full bg-white/25" />
        <div className="mt-3 h-2 w-4/5 rounded-full bg-white/15" />
        <div className="mt-3 h-2 w-3/5 rounded-full bg-white/15" />
      </div>

      <div className="absolute bottom-7 right-0 flex h-44 w-[62%] rotate-6 flex-col rounded-3xl border border-white/20 bg-white/12 p-6 shadow-2xl backdrop-blur-md">
        <Mail className="size-10 text-white" />
        <div className="mt-6 h-2 w-full rounded-full bg-white/25" />
        <div className="mt-3 h-2 w-2/3 rounded-full bg-white/15" />
      </div>

      <div className="absolute bottom-0 left-1/2 flex size-20 -translate-x-1/2 items-center justify-center rounded-3xl bg-primary text-white shadow-[0_24px_50px_-18px_rgba(100,94,238,0.9)]">
        <Send className="size-8" />
      </div>
    </div>
  );
}
