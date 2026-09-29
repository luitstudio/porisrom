"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { motion } from "framer-motion";
import { Briefcase, ChevronDown, FolderKanban, LogOut, Menu, MessageSquare, Search, Settings, User, Users } from "lucide-react";

import { cn } from "@/lib/utils";
import { CANONICAL_CATEGORIES, categoryHref } from "@/lib/service-categories";
import { discoveryNavigationForRole } from "@/lib/discovery-navigation";
import { BrandLogo } from "@/components/common/brand-logo";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/app/dashboard/actions";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";

type DropdownLink = {
  label: string;
  href: string;
  description?: string;
};

type NavEntry =
  | { label: string; href: string; items?: never }
  | { label: string; href?: never; items: DropdownLink[] };

const CATEGORY_NAV_ENTRY: NavEntry = {
  label: "Categories",
  items: [
    {
      label: "Web & App Development",
      href: categoryHref(CANONICAL_CATEGORIES.webDeveloper),
      description: "Sites, products, and full-stack builds",
    },
    {
      label: "Design & Creative",
      href: categoryHref(CANONICAL_CATEGORIES.graphicDesigner),
      description: "UI/UX, branding, and visual design",
    },
    {
      label: "Writing & Translation",
      href: categoryHref(CANONICAL_CATEGORIES.contentWriter),
      description: "Content, copy, and localisation",
    },
    {
      label: "Digital Marketing",
      href: categoryHref(CANONICAL_CATEGORIES.socialMediaMarketer),
      description: "Growth, SEO, and paid campaigns",
    },
    {
      label: "Video & Animation",
      href: categoryHref(CANONICAL_CATEGORIES.videoEditor),
      description: "Editing, motion, and production",
    },
  ],
};

function navigationEntries(role: "freelancer" | "client" | "admin" | null | undefined): NavEntry[] {
  const discovery = discoveryNavigationForRole(role);
  return [
    { label: discovery.label, href: discovery.href },
    CATEGORY_NAV_ENTRY,
  ];
}

const NAV_ENTRIES: NavEntry[] = [
  { label: "Find Freelancers", href: "/freelancers" },
  { label: "Find Companies", href: "/companies" },
  CATEGORY_NAV_ENTRY,
];

type NavbarProps = {
  isAuthenticated?: boolean;
};

