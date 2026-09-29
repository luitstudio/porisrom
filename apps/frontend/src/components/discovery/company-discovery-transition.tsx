"use client";

import * as React from "react";
import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";

const SEARCH_DEBOUNCE_MS = 350;

export function CompanyDiscoveryTransition({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const debounceTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = React.useRef(0);

  React.useEffect(() => () => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  }, []);

  function navigate(form: HTMLFormElement) {
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value) query.set(key, value);
    }
    query.delete("page");
    const search = query.toString();
    startTransition(() => router.push(search ? `/companies?${search}` : "/companies"));
  }

  function handleSubmit(event: React.FormEvent<HTMLDivElement>) {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || !form.dataset.companyDiscoveryForm) return;

    event.preventDefault();
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    requestId.current += 1;
    navigate(form);
  }

  function handleChange(event: React.ChangeEvent<HTMLDivElement>) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement)) return;
    const form = input.form;
    if (!form?.dataset.companyDiscoveryForm) return;

    if (input.name !== "keyword") {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      requestId.current += 1;
      navigate(form);
      return;
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    const nextRequestId = ++requestId.current;
    debounceTimer.current = setTimeout(() => {
      // A later keystroke or filter change supersedes this scheduled request.
      if (nextRequestId === requestId.current) navigate(form);
    }, SEARCH_DEBOUNCE_MS);
  }

  return (
    <div onChange={handleChange} onSubmit={handleSubmit} aria-busy={pending}>
      {pending && (
        <div
          role="status"
          className="sticky top-24 z-20 mb-4 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/20 bg-white/95 px-3 py-2.5 text-center text-sm font-medium text-foreground shadow-sm backdrop-blur"
        >
          <LoaderCircle className="size-4 animate-spin text-primary" aria-hidden="true" />
          Updating company results…
        </div>
      )}
      <div className={pending ? "pointer-events-none opacity-60 transition-opacity" : "transition-opacity"}>
        {children}
      </div>
    </div>
  );
}
