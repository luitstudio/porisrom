"use client";

import Link from "next/link";

export default function ErrorPage() {
  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-24">
      <h1 className="font-display text-3xl font-semibold">This page is currently unavailable</h1>
      <p className="mt-4 text-muted-foreground">
        We could not load this page. Please try again later.
      </p>
      <Link href="/" className="mt-6 inline-block text-primary underline">
        Back to homepage
      </Link>
    </main>
  );
}
