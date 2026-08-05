import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

import { BroadcastForm } from "./broadcast-form";
import { DirectMessageForm } from "./direct-message-form";

type AdminUserRow = { id: string; name: string; email: string; status: string };

type ActionLogEntry = {
  id: string;
  action: string;
  targetUserId: string | null;
  metadata: { message?: string; type?: string; userId?: string } | null;
  createdAt: string;
};

export default async function NotificationsPage() {
  const { accessToken } = await requireSession();
  const [users, actionLog] = await Promise.all([
    backendFetch<AdminUserRow[]>("/admin/users", { accessToken }),
    backendFetch<ActionLogEntry[]>("/admin/action-log", { accessToken }),
  ]);

  const activeUsers = users.filter((u) => u.status === "active");
  const recentNotifications = actionLog
    .filter((entry) => entry.action === "broadcast_notification" || entry.action === "send_direct_message")
    .slice(0, 20);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Notifications</h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-medium">Broadcast to all users</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Shows in every user&apos;s notification inbox.
          </p>
          <div className="mt-4">
            <BroadcastForm />
          </div>
        </div>

        <div className="card p-5">
          <h2 className="font-medium">Direct message a user</h2>
          <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
            Delivered to that user&apos;s notification inbox only.
          </p>
          <div className="mt-4">
            <DirectMessageForm users={activeUsers} />
          </div>
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-medium">Recently sent</h2>
        {recentNotifications.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            Nothing sent yet.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {recentNotifications.map((entry) => (
              <li key={entry.id} style={{ borderBottom: "1px solid var(--border)" }} className="pb-2">
                <span style={{ color: "var(--muted)" }}>
                  {new Date(entry.createdAt).toISOString().slice(0, 16).replace("T", " ")} —{" "}
                  {entry.action === "broadcast_notification" ? "Broadcast" : "Direct message"}:
                </span>{" "}
                {entry.metadata?.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
