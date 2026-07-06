import Link from "next/link";
import { ChevronRight, type LucideIcon } from "lucide-react";

type MobileMarketplaceRowProps = {
  icon: LucideIcon;
  title: string;
  viewAllHref: string;
  children: React.ReactNode;
};

export function MobileMarketplaceRow({
  icon: Icon,
  title,
  viewAllHref,
  children,
}: MobileMarketplaceRowProps) {
  return (
    <section>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-base font-semibold text-foreground">
          <Icon className="size-4 text-primary" />
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="flex items-center gap-0.5 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          View All
          <ChevronRight className="size-3.5" />
        </Link>
      </div>

      <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1 scrollbar-none snap-x snap-mandatory [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </section>
  );
}