export function Navbar({ isAuthenticated = false }: NavbarProps) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const role = session?.user?.role;
  const entries = isAuthenticated && role ? navigationEntries(role) : NAV_ENTRIES;
  const discovery = discoveryNavigationForRole(role);
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-3 z-50 px-2 min-[375px]:top-4 min-[375px]:px-4 sm:top-5 sm:px-6">
      <nav
        className={cn(
          "mx-auto grid max-w-345 grid-cols-[auto_1fr_auto] items-center gap-2 rounded-2xl border border-border bg-card/90 px-2.5 py-2 backdrop-blur-md transition-shadow duration-300 min-[375px]:gap-3 min-[375px]:px-3 min-[375px]:py-2.5 sm:px-4 lg:flex lg:h-18 lg:justify-between lg:px-6 lg:py-0",
          scrolled
            ? "shadow-[0_8px_30px_-8px_rgba(20,21,43,0.16)]"
            : "shadow-[0_4px_20px_-6px_rgba(20,21,43,0.08)]"
        )}
      >
        <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <Link
            href="/"
            className="flex min-h-11 items-center rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <BrandLogo priority className="h-7 sm:h-8" />
          </Link>
        </motion.div>

        {/* Center: desktop links / mobile CTA */}
        <div className="flex justify-center">
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList className="gap-1">
              {entries.map((entry) => (
                <NavigationMenuItem key={entry.label}>
                  {entry.items ? (
                    <>
                      <NavigationMenuTrigger className="bg-transparent text-sm font-medium text-foreground/75 hover:text-foreground data-popup-open:text-foreground">
                        {entry.label}
                      </NavigationMenuTrigger>
                      <NavigationMenuContent>
                        <ul className="grid w-[320px] gap-1 p-1">
                          {entry.items.map((item) => (
                            <li key={item.href}>
                              <NavigationMenuLink
                                render={<Link href={item.href} />}
                                closeOnClick
                                className="flex flex-col gap-0.5"
                              >
                                <span className="text-sm font-medium text-foreground">
                                  {item.label}
                                </span>
                                {item.description && (
                                  <span className="text-xs text-muted-foreground">
                                    {item.description}
                                  </span>
                                )}
                              </NavigationMenuLink>
                            </li>
                          ))}
                        </ul>
                      </NavigationMenuContent>
                    </>
                  ) : (
                    <NavigationMenuLink
                      render={<Link href={entry.href} />}
                      active={pathname === entry.href}
                      closeOnClick
                      className={cn(
                        "group relative flex h-9 items-center rounded-lg bg-transparent px-2.5 text-sm font-medium text-foreground/75 transition-colors hover:text-foreground data-active:bg-transparent data-active:hover:bg-transparent",
                        isAuthenticated && "role-nav-hover",
                        pathname === entry.href && isAuthenticated && "role-nav-active"
                      )}
                    >
                      {entry.label}
                      <span
                        className={cn(
                          "absolute inset-x-2.5 bottom-0 h-px origin-left scale-x-0 bg-primary transition-transform duration-200 ease-out group-hover:scale-x-100",
                          pathname === entry.href && "scale-x-100"
                        )}
                      />
                    </NavigationMenuLink>
                  )}
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>

          <motion.div
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.2 }}
            className="flex lg:hidden"
          >
            <Button
              render={<Link href={isAuthenticated ? "/dashboard" : "/auth/signup"} />}
              nativeButton={false}
              size="sm"
              className="min-h-11 rounded-full bg-primary px-3 text-xs font-semibold tracking-wide text-primary-foreground shadow-sm hover:bg-primary/90 min-[375px]:px-4"
            >
              {isAuthenticated ? "Dashboard" : "SIGN UP"}
            </Button>
          </motion.div>
        </div>

        {/* Right: desktop actions / mobile menu trigger */}
        <div className="hidden items-center gap-2 lg:flex">
          {isAuthenticated ? (
            <>
              <Button
                render={<Link href="/dashboard" />}
                nativeButton={false}
                variant="ghost"
                className="rounded-full text-foreground/75 hover:text-foreground"
              >
                Dashboard
              </Button>
              {role === "freelancer" ? (
                <FreelancerAccountMenu name={session?.user?.name ?? "Freelancer"} />
              ) : (
                <Link
                  href="/dashboard"
                  aria-label="Go to dashboard"
                  className="flex items-center justify-center rounded-full border border-border p-1 ring-2 ring-primary/10 transition-colors hover:border-primary/40"
                >
                  <Avatar size="sm">
                    <AvatarFallback>
                      <User className="size-3.5" />
                    </AvatarFallback>
                  </Avatar>
                </Link>
              )}
            </>
          ) : (
            <>
              <Button
                render={<Link href="/auth/login" />}
                nativeButton={false}
                variant="ghost"
                className="rounded-full text-foreground/75 hover:text-foreground"
              >
                Login
              </Button>
              <motion.div
                whileHover={{ scale: 1.02, y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={{ duration: 0.2 }}
              >
                <Button
                  render={<Link href="/auth/signup" />}
                  nativeButton={false}
                  className="rounded-full bg-primary px-5 text-primary-foreground shadow-md hover:bg-primary/90"
                >
                  Get Started
                </Button>
              </motion.div>
            </>
          )}
        </div>

        <div className="flex items-center gap-1 lg:hidden">
          {isAuthenticated && role === "freelancer" && (
            <FreelancerAccountMenu name={session?.user?.name ?? "Freelancer"} />
          )}
          <MobileMenu isAuthenticated={isAuthenticated} pathname={pathname} entries={entries} discovery={discovery} />
        </div>
      </nav>
    </header>
  );
}

function FreelancerAccountMenu({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "F";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Open freelancer account menu"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-border p-1 ring-2 ring-primary/10 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        }
      >
        <Avatar size="sm">
          <AvatarFallback>{initial}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 rounded-xl border border-border p-2 shadow-[var(--role-nav-shadow)]">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="px-2 py-2">
            <span className="block truncate text-sm font-semibold text-foreground">{name}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">Freelancer account</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/dashboard/freelancer/settings" />} className="min-h-11 px-2.5">
            <User /> Profile
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/companies" />} className="min-h-11 px-2.5">
            <Briefcase /> Find Companies
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/freelancer/messages" />} className="min-h-11 px-2.5">
            <Users /> My Connections
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/freelancer/messages" />} className="min-h-11 px-2.5">
            <MessageSquare /> Messages & work
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/freelancer/portfolio" />} className="min-h-11 px-2.5">
            <FolderKanban /> Portfolio
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href="/dashboard/freelancer/settings" />} className="min-h-11 px-2.5">
          <Settings /> Account Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <DropdownMenuItem render={<button type="submit" />} className="min-h-11 w-full px-2.5" variant="destructive">
            <LogOut /> Sign out
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileMenu({
  isAuthenticated,
  pathname,
  entries,
  discovery,
}: {
  isAuthenticated: boolean;
  pathname: string | null;
  entries: NavEntry[];
  discovery: ReturnType<typeof discoveryNavigationForRole>;
}) {
  return (
    <Sheet>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.2 }}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              aria-label="Open menu"
              className="size-11 rounded-xl"
            />
          }
        >
          <Menu className="size-5" />
        </SheetTrigger>
      </motion.div>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 duration-300 ease-[cubic-bezier(0.32,1.5,0.55,1)] data-[side=right]:w-full sm:max-w-sm"
      >
        <SheetHeader className="border-b border-border">
          <SheetTitle className="flex items-center">
            <BrandLogo className="h-7" />
          </SheetTitle>
        </SheetHeader>

        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {entries.map((entry, index) =>
            entry.items ? (
              <motion.li
                key={entry.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
              >
                <MobileNavGroup label={entry.label} items={entry.items} />
              </motion.li>
            ) : (
              <motion.li
                key={entry.label}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: index * 0.04 }}
              >
                <SheetClose
                  render={<Link href={entry.href} />}
                  nativeButton={false}
                  className={cn(
                    "flex min-h-12 w-full items-center justify-between rounded-lg px-3 py-3 text-base font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
                    pathname?.startsWith(entry.href) && "bg-accent text-primary",
                    pathname?.startsWith(entry.href) && isAuthenticated && "role-nav-active"
                  )}
                  data-active={pathname === entry.href || undefined}
                  aria-current={pathname?.startsWith(entry.href) ? "page" : undefined}
                >
                  {entry.label}
                </SheetClose>
              </motion.li>
            )
          )}
        </ul>

        <SheetFooter className="gap-3 border-t border-border">
          <SheetClose
            render={<Link href={discovery.href} />}
            nativeButton={false}
            className="flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-current={pathname?.startsWith(discovery.href) ? "page" : undefined}
          >
              <Search className="size-4" />
              {discovery.mobileLabel}
          </SheetClose>

          <SheetClose
            render={<Link href={isAuthenticated ? "/dashboard" : "/auth/signup"} />}
            nativeButton={false}
            className={cn(
              buttonVariants({ size: "lg" }),
              "w-full rounded-full bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            {isAuthenticated ? "Go to dashboard" : "SIGN UP"}
          </SheetClose>
          {!isAuthenticated && (
            <SheetClose
              render={<Link href="/auth/login" />}
              nativeButton={false}
              className={cn(
                buttonVariants({ variant: "outline", size: "lg" }),
                "w-full rounded-full"
              )}
            >
              Login
            </SheetClose>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MobileNavGroup({ label, items }: { label: string; items: DropdownLink[] }) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);
  const isActive = items.some((item) => pathname === item.href);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex min-h-12 w-full items-center justify-between rounded-lg px-3 py-3 text-base font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground",
          isActive && "bg-accent text-primary role-nav-active"
        )}
      >
        {label}
        <ChevronDown
          className={cn("size-4 text-foreground/50 transition-transform", open && "rotate-180")}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-[max-height] duration-300",
          open ? "max-h-96" : "max-h-0"
        )}
      >
        <ul className="flex flex-col gap-0.5 py-1 pl-3">
          {items.map((item) => (
            <li key={item.href}>
              <SheetClose
                render={<Link href={item.href} />}
                nativeButton={false}
                aria-current={pathname === item.href ? "page" : undefined}
              >
                <span className={cn(
                  "flex min-h-11 items-center rounded-lg px-3 py-2.5 text-sm text-foreground/70 hover:bg-muted hover:text-foreground",
                  pathname === item.href && "bg-accent text-primary role-nav-active"
                )}>
                  {item.label}
                </span>
              </SheetClose>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
