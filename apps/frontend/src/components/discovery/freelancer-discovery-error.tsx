"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, RefreshCw } from "lucide-react";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { Button } from "@/components/ui/button";

export function FreelancerDiscoveryError({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="mx-auto flex w-full max-w-6xl flex-1 items-start px-4 pb-16 pt-28 min-[375px]:px-5 sm:px-8 sm:pt-32">
        <section className="min-w-0 w-full rounded-2xl border border-border bg-card p-5 text-center sm:p-10">
          <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
            Freelancer listings couldn&apos;t load
          </h1>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            We couldn&apos;t reach the marketplace right now. Your current search and filters are still preserved.
          </p>
          <Button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
            className="mt-6"
          >
            {pending ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {pending ? "Retrying…" : "Retry"}
          </Button>
        </section>
      </main>
      <Footer />
    </div>
  );
}
