import Link from "next/link";

import { SERVICE_CATEGORIES, categoryHref } from "@/lib/service-categories";

export function ServicesSection() {
  return (
    <section
      className="relative overflow-hidden bg-white px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-24"
      aria-labelledby="services-title"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-80 bg-linear-to-b from-lavender/45 to-transparent"
        aria-hidden="true"
      />
      <div className="relative mx-auto max-w-7xl">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            Explore services
          </p>
          <h2
            id="services-title"
            className="mt-4 font-display text-3xl font-semibold leading-tight text-foreground sm:text-4xl lg:text-5xl"
          >
            Everything your next project needs
          </h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
            Browse Porisrom&apos;s main service categories and find the right expertise
            for your project.
          </p>
        </div>

        <nav
          className="-mx-5 mt-9 overflow-x-auto px-5 pb-4 [scrollbar-width:none] sm:-mx-8 sm:px-8 lg:mx-0 lg:mt-11 lg:px-0 [&::-webkit-scrollbar]:hidden"
          aria-label="Service categories"
        >
          <div className="flex w-max min-w-full snap-x snap-mandatory gap-2.5 lg:gap-2">
            {SERVICE_CATEGORIES.map((category) => {
              const Icon = category.icon;
              return (
                <Link
                  key={category.slug}
                  href={categoryHref(category)}
                  className="group flex min-h-28 w-37 shrink-0 snap-start flex-col justify-between rounded-2xl border border-border/80 bg-white p-4 shadow-[0_14px_36px_-28px_rgba(20,21,43,0.45)] transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_20px_42px_-26px_rgba(91,76,255,0.35)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transform-none sm:w-39 lg:min-w-32 lg:flex-1"
                >
                  <span className="flex size-9 items-center justify-center rounded-xl bg-lavender text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                    <Icon className="size-4.5" aria-hidden="true" />
                  </span>
                  <span className="mt-4 text-sm font-semibold leading-5 text-foreground">
                    {category.name}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </section>
  );
}
