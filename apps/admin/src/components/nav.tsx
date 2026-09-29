"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  Bell,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Moon,
  PlusCircle,
  ScrollText,
  Sun,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import { logout } from "@/app/(protected)/logout-action";
import type { AdminUser } from "@/lib/session";

type NavigationItem = { href: string; label: string; Icon: LucideIcon };
type NavigationGroup = { label: string; items: NavigationItem[] };

const THEME_STORAGE_KEY = "porishrom-admin-theme";
const subscribeToTheme = (onStoreChange: () => void) => {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("porishrom-admin-theme-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("porishrom-admin-theme-change", onStoreChange);
  };
};
const getThemeSnapshot = () => {
  const preference = window.localStorage.getItem(THEME_STORAGE_KEY);
  return preference === "dark" || (preference === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
};
const getServerThemeSnapshot = () => false;

const GROUPS: NavigationGroup[] = [
  { label: "Dashboards", items: [{ href: "/", label: "Overview", Icon: LayoutDashboard }] },
  { label: "Marketplace", items: [{ href: "/users", label: "Users", Icon: Users }, { href: "/users?role=freelancer", label: "Freelancers", Icon: UserRound }, { href: "/users?role=client", label: "Companies", Icon: BriefcaseBusiness }, { href: "/conversations", label: "Conversations", Icon: MessageSquare }, { href: "/work-assignments", label: "Work assignments", Icon: ClipboardCheck }, { href: "/payments", label: "Payments", Icon: FileText }, { href: "/reviews", label: "Reviews", Icon: ScrollText }] },
  { label: "System", items: [{ href: "/notifications", label: "Notifications", Icon: Bell }, { href: "/action-log", label: "Action log", Icon: ScrollText }] },
];

function isCurrent(pathname: string, search: URLSearchParams, href: string) {
  const [path, query] = href.split("?");
  if (path === "/" ? pathname !== path : !pathname.startsWith(path)) return false;
  if (!query) return !search.get("role");
  return search.toString() === query;
}

function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const search = useSearchParams();
  return <nav aria-label="Admin navigation" className="admin-navigation">{GROUPS.map((group) => <section key={group.label} className="admin-nav-group"><p className="admin-nav-label">{group.label}</p><div className="admin-nav-links">{group.items.map((item) => { const active = isCurrent(pathname, search, item.href); const Icon = item.Icon; return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`admin-nav-link${active ? " admin-nav-link-active" : ""}`}><Icon aria-hidden="true" className="admin-nav-mark" /><span>{item.label}</span></Link>; })}</div></section>)}</nav>;
}

export function Nav({ user }: { user: AdminUser }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, getServerThemeSnapshot);
  const initials = user.name.trim().slice(0, 1).toUpperCase() || "A";
  useEffect(() => {
    document.documentElement.dataset.theme = isDark ? "dark" : "light";
  }, [isDark]);
  function toggleTheme() {
    const next = !isDark;
    window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    window.dispatchEvent(new Event("porishrom-admin-theme-change"));
  }
  return <>
    <aside className="admin-sidebar"><Link href="/" className="admin-brand" aria-label="Porishrom Admin overview"><span className="admin-brand-mark" aria-hidden="true">P</span><span><strong>Porishrom Admin</strong><small>Control center</small></span></Link><div className="admin-sidebar-actions"><Link href="/users" className="admin-sidebar-primary"><PlusCircle aria-hidden="true" />Review profiles</Link><Link href="/notifications" className="admin-sidebar-utility" aria-label="Open notifications"><Bell aria-hidden="true" /></Link></div><Navigation /><div className="admin-sidebar-footer"><p>Need help?</p><span>Marketplace operations</span><details><summary>{user.name}</summary><form action={logout}><button type="submit">Sign out</button></form></details></div></aside>
    <header className="admin-topbar"><button type="button" className="admin-menu-button" aria-label="Open admin navigation" aria-expanded={mobileOpen} onClick={() => setMobileOpen(true)}><Menu aria-hidden="true" /></button><div className="admin-title-lockup"><span className="admin-title-kicker">Porishrom marketplace</span><span>Operations</span></div><div className="admin-topbar-actions"><button type="button" className="admin-theme-toggle" aria-label={`Switch to ${isDark ? "light" : "dark"} mode`} aria-pressed={isDark} onClick={toggleTheme}>{isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}</button><details className="admin-account-menu"><summary aria-label="Open admin account menu"><span>{initials}</span><i /></summary><div className="admin-account-popover"><strong>{user.name}</strong><p>{user.email}</p><form action={logout}><button type="submit">Sign out</button></form></div></details></div></header>
    {mobileOpen && <div className="admin-mobile-shell" role="dialog" aria-modal="true" aria-label="Admin navigation"><button className="admin-mobile-backdrop" aria-label="Close navigation" onClick={() => setMobileOpen(false)} /><aside className="admin-mobile-drawer"><div className="admin-mobile-drawer-top"><span className="admin-brand"><span className="admin-brand-mark">P</span><strong>Porishrom</strong></span><button onClick={() => setMobileOpen(false)} aria-label="Close navigation">Close</button></div><Navigation onNavigate={() => setMobileOpen(false)} /></aside></div>}
  </>;
}
