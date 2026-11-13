"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function FreelancerDashboardGateError() {
  const router = useRouter();
  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-6">
      <section className="max-w-md rounded-xl border border-destructive/30 bg-card p-6 text-center shadow-sm">
        <h1 className="font-display text-xl font-semibold">Dashboard unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">We couldn&apos;t load your account details. Your session is still active.</p>
        <Button className="mt-4" onClick={() => router.refresh()}>Retry</Button>
      </section>
    </main>
  );
}
