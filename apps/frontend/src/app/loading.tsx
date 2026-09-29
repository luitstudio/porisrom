import { LoaderCircle } from "lucide-react";

import { BrandLogo } from "@/components/common/brand-logo";

export default function GlobalLoading() {
  return (
    <main
      className="flex min-h-screen w-full min-w-0 items-center justify-center overflow-x-clip bg-background px-4 py-10"
      aria-label="Loading Porisrom"
      aria-busy="true"
      role="status"
    >
      <div className="flex max-w-full flex-col items-center gap-5 text-center">
        <BrandLogo priority className="h-8 max-w-[12rem]" />
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent text-primary">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
        </span>
        <p className="text-sm font-medium text-muted-foreground">Loading…</p>
      </div>
    </main>
  );
}
