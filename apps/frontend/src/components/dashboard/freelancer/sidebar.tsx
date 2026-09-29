"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/dashboard/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { BrandLogo } from "@/components/common/brand-logo";
import { FREELANCER_NAV_ITEMS } from "@/components/dashboard/freelancer/nav-items";
import { NotificationBell } from "@/components/notifications/notification-bell";

type SidebarProps = {
  name: string;
  completionPercent: number;
  accessToken: string;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function FreelancerSidebar({ name, completionPercent, accessToken }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:sticky lg:top-0 lg:flex">
      <div className="flex min-h-16 items-center justify-between gap-2 border-b border-sidebar-border px-5">
        <Link href="/" aria-label="Porisrom home" className="flex min-h-11 items-center">
          <BrandLogo priority className="h-7 max-w-40" />
        </Link>
        <NotificationBell accessToken={accessToken} messagesHref="/dashboard/freelancer/messages" />
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {FREELANCER_NAV_ITEMS.map((item) => {
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
                "flex min-h-9 items-center gap-3 rounded-lg border px-3 text-sm font-medium transition-colors",
                isActive
                  ? "border-[var(--role-accent-border)] bg-[var(--role-accent-muted)] text-[var(--role-accent)]"
                  : "border-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4 border-t border-sidebar-border bg-sidebar px-5 py-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/30 p-2">
          <Avatar className="size-9 border border-sidebar-border">
            <AvatarFallback className="bg-sidebar-accent text-sm font-semibold text-sidebar-accent-foreground">
              {initialsFor(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-sidebar-foreground">{name}</p>
            <Badge className="border-sidebar-border bg-sidebar-accent text-sidebar-accent-foreground">
              Freelancer
            </Badge>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-metadata">
            <span className="font-semibold text-sidebar-foreground">Profile strength</span>
            <span className="font-semibold text-primary">{completionPercent}% Complete</span>
          </div>
          <Progress value={completionPercent} className="h-1.5 bg-muted" />
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex min-h-9 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
