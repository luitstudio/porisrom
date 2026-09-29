"use client";

import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function OnboardingError({ reset }: { reset: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 text-center shadow-sm sm:p-6">
        <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-xl font-semibold text-foreground">
          We couldn’t load profile setup
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Check your connection and try loading your categories and profile setup again.
        </p>
        <Button onClick={reset} className="mt-5 min-h-11 w-full">
          <RotateCcw className="size-4" />
          Try again
        </Button>
      </div>
    </main>
  );
}
