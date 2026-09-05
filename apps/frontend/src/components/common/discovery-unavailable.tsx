import Link from "next/link";

import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";

export function DiscoveryUnavailable({ title, isAuthenticated }: {
  title: string;
  isAuthenticated: boolean;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar isAuthenticated={isAuthenticated} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 pb-16 pt-28 sm:px-8 sm:pt-32">
        <h1 className="font-display text-3xl font-semibold">{title}</h1>
        <p role="status" className="mt-4 text-muted-foreground">
          Live listings are currently unavailable. Please try again later.
        </p>
        <Link href="/" className="mt-6 inline-block text-primary underline">
          Back to homepage
        </Link>
      </main>
      <Footer />
    </div>
  );
}
