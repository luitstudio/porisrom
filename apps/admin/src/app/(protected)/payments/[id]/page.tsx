import Link from "next/link";
import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";
import { ResolutionForm } from "./resolution-form";

type Details = {
  id: string; status: string; mismatchCount: number; clientUtr: string | null; freelancerUtr: string | null;
  workAssignment: { title: string; status: string; createdById: string; conversation: { connection: { requesterId: string; receiverId: string } } };
  claims: { id: string; party: string; reference: string; createdAt: string }[];
  decisions: { id: string; adminId: string; createdAt: string; metadata: { outcome: string; reason: string } }[];
};
export default async function PaymentDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accessToken } = await requireSession();
  const payment = await backendFetch<Details>(`/admin/payments/${encodeURIComponent(id)}`, { accessToken });
  return <div className="flex flex-col gap-5">
    <Link href="/payments" className="text-sm underline">Back to payments</Link>
    <h1 className="text-xl font-semibold">{payment.workAssignment.title}</h1>
    <div className="card space-y-2 p-5">
      <p>Assignment: <strong>{payment.workAssignment.status.replaceAll("_", " ")}</strong></p>
      <p>Payment record: <strong>{payment.status.replaceAll("_", " ")}</strong></p>
      <p>Lifetime reference mismatches: {payment.mismatchCount}</p>
      <p className="text-sm">References and administrative decisions are trust records, not proof of bank settlement.</p>
      <p className="text-sm">Client reference: {payment.clientUtr ?? "Not currently submitted"}</p>
      <p className="text-sm">Freelancer reference: {payment.freelancerUtr ?? "Not currently submitted"}</p>
    </div>
    {payment.workAssignment.status === "disputed" && <ResolutionForm paymentId={id} mismatchCount={payment.mismatchCount} />}
    <section className="card space-y-3 p-5"><h2 className="font-semibold">Claim history</h2>
      <p className="text-sm">Claim snapshots are retained from the introduction of dispute resolution. Earlier cleared references cannot be reconstructed.</p>
      {payment.claims.map((claim) => <p key={claim.id} className="text-sm">{claim.createdAt} · {claim.party}: {claim.reference}</p>)}
      {!payment.claims.length && <p className="text-sm">No retained claim snapshots.</p>}
    </section>
    <section className="card space-y-3 p-5"><h2 className="font-semibold">Administrative decisions</h2>
      {payment.decisions.map((decision) => <div key={decision.id} className="text-sm"><p>{decision.createdAt} · {decision.adminId} · {decision.metadata.outcome.replaceAll("_", " ")}</p><p>{decision.metadata.reason}</p></div>)}
      {!payment.decisions.length && <p className="text-sm">No decision recorded.</p>}
    </section>
  </div>;
}
