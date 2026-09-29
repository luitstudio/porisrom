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
  MOBILE_MORE_NAV_ITEMS,
  MOBILE_PRIMARY_NAV_ITEMS,
} from "@/components/dashboard/freelancer/nav-items";
import { NotificationBell } from "@/components/notifications/notification-bell";

export function MobileTabBar({ accessToken }: { accessToken: string }) {
  const pathname = usePathname();
  const moreItems = MOBILE_MORE_NAV_ITEMS;
  const isMoreActive = moreItems.some((item) => pathname.startsWith(item.href));

  return (
    <nav aria-label="Freelancer dashboard navigation" className="fixed inset-x-0 bottom-0 z-40 flex max-w-full items-center justify-around overflow-x-clip border-t border-sidebar-border bg-sidebar px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 min-[375px]:px-2 min-[375px]:pt-2 lg:hidden">
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
              "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-0.5 py-1.5 text-center text-[10px] font-medium leading-none min-[375px]:text-[11px]",
              isActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
            )}
            aria-current={isActive ? "page" : undefined}
          >
            <Icon className="size-4" aria-hidden="true" />
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}

      <Sheet>
        <SheetTrigger
          aria-label="Open more freelancer navigation"
          aria-current={isMoreActive ? "page" : undefined}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-0.5 py-1.5 text-[10px] font-medium leading-none min-[375px]:text-[11px]",
            isMoreActive ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground"
          )}
        >
          <Menu className="size-4" aria-hidden="true" />
          More
        </SheetTrigger>
        <SheetContent side="bottom" className="rounded-t-3xl px-4 pb-8">
          <SheetHeader>
            <SheetTitle>More</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-1 px-2">
            <div className="flex min-h-12 items-center justify-between rounded-xl px-3 py-1">
              <span className="text-sm font-medium text-foreground">Notifications</span>
              <NotificationBell accessToken={accessToken} messagesHref="/dashboard/freelancer/messages" />
            </div>
            {moreItems.map((item) => {
              const Icon = item.icon;
              return (
                <SheetClose
                  key={item.href}
                  render={<Link href={item.href} />}
                  nativeButton={false}
                  aria-current={pathname.startsWith(item.href) ? "page" : undefined}
                >
                  <span className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-secondary",
                    pathname.startsWith(item.href) && "bg-accent text-primary role-dashboard-nav-active"
                  )}>
                    <Icon className="size-4" />
                    {item.label}
                  </span>
                </SheetClose>
              );
            })}
            <form action={signOutAction}>
              <button
                type="submit"
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-muted-foreground hover:bg-secondary"
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
