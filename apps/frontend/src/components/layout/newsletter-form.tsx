"use client";

import * as React from "react";
import { ArrowUpRight } from "lucide-react";

import { Input } from "@/components/ui/input";

export function NewsletterForm() {
  const [email, setEmail] = React.useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmail("");
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 rounded-full border border-border p-1.5 pl-4"
    >
      <Input
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Enter Your Email"
        aria-label="Email address"
        className="h-8 flex-1 border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
      />
      <button
        type="submit"
        aria-label="Subscribe"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <ArrowUpRight className="size-4" />
      </button>
    </form>
  );
}
