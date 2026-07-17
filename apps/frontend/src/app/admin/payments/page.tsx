import { redirect } from "next/navigation";
import type { Metadata } from "next";

import { auth } from "@/auth";
import { listAdminPaymentsAction } from "@/app/admin/actions";

export const metadata: Metadata = {
  title: "Payment Oversight — Porisrom Admin",
};

function formatMoney(amount: string, currency: string) {
  const n = Number(amount);
  return `${currency} ${Number.isFinite(n) ? n.toLocaleString("en-IN") : amount}`;
}

// This is a stopgap page inside apps/frontend, gated to the admin role. It gets
// superseded once Phase 9 builds out a real apps/admin — this exists now only
// because Phase 7's roadmap scope explicitly includes payment oversight.
export default async function AdminPaymentsPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");
  if (session.user.role !== "admin") redirect("/dashboard");

  const payments = await listAdminPaymentsAction();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="font-display text-2xl font-semibold text-foreground sm:text-3xl">
        Payment Oversight
      </h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {payments.length} payment record{payments.length === 1 ? "" : "s"}. Mismatched or disputed
        items are highlighted.
      </p>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Assignment</th>
              <th className="px-4 py-3">Parties</th>
              <th className="px-4 py-3">Budget</th>
              <th className="px-4 py-3">Assignment Status</th>
              <th className="px-4 py-3">Payment Status</th>
              <th className="px-4 py-3">Mismatches</th>
              <th className="px-4 py-3">Client UTR</th>
              <th className="px-4 py-3">Freelancer UTR</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => {
              const flagged = p.status === "mismatch" || p.workAssignment.status === "disputed";
              return (
                <tr
                  key={p.id}
                  className={`border-b border-border last:border-0 ${
                    flagged ? "bg-destructive/10" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-foreground">
                    {p.workAssignment.title}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.workAssignment.conversation.connection.requester.name} ↔{" "}
                    {p.workAssignment.conversation.connection.receiver.name}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {formatMoney(p.workAssignment.budgetAmount, p.workAssignment.currency)}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.workAssignment.status === "disputed"
                          ? "font-medium text-destructive"
                          : "text-muted-foreground"
                      }
                    >
                      {p.workAssignment.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.status === "mismatch" ? "font-medium text-destructive" : "text-muted-foreground"
                      }
                    >
                      {p.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{p.mismatchCount}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.clientUtr ?? "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{p.freelancerUtr ?? "—"}</td>
                </tr>
              );
            })}
            {payments.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-6 text-center text-muted-foreground">
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
