"use client";

import Link from "next/link";
import { AlertTriangle, Home, RefreshCw } from "lucide-react";

import { BrandLogo } from "@/components/common/brand-logo";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen w-full min-w-0 items-center justify-center overflow-x-clip bg-background px-4 py-10">
      <section className="w-full max-w-md rounded-3xl border border-border bg-card p-5 text-center shadow-sm min-[375px]:p-6 sm:p-8">
        <BrandLogo priority className="mx-auto h-8 max-w-[12rem]" />
        <span className="mx-auto mt-7 flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertTriangle className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 break-words font-display text-2xl font-semibold text-foreground">
          This page couldn’t be loaded
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Something unexpected happened. Try again, or return to the homepage if the problem
          continues.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 min-[375px]:grid-cols-2">
          <Button onClick={reset} className="min-h-11 w-full">
            <RefreshCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Button
            render={<Link href="/" />}
            nativeButton={false}
            variant="outline"
            className="min-h-11 w-full"
          >
            <Home className="size-4" aria-hidden="true" />
            Homepage
          </Button>
        </div>
      </section>
    </main>
  );
}
