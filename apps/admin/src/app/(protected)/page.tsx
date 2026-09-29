import Link from "next/link";

import { backendFetch } from "@/lib/backend-api";
import { requireSession } from "@/lib/session";

type Analytics = { signupsByDay: { day: string; count: number }[]; activeAssignments: number; totalAssignments: number; verifiedPayments: number; totalPayments: number };
type Profile = { verificationStatus: string };
type AdminUser = { id: string; name: string; email: string; role: string | null; status: string; createdAt: string; freelancerProfile: Profile | null; companyProfile: Profile | null };
type ActionLogEntry = { id: string; action: string; createdAt: string };

function statusOf(user: AdminUser) { return user.freelancerProfile?.verificationStatus ?? user.companyProfile?.verificationStatus; }
function MetricCard({ label, value, detail, href }: { label: string; value: number; detail: string; href: string }) { return <Link href={href} className="admin-metric-card"><span className="admin-metric-icon" aria-hidden="true">◌</span><p>{label}</p><strong>{value}</strong><small>{detail}</small><b aria-hidden="true">↗</b></Link>; }
function actionLabel(action: string) { return action.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase()); }

export default async function DashboardPage() {
  const { accessToken } = await requireSession();
  const [analytics, users, activity] = await Promise.all([
    backendFetch<Analytics>("/admin/analytics", { accessToken }), backendFetch<AdminUser[]>("/admin/users", { accessToken }), backendFetch<ActionLogEntry[]>("/admin/action-log", { accessToken }),
  ]);
  const freelancers = users.filter((user) => user.role === "freelancer").length;
  const companies = users.filter((user) => user.role === "client").length;
  const pendingProfiles = users.filter((user) => statusOf(user) === "pending").length;
  const maxSignups = Math.max(1, ...analytics.signupsByDay.map((row) => row.count));
  const latestUsers = users.slice(0, 7);

  return <div className="admin-reference-overview">
    <section className="admin-reference-kpis" aria-label="Marketplace summary"><MetricCard label="Total users" value={users.length} detail="Marketplace accounts" href="/users" /><MetricCard label="Freelancers" value={freelancers} detail="Freelancer accounts" href="/users?role=freelancer" /><MetricCard label="Companies" value={companies} detail="Client company accounts" href="/users?role=client" /><MetricCard label="Pending approvals" value={pendingProfiles} detail="Profiles awaiting review" href="/users" /></section>

    <section className="admin-reference-activity admin-reference-card"><header><div><h1>Marketplace Activity</h1><p>New account signups across the last 30 days.</p></div><span className="admin-period">Last 30 days</span></header><div className="admin-activity-body"><div className="admin-activity-chart" aria-label="New account signups over the last 30 days">{analytics.signupsByDay.length === 0 ? <div className="admin-chart-empty"><strong>No activity data yet</strong><span>Marketplace activity will appear here as users and work move through Porishrom.</span></div> : <div className="admin-bar-chart">{analytics.signupsByDay.map((row) => <div key={row.day} className="admin-bar-column" title={`${new Date(row.day).toLocaleDateString("en-IN")}: ${row.count} signups`}><i style={{ height: `${Math.max(4, (row.count / maxSignups) * 100)}%` }} /><span>{new Date(row.day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span></div>)}</div>}</div><aside className="admin-activity-summary"><div><strong>{users.length}</strong><span>total users</span><p>Accounts currently available to marketplace operations.</p></div><section><p>Active work assignments</p><strong>{analytics.activeAssignments}</strong><span>Current open workload.</span><Link href="/work-assignments">Review assignments →</Link></section><section><p>Payment verification</p><strong>{analytics.verifiedPayments} / {analytics.totalPayments}</strong><span>Verified payment records.</span><Link href="/payments">Review payments →</Link></section></aside></div></section>

    <section className="admin-reference-attention"><article className="admin-reference-card"><header><div><h2>Needs attention</h2><p>Operational items requiring an admin review.</p></div><Link href="/users">View users →</Link></header>{pendingProfiles === 0 ? <div className="admin-attention-empty"><strong>You&apos;re all caught up.</strong><span>No pending profile approvals were returned by the current admin data.</span></div> : <div className="admin-attention-item"><span className="admin-attention-symbol">!</span><div><strong>Profile approvals</strong><p>Freelancer and company profiles awaiting review.</p></div><b>{pendingProfiles}</b><Link href="/users">Review</Link></div>}</article><article className="admin-reference-card admin-reference-log"><header><div><h2>Recent actions</h2><p>Recorded administrative activity.</p></div><Link href="/action-log">View all →</Link></header>{activity.length === 0 ? <div className="admin-attention-empty"><strong>No activity recorded.</strong><span>Administrative actions will appear here.</span></div> : <ul>{activity.slice(0, 4).map((entry) => <li key={entry.id}><span aria-hidden="true" /><div><strong>{actionLabel(entry.action)}</strong><time dateTime={entry.createdAt}>{new Date(entry.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</time></div></li>)}</ul>}</article></section>

    <section className="admin-reference-table admin-reference-card"><header><div><h2>Recent Users</h2><p>Latest marketplace accounts and their current status.</p></div><Link href="/users">Manage users →</Link></header><div className="admin-table-tools"><span>Latest accounts</span><Link href="/users?role=freelancer">Freelancers</Link><Link href="/users?role=client">Companies</Link></div>{latestUsers.length === 0 ? <div className="admin-table-empty">No users have been returned by the current admin API.</div> : <div className="admin-table-scroll"><table><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th><th aria-label="Actions" /></tr></thead><tbody>{latestUsers.map((user) => <tr key={user.id}><td><strong>{user.name}</strong><span>{user.email}</span></td><td><span className="admin-role-chip">{user.role ?? "unassigned"}</span></td><td><span className={`admin-status-chip admin-status-${user.status}`}>{user.status}</span></td><td>{new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td><td><Link href={`/users/${user.id}`}>Review →</Link></td></tr>)}</tbody></table></div>}</section>
  </div>;
}
