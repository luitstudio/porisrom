import { FeatureCard } from "@/components/home/feature-card";

export function FeaturesSection() {
  return (
    <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16 lg:px-10 lg:py-24">
      <h2 className="text-center font-display text-3xl font-semibold text-foreground sm:text-4xl">
        Everything you need,
        <br />
        beautifully organised
      </h2>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:mt-10 sm:grid-cols-3 sm:grid-rows-2 lg:mt-12">
        <FeatureCard
          variant="primary"
          title="Smart job matching"
          description="Curated opportunities based on your skills, experience, and past work — not just keyword searches."
          className="sm:row-span-2"
        />
        <FeatureCard
          variant="light"
          title="Project workspace"
          description="Track deliverables, deadlines, and client messages in one clean, organised view."
        />
        <FeatureCard
          variant="light"
          title="One-click invoicing"
          description="Send polished invoices and get paid directly — no spreadsheets, no chasing."
        />
        <div className="rounded-2xl bg-linear-to-br from-magenta-light to-magenta sm:min-h-44" />
        <FeatureCard
          variant="dark"
          title="Education"
          description="Free courses and guides on SEO, marketing, and growing your freelance business."
        />
      </div>
    </section>
  );
}
