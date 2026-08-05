import Link from "next/link";

import { logout } from "@/app/(protected)/logout-action";
import type { AdminUser } from "@/lib/session";

const LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/users", label: "Users" },
  { href: "/conversations", label: "Conversations" },
  { href: "/work-assignments", label: "Work Assignments" },
  { href: "/payments", label: "Payments" },
  { href: "/notifications", label: "Notifications" },
  { href: "/action-log", label: "Action Log" },
];

export function Nav({ user }: { user: AdminUser }) {
  return (
    <header className="card mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <div className="flex flex-wrap items-center gap-4">
        <span className="font-semibold">Porishrom Admin</span>
        <nav className="flex flex-wrap gap-3 text-sm">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded px-2 py-1 hover:opacity-70"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3 text-sm" style={{ color: "var(--muted)" }}>
        <span>{user.name}</span>
        <form action={logout}>
          <button type="submit" className="underline hover:opacity-70">
            Log out
          </button>
        </form>
      </div>
    </header>
  );
}
