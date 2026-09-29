import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();
  return <div className="admin-shell"><Nav user={user} /><main className="admin-main">{children}</main></div>;
}
