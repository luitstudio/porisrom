import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

type ConversationRow = {
  id: string;
  createdAt: string;
  connection: {
    status: string;
    requester: { id: string; name: string; role: string | null };
    receiver: { id: string; name: string; role: string | null };
  };
  _count: { messages: number; workAssignments: number };
};

export default async function ConversationsPage() {
  const { accessToken } = await requireSession();
  const conversations = await backendFetch<ConversationRow[]>("/admin/conversations", { accessToken });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Conversations</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        Read-only oversight — {conversations.length} conversation(s).
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">Participants</th>
              <th className="p-3">Connection status</th>
              <th className="p-3">Messages</th>
              <th className="p-3">Work assignments</th>
              <th className="p-3">Started</th>
            </tr>
          </thead>
          <tbody>
            {conversations.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid var(--border)" }}>
                <td className="p-3">
                  {c.connection.requester.name} ({c.connection.requester.role}) ↔{" "}
                  {c.connection.receiver.name} ({c.connection.receiver.role})
                </td>
                <td className="p-3">{c.connection.status}</td>
                <td className="p-3">{c._count.messages}</td>
                <td className="p-3">{c._count.workAssignments}</td>
                <td className="p-3">{new Date(c.createdAt).toISOString().slice(0, 10)}</td>
              </tr>
            ))}
            {conversations.length === 0 && (
              <tr>
                <td className="p-3" colSpan={5} style={{ color: "var(--muted)" }}>
                  No conversations yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
