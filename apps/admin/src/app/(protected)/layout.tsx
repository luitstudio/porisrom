import { Nav } from "@/components/nav";
import { requireSession } from "@/lib/session";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireSession();

  return (
    <div className="min-h-screen pb-12">
      <Nav user={user} />
      <main className="mx-4 mt-4">{children}</main>
    </div>
  );
}
