"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/dashboard/actions";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  FREELANCER_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
} from "@/components/dashboard/freelancer/nav-items";

export function MobileTabBar() {
  const pathname = usePathname();
  const moreItems = FREELANCER_NAV_ITEMS.filter(
    (item) => !MOBILE_PRIMARY_NAV_ITEMS.some((primary) => primary.href === item.href)
  );
  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-around border-t border-border bg-card/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      {MOBILE_PRIMARY_NAV_ITEMS.map((item) => {
        const isActive =
          item.href === "/dashboard/freelancer"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium",
              isActive ? "text-primary" : "text-muted-foreground"
            )}
          >
            <Icon className="size-5" />
            {item.label}
          </Link>
        );
      })}

      <Sheet>
        <SheetTrigger
          className={cn(
            "flex flex-1 flex-col items-center gap-1 rounded-xl py-1.5 text-[11px] font-medium",
            isMoreActive ? "text-primary" : "text-muted-foreground"
          )}
        >
          <Menu className="size-5" />
          More
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-2">
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <SheetClose
                  key={item.href}
                  render={<Link href={item.href} />}
                  nativeButton={false}
                >
                  <span className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary">
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                </SheetClose>
              );
            })}
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                Sign out
              </button>
            </form>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
