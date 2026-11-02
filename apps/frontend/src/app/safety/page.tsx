import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";
import { ReasonField, SafetyForm } from "@/components/safety/safety-controls";

export default async function SafetyPage() {
  const session = await auth();
  if (!session?.accessToken || session.error) redirect("/auth/login");
  const [blocks, cases] = await Promise.all([
    backendFetch<{ id: string; blockedUser: { name: string } }[]>("/safety/blocks", { accessToken: session.accessToken }),
    backendFetch<{ id: string; kind: string; status: string; reason: string; decisionReason: string | null; events: { id: string; action: string; note: string | null }[] }[]>("/safety/cases", { accessToken: session.accessToken }),
  ]);
  return <main className="mx-auto max-w-3xl space-y-6 p-6"><Link href="/dashboard">Back to dashboard</Link>
    <h1 className="text-2xl font-semibold">Safety & support</h1>
    <p>Support is private. Do not submit passwords, tokens, banking credentials, or identity documents. Credential recovery and appeals require an approved identity-check process; a support case does not restore account access.</p>
    <SafetyForm operation="support" label="Submit support case"><label>Category<select name="category" className="mx-2 rounded border p-2">{["account", "technical", "payment", "privacy", "other"].map((v) => <option key={v}>{v}</option>)}</select></label><ReasonField /></SafetyForm>
    <h2 className="text-xl">Your blocks</h2>{blocks.length === 0 && <p>No active blocks.</p>}
    {blocks.map((b) => <section key={b.id}><p>{b.blockedUser.name}</p><SafetyForm operation="unblock" id={b.id} label="Unblock user" /></section>)}
    <h2 className="text-xl">Support and shared cancellation history</h2>
    {cases.map((c) => <article key={c.id} className="space-y-2 rounded border p-4"><h3>{c.kind} — {c.status}</h3><p>{c.reason}</p>{c.decisionReason && <p>Administrative response: {c.decisionReason}</p>}<ul>{c.events.map((e) => <li key={e.id}>{e.action}{e.note && `: ${e.note}`}</li>)}</ul></article>)}
    <p className="text-sm">User reports are excluded from participant case lists to protect reporter privacy.</p>
  </main>;
}
