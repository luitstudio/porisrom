"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { cn } from "@/lib/utils";
import { signOutAction } from "@/app/dashboard/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { FREELANCER_NAV_ITEMS } from "@/components/dashboard/freelancer/nav-items";

type SidebarProps = {
  name: string;
  completionPercent: number;
};

function initialsFor(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function FreelancerSidebar({ name, completionPercent }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="hidden h-screen w-64 shrink-0 flex-col border-r border-border bg-card/60 lg:sticky lg:top-0 lg:flex">
      <div className="flex items-center gap-2 px-6 py-6">
        <Link href="/" className="font-display text-lg font-semibold text-foreground">
          Porisrom
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3">
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
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <Icon className="size-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col gap-4 border-t border-border px-4 py-5">
        <div className="flex items-center gap-3">
          <Avatar className="size-10 border border-border">
            <AvatarFallback className="bg-primary/10 text-sm font-semibold text-primary">
              {initialsFor(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            <span className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-foreground">
              Freelancer
            </span>
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-medium text-foreground">Profile strength</span>
            <span className="font-semibold text-primary">{completionPercent}% Complete</span>
          </div>
          <Progress value={completionPercent} className="h-1.5" />
        </div>

        <form action={signOutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
