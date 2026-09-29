"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";

export function FreelancerDiscoveryTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();

  function navigate(href: string) {
    startTransition(() => router.push(href));
  }

  function handleSubmit(event: React.FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.discoveryForm) return;

    event.preventDefault();
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value) query.set(key, value);
    }
    const search = query.toString();
    navigate(search ? `/freelancers?${search}` : "/freelancers");
  }

  function handleNavigation(event: React.MouseEvent<HTMLDivElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) return;
    const link = target.closest<HTMLAnchorElement>("a[data-discovery-navigation]");
    const href = link?.getAttribute("href");
    if (!href) return;

    event.preventDefault();
    navigate(href);
  }

  return (
    <div onSubmit={handleSubmit} onClickCapture={handleNavigation} aria-busy={pending}>
      {pending && (
        <div
          role="status"
          className="sticky top-24 z-20 mb-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white/95 px-3 py-2.5 text-center text-sm font-medium text-foreground shadow-sm backdrop-blur sm:px-4 sm:py-3"
        >
          <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
          Updating freelancer results…
        </div>
      )}
      <div className={pending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        {children}
      </div>
    </div>
  );
}
