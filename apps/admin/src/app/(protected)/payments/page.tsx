import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

type PaymentRow = {
  id: string;
  status: string;
  mismatchCount: number;
  clientUtr: string | null;
  freelancerUtr: string | null;
  workAssignment: {
    title: string;
    status: string;
    budgetAmount: string;
    currency: string;
    conversation: {
      connection: {
        requester: { id: string; name: string };
        receiver: { id: string; name: string };
      };
    };
  };
};

function formatMoney(amount: string, currency: string) {
  const n = Number(amount);
  return `${currency} ${Number.isFinite(n) ? n.toLocaleString("en-IN") : amount}`;
}

export default async function PaymentsPage() {
  const { accessToken } = await requireSession();
  const payments = await backendFetch<PaymentRow[]>("/admin/payments", { accessToken });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Payment Oversight</h1>
      <p className="text-sm" style={{ color: "var(--muted)" }}>
        {payments.length} payment record(s). Mismatched or disputed items are highlighted.
      </p>

      <div className="card overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--border)" }}>
              <th className="p-3">Assignment</th>
              <th className="p-3">Parties</th>
              <th className="p-3">Budget</th>
              <th className="p-3">Assignment status</th>
              <th className="p-3">Payment status</th>
              <th className="p-3">Mismatches</th>
              <th className="p-3">Client UTR</th>
              <th className="p-3">Freelancer UTR</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const flagged = p.status === "mismatch" || p.workAssignment.status === "disputed";
              return (
                <tr
                  key={p.id}
                  style={{
                    borderBottom: "1px solid var(--border)",
                    background: flagged ? "color-mix(in srgb, var(--danger) 12%, transparent)" : undefined,
                  }}
                >
                  <td className="p-3">{p.workAssignment.title}</td>
                  <td className="p-3">
                    {p.workAssignment.conversation.connection.requester.name} ↔{" "}
                    {p.workAssignment.conversation.connection.receiver.name}
                  </td>
                  <td className="p-3">
                    {formatMoney(p.workAssignment.budgetAmount, p.workAssignment.currency)}
                  </td>
                  <td className="p-3" style={{ color: p.workAssignment.status === "disputed" ? "var(--danger)" : undefined }}>
                    {p.workAssignment.status.replace(/_/g, " ")}
                  </td>
                  <td className="p-3" style={{ color: p.status === "mismatch" ? "var(--danger)" : undefined }}>
                    {p.status.replace(/_/g, " ")}
                  </td>
                  <td className="p-3">{p.mismatchCount}</td>
                  <td className="p-3">{p.clientUtr ?? "—"}</td>
                  <td className="p-3">{p.freelancerUtr ?? "—"}</td>
                </tr>
              );
            })}
            {payments.length === 0 && (
              <tr>
                <td className="p-3" colSpan={8} style={{ color: "var(--muted)" }}>
                  No payment records yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
