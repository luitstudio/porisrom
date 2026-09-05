import Link from "next/link";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { Footer } from "@/components/layout/footer";
import { Navbar } from "@/components/layout/navbar";
import { getServiceCategory, SERVICE_CATEGORIES } from "@/lib/service-categories";

type CategoryPageProps = {
  params: Promise<{ category: string }>;
};

export function generateStaticParams() {
  return SERVICE_CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getServiceCategory(slug);

  return {
    title: category ? `${category.name} — Porisrom` : "Services — Porisrom",
    description: category?.description,
  };
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { category: slug } = await params;
  const category = getServiceCategory(slug);

  if (!category) notFound();

  const session = await auth();
  const isAuthenticated = Boolean(
    session?.user?.id && session.accessToken && !session.error
  );
  const CategoryIcon = category.icon;

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-white">
      <Navbar isAuthenticated={isAuthenticated} />

      <main className="flex-1 px-5 pb-20 pt-28 sm:px-8 sm:pb-24 sm:pt-32 lg:px-10">
        <div className="mx-auto max-w-7xl">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center gap-2 rounded-full px-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to homepage
          </Link>

          <section
            className="relative isolate mt-4 flex min-h-[360px] items-center justify-center overflow-hidden rounded-[28px] bg-navy px-6 py-16 text-center text-navy-foreground sm:min-h-[420px] sm:rounded-[36px] sm:px-10 lg:min-h-[460px]"
            aria-labelledby="category-title"
          >
            <div
              className="absolute -left-6 top-1/2 -z-10 -translate-y-1/2 font-display text-[17rem] font-semibold leading-none text-primary/20 sm:left-4 sm:text-[22rem] lg:text-[28rem]"
              aria-hidden="true"
            >
              {category.name.charAt(0)}
            </div>
            <div
              className="absolute inset-y-0 right-0 -z-10 w-2/5 border-l border-white/8"
              aria-hidden="true"
            >
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.07)_1px,transparent_1px)] bg-[size:68px_68px]" />
              <div className="absolute right-[8%] top-[12%] size-28 rotate-12 rounded-[32px] border border-primary/40 bg-primary/15 sm:size-40" />
              <div className="absolute -right-10 bottom-[-12%] size-52 rounded-full bg-orchid/35 sm:size-72" />
              <div className="absolute bottom-[12%] right-[34%] flex size-20 items-center justify-center rounded-3xl border border-white/15 bg-white/10 text-white backdrop-blur-sm sm:size-28">
                <CategoryIcon className="size-9 sm:size-12" />
              </div>
            </div>

            <div className="relative max-w-3xl">
              <div className="mx-auto flex size-12 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-white sm:size-14">
                <CategoryIcon className="size-6" aria-hidden="true" />
              </div>
              <h1
                id="category-title"
                className="mt-6 font-display text-4xl font-semibold leading-tight sm:text-5xl lg:text-6xl"
              >
                {category.name}
              </h1>
              <p className="mt-4 text-lg font-medium text-white/90 sm:text-xl">
                {category.tagline}
              </p>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-6 text-white/65 sm:text-base sm:leading-7">
                {category.description}
              </p>
            </div>
          </section>

          <section className="py-16 sm:py-20" aria-labelledby="popular-services-title">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
                Explore services
              </p>
              <h2
                id="popular-services-title"
                className="mt-3 font-display text-3xl font-semibold text-foreground sm:text-4xl"
              >
                Popular {category.name} services
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Start with a focused service and find professionals ready to help bring
                your project to life.
              </p>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {category.services.map((service) => {
                const ServiceIcon = service.icon;

                return (
                  <Link
                    key={service.name}
                    href="/freelancers"
                    className="group flex min-h-56 flex-col rounded-3xl border border-border bg-white p-6 shadow-[0_18px_50px_-38px_rgba(20,21,43,0.45)] transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_56px_-34px_rgba(91,76,255,0.35)] focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none motion-reduce:transform-none sm:p-7"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex size-12 items-center justify-center rounded-2xl bg-lavender text-primary transition-colors group-hover:bg-primary group-hover:text-white">
                        <ServiceIcon className="size-5" aria-hidden="true" />
                      </span>
                      <ArrowUpRight
                        className="size-5 text-muted-foreground transition-colors group-hover:text-primary"
                        aria-hidden="true"
                      />
                    </div>
                    <h3 className="mt-8 font-display text-xl font-semibold text-foreground">
                      {service.name}
                    </h3>
                    <p className="mt-3 text-sm leading-6 text-muted-foreground">
                      {service.description}
                    </p>
                  </Link>
                );
              })}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
