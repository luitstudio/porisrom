import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { CANONICAL_CATEGORIES, categoryHref } from "@/lib/service-categories";

const SERVICES = [
  { label: "Web Development", href: categoryHref(CANONICAL_CATEGORIES.webDeveloper) },
  { label: "Video Editing", href: categoryHref(CANONICAL_CATEGORIES.videoEditor) },
  { label: "Graphic Design", href: categoryHref(CANONICAL_CATEGORIES.graphicDesigner) },
  { label: "Photography", href: categoryHref(CANONICAL_CATEGORIES.videographerPhotographer) },
  { label: "Marketing", href: categoryHref(CANONICAL_CATEGORIES.socialMediaMarketer) },
  { label: "Writing", href: categoryHref(CANONICAL_CATEGORIES.contentWriter) },
  { label: "Voice Over", href: categoryHref(CANONICAL_CATEGORIES.voiceOverArtist) },
];

export function MobilePopularChips() {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">Popular Services</h2>
        <Link href="/freelancers" className="min-h-11 px-2 py-2 text-xs font-medium text-primary">
          See all
        </Link>
      </div>

      <div className="-mx-5 mt-3 flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SERVICES.map((service) => (
          <Link
            key={service.label}
            href={service.href}
            className="flex h-10 shrink-0 snap-start items-center rounded-full bg-lavender/75 px-4 text-sm font-medium text-primary transition-colors active:bg-primary active:text-white"
          >
            {service.label}
          </Link>
        ))}
        <Link
          href="/freelancers"
          className="flex h-10 shrink-0 snap-start items-center gap-1 rounded-full border border-primary/15 bg-white px-4 text-sm font-medium text-foreground"
        >
          View All
          <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </section>
  );
}
