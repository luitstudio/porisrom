import Link from "next/link";
import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";
import { CaseReviewForm } from "./review-form";

type Case = { id: string; kind: string; status: string; category: string; reason: string; decision: string | null; decisionReason: string | null;
  reporter: { name: string }; targetUser: { name: string } | null; assignment: { id: string; title: string; status: string } | null;
  events?: { id: string; action: string; note: string | null; createdAt: string }[] };
export default async function SafetyCasesPage({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const session = await requireSession();
  const { id } = await searchParams;
  const cases = await backendFetch<Case[]>("/admin/safety/cases", { accessToken: session.accessToken });
  const detail = id ? await backendFetch<Case>(`/admin/safety/cases/${encodeURIComponent(id)}`, { accessToken: session.accessToken }) : null;
  return <div className="admin-page"><h1>Safety & support cases</h1><p>Private administrative queue. Report contents must never be disclosed to the reported user.</p>
    {detail && <section className="admin-panel"><h2>{detail.kind} / {detail.status}</h2><p>{detail.reason}</p>{detail.assignment && <p>Assignment {detail.assignment.title}: {detail.assignment.status}</p>}
      <ul>{detail.events?.map((e) => <li key={e.id}>{e.createdAt.slice(0, 16)} UTC — {e.action}: {e.note}</li>)}</ul>
      {detail.status === "open" ? <CaseReviewForm id={detail.id} kind={detail.kind} /> : <p>{detail.decision}: {detail.decisionReason}</p>}
    </section>}
    <table><thead><tr><th>Kind</th><th>Reporter</th><th>Category</th><th>Status</th><th>Review</th></tr></thead><tbody>{cases.map((c) => <tr key={c.id}><td>{c.kind}</td><td>{c.reporter.name}</td><td>{c.category}</td><td>{c.status}</td><td><Link href={`/safety?id=${encodeURIComponent(c.id)}`}>Open case</Link></td></tr>)}</tbody></table>
  </div>;
}
