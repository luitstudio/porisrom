export function TestimonialSection() {
  return (
    <section className="relative overflow-hidden bg-linear-to-br from-magenta-light to-magenta py-14 sm:py-20 lg:py-28">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1/2 opacity-40 mask-[linear-gradient(to_right,black,transparent)]">
        <div className="absolute -left-20 top-1/2 size-72 -translate-y-1/2 rounded-full border border-white/40 sm:size-96" />
        <div className="absolute -left-10 top-1/2 size-56 -translate-y-1/2 rounded-full border border-white/30 sm:size-72" />
      </div>

      <div className="relative mx-auto flex max-w-3xl flex-col items-center px-5 text-center sm:px-8">
        <p className="text-sm font-medium uppercase tracking-wide text-white/80">
          Client Testimonial
        </p>
        <h2 className="mt-4 font-display text-3xl font-semibold text-white sm:text-4xl">
          Elevate Your Digital
          <br />
          The Presence
        </h2>
      </div>
    </section>
  );
}
