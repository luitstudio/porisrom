import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

type ActionLogEntry = {
  id: string;
  adminId: string;
  targetUserId: string | null;
  action: string;
  metadata: Record<string, unknown> | null;
  createdAt: string;
};

export default async function ActionLogPage() {
  const { accessToken } = await requireSession();
  const entries = await backendFetch<ActionLogEntry[]>("/admin/action-log", { accessToken });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Action Log</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Audit trail of every admin mutation — {entries.length} entries.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">When</th>
              <th className="p-3">Admin</th>
              <th className="p-3">Action</th>
              <th className="p-3">Target user</th>
              <th className="p-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="p-3">{new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")}</td>
                <td className="p-3">{entry.adminId}</td>
                <td className="p-3">{entry.action}</td>
                <td className="p-3">{entry.targetUserId ?? "—"}</td>
                <td className="p-3">{entry.metadata ? JSON.stringify(entry.metadata) : "—"}</td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="p-3" colSpan={5} style={{ color: "var(--muted)" }}>
                  No admin actions logged yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
