"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { ChevronDown, Globe, Menu, Search, User } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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

const NAV_ENTRIES: NavEntry[] = [
  { label: "Browse Jobs", href: "/jobs" },
  { label: "Find Freelancers", href: "/freelancers" },
  {
    label: "Categories",
    items: [
      {
        label: "Web & App Development",
        href: "/categories/web-development",
        description: "Sites, products, and full-stack builds",
      },
      {
        label: "Design & Creative",
        href: "/categories/design",
        description: "UI/UX, branding, and visual design",
      },
      {
        label: "Writing & Translation",
        href: "/categories/writing",
        description: "Content, copy, and localisation",
      },
      {
        label: "Digital Marketing",
        href: "/categories/marketing",
        description: "Growth, SEO, and paid campaigns",
      },
      {
        label: "Video & Animation",
        href: "/categories/video",
        description: "Editing, motion, and production",
      },
    ],
  },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Pricing", href: "/pricing" },
  {
    label: "Resources",
    items: [
      { label: "Blog", href: "/blog", description: "Stories, tips, and product updates" },
      { label: "Help Center", href: "/help", description: "Answers to common questions" },
      { label: "Guides", href: "/guides", description: "In-depth playbooks for freelancing" },
      { label: "Community", href: "/community", description: "Connect with other members" },
    ],
  },
];

type NavbarProps = {
  isAuthenticated?: boolean;
};

export function Navbar({ isAuthenticated = false }: NavbarProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-4 z-50 px-4 sm:top-5 sm:px-6">
      <nav
        className={cn(
          "mx-auto grid max-w-345 grid-cols-[auto_1fr_auto] items-center gap-3 rounded-2xl border border-[#ECECF4] bg-white/85 px-3 py-2.5 backdrop-blur-md transition-shadow duration-300 sm:px-4 lg:flex lg:h-18 lg:justify-between lg:px-6 lg:py-0",
          scrolled
            ? "shadow-[0_8px_30px_-8px_rgba(20,21,43,0.16)]"
            : "shadow-[0_4px_20px_-6px_rgba(20,21,43,0.08)]"
        )}
      >
        <motion.div whileHover={{ scale: 1.02 }} transition={{ duration: 0.2 }}>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <PorishromMark />
            <span className="font-display text-xl font-semibold tracking-tight text-foreground">
              Porishrom
            </span>
          </Link>
        </motion.div>

        {/* Center: desktop links / mobile CTA */}
        <div className="flex justify-center">
          <NavigationMenu className="hidden lg:flex">
            <NavigationMenuList className="gap-1">
              {NAV_ENTRIES.map((entry) => (
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
                      className="group relative flex h-9 items-center rounded-lg bg-transparent px-2.5 text-sm font-medium text-foreground/75 hover:bg-transparent hover:text-foreground data-active:bg-transparent data-active:hover:bg-transparent"
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
              className="h-8 rounded-full bg-primary px-4 text-xs font-semibold tracking-wide text-primary-foreground shadow-sm hover:bg-primary/90"
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
              <Link
                href="/dashboard"
                aria-label="Go to dashboard"
                className="flex items-center justify-center rounded-full border border-border p-1 transition-colors hover:border-primary/40"
              >
                <Avatar size="sm">
                  <AvatarFallback>
                    <User className="size-3.5" />
                  </AvatarFallback>
                </Avatar>
              </Link>
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

        <div className="flex lg:hidden">
          <MobileMenu isAuthenticated={isAuthenticated} pathname={pathname} />
        </div>
      </nav>
    </header>
  );
}

function PorishromMark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <rect width="26" height="26" rx="8" className="fill-primary" />
      <path
        d="M13 6L19 13L13 20L7 13L13 6Z"
        className="fill-primary-foreground"
        opacity="0.95"
      />
      <path d="M13 10.5L15.5 13L13 15.5L10.5 13L13 10.5Z" className="fill-primary" />
    </svg>
  );
}

function MobileMenu({
  isAuthenticated,
  pathname,
}: {
  isAuthenticated: boolean;
  pathname: string | null;
}) {
  return (
    <Sheet>
      <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} transition={{ duration: 0.2 }}>
        <SheetTrigger
          render={
            <Button
              variant="outline"
              aria-label="Open menu"
              className="size-10 rounded-xl"
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
          <SheetTitle className="flex items-center gap-2 font-display text-lg">
            <PorishromMark />
            Porishrom
          </SheetTitle>
        </SheetHeader>

        <ul className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
          {NAV_ENTRIES.map((entry, index) =>
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
                  className="flex w-full items-center justify-between rounded-lg px-3 py-3.5 text-base font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
                  data-active={pathname === entry.href || undefined}
                >
                  {entry.label}
                </SheetClose>
              </motion.li>
            )
          )}
        </ul>

        <SheetFooter className="gap-3 border-t border-border">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              <Search className="size-4" />
              Search
            </button>
            <Separator orientation="vertical" className="h-4" />
            <button
              type="button"
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 transition-colors hover:bg-muted hover:text-foreground"
            >
              <Globe className="size-4" />
              Language
            </button>
          </div>

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
          <SheetClose
            render={
              <Link href={isAuthenticated ? "/dashboard/freelancer/messages" : "/auth/login"} />
            }
            nativeButton={false}
            className={cn(
              buttonVariants({ variant: "outline", size: "lg" }),
              "w-full rounded-full"
            )}
          >
            {isAuthenticated ? "Messages" : "Login"}
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function MobileNavGroup({ label, items }: { label: string; items: DropdownLink[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-lg px-3 py-3.5 text-base font-medium text-foreground/80 transition-colors hover:bg-muted hover:text-foreground"
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
              <SheetClose render={<Link href={item.href} />} nativeButton={false}>
                <span className="block rounded-lg px-3 py-2.5 text-sm text-foreground/70 hover:bg-muted hover:text-foreground">
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
