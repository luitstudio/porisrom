"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageSquare, Search, Settings, WalletCards } from "lucide-react";

import { cn } from "@/lib/utils";

const CLIENT_MOBILE_NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard/client", icon: Home },
  { label: "Find talent", href: "/freelancers", icon: Search },
  { label: "Messages", href: "/dashboard/client/messages", icon: MessageSquare },
  { label: "Payments", href: "/dashboard/client/payments", icon: WalletCards },
  { label: "Profile", href: "/dashboard/client/settings", icon: Settings },
];

export function ClientMobileTabBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Client dashboard navigation"
      className="fixed inset-x-0 bottom-0 z-40 grid max-w-full grid-cols-5 overflow-x-clip border-t border-border bg-card px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 sm:hidden"
    >
      {CLIENT_MOBILE_NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const isActive =
          href === "/dashboard/client" ? pathname === href : pathname.startsWith(href);

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex min-h-11 min-w-0 flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] px-0.5 py-1.5 text-center text-[10px] font-medium leading-none min-[375px]:text-[11px]",
              isActive ? "text-primary role-dashboard-nav-active" : "text-muted-foreground"
            )}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="max-w-full truncate">{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
