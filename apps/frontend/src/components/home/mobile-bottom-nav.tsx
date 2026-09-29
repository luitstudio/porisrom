"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { Compass, Home, MessageCircle, Search, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { discoveryNavigationForRole } from "@/lib/discovery-navigation";

type MobileBottomNavProps = {
  isAuthenticated?: boolean;
};

export function MobileBottomNav({ isAuthenticated = false }: MobileBottomNavProps) {
  const pathname = usePathname();
  const { data: session } = useSession();

  if (!isAuthenticated) {
    return null;
  }

  const discovery = discoveryNavigationForRole(session?.user?.role);
  const messagesHref = session?.user?.role === "client"
    ? "/dashboard/client/messages"
    : "/dashboard/freelancer/messages";
  const items = [
    { label: "Home", href: "/", icon: Home },
    { label: "Browse", href: "/freelancers", icon: Compass },
    { label: "Search", href: discovery.href, icon: Search },
    {
      label: "Messages",
      href: messagesHref,
      icon: MessageCircle,
    },
    {
      label: "Profile",
      href: "/dashboard",
      icon: User,
    },
  ];

  return (
    <nav className="fixed inset-x-0 bottom-4 z-50 px-4 lg:hidden">
      <div className="mx-auto flex max-w-sm items-center justify-around rounded-2xl border border-[#ECECF4] bg-white/85 px-2 py-2 shadow-[0_8px_30px_-8px_rgba(20,21,43,0.16)] backdrop-blur-md">
        {items.map((item) => {
          const isActive =
            item.href === "/" ? pathname === item.href : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-[11px] font-medium",
                isActive ? "text-primary" : "text-foreground/60"
              )}
            >
              <Icon className="size-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
