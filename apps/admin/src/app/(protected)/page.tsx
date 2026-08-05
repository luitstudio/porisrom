import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

type Analytics = {
  signupsByDay: { day: string; count: number }[];
  activeAssignments: number;
  totalAssignments: number;
  paymentVerificationRate: number;
  verifiedPayments: number;
  totalPayments: number;
  usersByRole: { role: string | null; count: number }[];
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="card p-5">
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default async function DashboardPage() {
  const { accessToken } = await requireSession();
  const analytics = await backendFetch<Analytics>("/admin/analytics", { accessToken });

  const maxSignups = Math.max(1, ...analytics.signupsByDay.map((d) => d.count));

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active work assignments" value={analytics.activeAssignments} />
        <StatCard label="Total work assignments" value={analytics.totalAssignments} />
        <StatCard
          label="Payment verification rate"
          value={`${(analytics.paymentVerificationRate * 100).toFixed(0)}%`}
        />
        <StatCard
          label="Verified / total payments"
          value={`${analytics.verifiedPayments} / ${analytics.totalPayments}`}
        />
      </div>

      <div className="card p-5">
        <h2 className="font-medium">Users by role</h2>
        <div className="mt-3 flex gap-6 text-sm">
          {analytics.usersByRole.map((row) => (
            <div key={row.role ?? "none"}>
              <span style={{ color: "var(--muted)" }}>{row.role ?? "unassigned"}: </span>
              <span className="font-semibold">{row.count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="card p-5">
        <h2 className="font-medium">Signups — last 30 days</h2>
        {analytics.signupsByDay.length === 0 ? (
          <p className="mt-2 text-sm" style={{ color: "var(--muted)" }}>
            No signups in this window.
          </p>
        ) : (
          <div className="mt-4 flex items-end gap-1" style={{ height: "120px" }}>
            {analytics.signupsByDay.map((row) => (
              <div
                key={row.day}
                title={`${new Date(row.day).toISOString().slice(0, 10)}: ${row.count}`}
                className="flex-1 rounded-t"
                style={{
                  background: "var(--primary)",
                  height: `${Math.max(4, (row.count / maxSignups) * 100)}%`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
