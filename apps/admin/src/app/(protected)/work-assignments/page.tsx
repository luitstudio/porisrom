import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

type WorkAssignmentRow = {
  id: string;
  title: string;
  status: string;
  budgetAmount: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
  conversation: {
    connection: {
      requester: { id: string; name: string };
      receiver: { id: string; name: string };
    };
  };
};

const FLAGGED_STATUSES = new Set(["disputed"]);

export default async function WorkAssignmentsPage() {
  const { accessToken } = await requireSession();
  const assignments = await backendFetch<WorkAssignmentRow[]>("/admin/work-assignments", { accessToken });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Work Assignments</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Read-only oversight — {assignments.length} assignment(s). Disputed items are highlighted.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">Title</th>
              <th className="p-3">Parties</th>
              <th className="p-3">Status</th>
              <th className="p-3">Budget</th>
              <th className="p-3">Updated</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => {
              const flagged = FLAGGED_STATUSES.has(a.status);
              return (
                <tr
                  key={a.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: flagged ? "color-mix(in srgb, var(--danger) 12%, transparent)" : undefined,
                  }}
                >
                  <td className="p-3">{a.title}</td>
                  <td className="p-3">
                    {a.conversation.connection.requester.name} ↔{" "}
                    {a.conversation.connection.receiver.name}
                  </td>
                  <td className="p-3" style={{ color: flagged ? "var(--danger)" : undefined }}>
                    {a.status}
                  </td>
                  <td className="p-3">
                    {a.budgetAmount} {a.currency}
                  </td>
                  <td className="p-3">{new Date(a.updatedAt).toISOString().slice(0, 10)}</td>
                </tr>
              );
            })}
            {assignments.length === 0 && (
              <tr>
                <td className="p-3" colSpan={5} style={{ color: "var(--muted)" }}>
                  No work assignments yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
