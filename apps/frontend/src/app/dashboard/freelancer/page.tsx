import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BriefcaseBusiness, CheckCircle2, ClipboardList, Image as ImageIcon, MessageSquare, Settings, Star, Users, WalletCards } from "lucide-react";

import { listConnectionsAction } from "@/app/connections/actions";
import { listConversationsAction } from "@/app/messages/actions";
import { getFreelancerReviewDashboardAction } from "@/app/reviews/actions";
import { getFinancialHistoryAction, listWorkAssignmentsAction } from "@/app/work-assignments/actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { getCurrentUser } from "@/lib/current-user";

const ACTIONS = [
  ["Messages & connections", "Client requests and conversations", "/dashboard/freelancer/messages", MessageSquare],
  ["Find clients", "Discover new opportunities", "/companies", BriefcaseBusiness],
  ["Portfolio", "Manage your project links", "/dashboard/freelancer/portfolio", ImageIcon],
  ["Profile settings", "Keep your details current", "/dashboard/freelancer/settings", Settings],
] as const;
const TERMINAL = new Set(["completed", "cancelled", "rejected"]);
const darkCard = "border-border bg-card text-card-foreground shadow-[var(--shadow-subtle)]";
const DASHBOARD_DATA_TIMEOUT_MS = 8_000;

function money(value: number, currency = "INR") { return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(value); }
function greeting(hour: number) { return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening"; }
function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
async function withDashboardTimeout<T>(request: Promise<T>, fallback: T): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      request.catch(() => fallback),
      new Promise<T>((resolve) => { timeout = setTimeout(() => resolve(fallback), DASHBOARD_DATA_TIMEOUT_MS); }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export default async function FreelancerDashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/auth/login");
  const [connectionResult, conversationResult, financial, reviews] = await Promise.all([
    withDashboardTimeout(listConnectionsAction(), null), withDashboardTimeout(listConversationsAction(), null), withDashboardTimeout(getFinancialHistoryAction(), null), withDashboardTimeout(getFreelancerReviewDashboardAction(), null),
  ]);
  const connections = connectionResult ?? [];
  const conversations = conversationResult ?? [];
  const work = (await Promise.all(conversations.map((conversation) => withDashboardTimeout(listWorkAssignmentsAction(conversation.id), [])))).flat();
  const activeWork = work.filter(({ status }) => !TERMINAL.has(status));
  const activeConnections = connections.filter(({ status }) => status === "accepted");
  const incoming = connections.filter(({ status, receiverId }) => status === "pending" && receiverId === user.id);
  const currency = financial?.history[0]?.currency ?? "INR";
  const hasReviews = reviews && !reviews.profileMissing && reviews.ratingCount > 0;

  return <main className="min-h-screen overflow-x-clip bg-background px-3 py-5 pb-24 text-foreground min-[375px]:px-4 sm:px-6 md:py-7 md:pb-7 lg:px-8 lg:py-8"><div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-5 lg:gap-6">
    <div className="flex min-w-0 flex-col gap-3 md:hidden">
      <header className="flex min-w-0 flex-col gap-3"><div><p className="text-metadata font-medium uppercase tracking-[0.14em] text-primary">Freelancer workspace</p><h1 className="mt-1 break-words font-display text-2xl font-semibold tracking-tight text-foreground">{greeting(new Date().getHours())}, {user.name.split(" ")[0]}</h1><p className="mt-1 text-metadata leading-5 text-muted-foreground">A clear view of your profile, client relationships, work, and payments.</p></div><Button render={<Link href="/dashboard/freelancer/settings" />} nativeButton={false} variant="outline" size="sm" className="w-fit border-border bg-card text-foreground hover:bg-muted hover:text-foreground dark:bg-card dark:hover:bg-muted"><Settings data-icon="inline-start" />Profile settings</Button></header>
      <section className="grid grid-cols-2 gap-2.5">
        <MobileMetric icon={ClipboardList} label="Active work" value={activeWork.length} detail={activeWork.length === 1 ? "assignment" : "assignments"} />
        <MobileMetric icon={WalletCards} label="Verified earnings" value={financial ? money(financial.summary.verifiedAmount, currency) : "Unavailable"} detail={financial ? "payment summary" : "data unavailable"} />
        <MobileMetric icon={Users} label="Connections" value={activeConnections.length} detail={incoming.length ? `${incoming.length} waiting` : "client relationships"} />
        <MobileMetric icon={Star} label="Reviews" value={hasReviews ? reviews.ratingAvg.toFixed(1) : "None yet"} detail={hasReviews ? `${reviews.ratingCount} received` : "after completed work"} />
      </section>
      <section className="flex min-w-0 flex-col gap-3">
        <Card className={`${darkCard} min-w-0`}><CardContent className="p-0"><PanelHeader title="Recent conversations" description="Messages from accepted client connections." action={<Button render={<Link href="/dashboard/freelancer/messages" />} nativeButton={false} variant="outline" size="sm" className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground dark:bg-card dark:hover:bg-muted"><MessageSquare data-icon="inline-start" />Open messages</Button>} />{conversations.length ? <ul className="divide-y divide-border px-3">{conversations.slice(0, 4).map((conversation) => { const other = conversation.connection.requester.id === user.id ? conversation.connection.receiver : conversation.connection.requester; return <li key={conversation.id}><Link href={`/dashboard/freelancer/messages/${conversation.id}`} className="flex min-h-14 items-center gap-3 py-2.5 transition-colors hover:text-primary"><Avatar className="size-8 border-border"><AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{initials(other.name)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold text-foreground">{other.name}</span><span className="block truncate text-metadata text-muted-foreground">{conversation.messages[0]?.body ?? "No messages yet"}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></Link></li>; })}</ul> : <CompactEmpty icon={MessageSquare} text="No conversations yet. Connect with a company to begin." href="/companies" action="Find companies" />}</CardContent></Card>
        <Card className={darkCard}><CardContent className="p-0"><PanelHeader title="Current work" description="Assignments from your current conversations." />{activeWork.length ? <ul className="divide-y divide-border px-3">{activeWork.slice(0, 3).map((assignment) => <li key={assignment.id} className="flex min-h-13 items-center gap-3 py-2.5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><ClipboardList className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold text-foreground">{assignment.title}</span><span className="block text-metadata capitalize text-muted-foreground">{assignment.status.replaceAll("_", " ")}</span></span></li>)}</ul> : <CompactEmpty icon={CheckCircle2} text="No active work yet." href="/dashboard/freelancer/messages" action="Open messages" />}</CardContent></Card>
        <Card className={darkCard}><CardContent className="p-3.5"><div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="text-body font-semibold text-foreground">Profile strength</p><p className="mt-0.5 text-metadata text-muted-foreground">Complete your profile to help clients evaluate your work.</p></div><span className="shrink-0 text-section-title font-semibold text-primary">{user.profileCompleteness}%</span></div><Progress value={user.profileCompleteness} className="mt-3 h-1.5 bg-muted" />{user.profileCompleteness < 100 && <Button render={<Link href="/onboarding" />} nativeButton={false} variant="ghost" size="sm" className="mt-2 px-0 text-primary hover:bg-muted hover:text-foreground"><span>Continue setup</span><ArrowRight data-icon="inline-end" /></Button>}</CardContent></Card>
        <Card className={`${darkCard} min-w-0`}><CardContent className="p-0"><PanelHeader title="Workspace" description="Quick access to the tools you use most." /><div className="grid grid-cols-2 gap-px bg-border">{ACTIONS.map(([title, description, href, Icon]) => <div key={href} className="min-w-0 bg-card p-3"><span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-3.5" /></span><p className="mt-2 truncate text-body font-semibold text-foreground">{title}</p><p className="mt-0.5 truncate text-metadata text-muted-foreground">{description}</p><Button render={<Link href={href} />} nativeButton={false} variant="outline" size="sm" className="mt-2 border-border bg-card text-foreground hover:bg-muted hover:text-foreground dark:bg-card dark:hover:bg-muted"><span>Open</span><ArrowRight data-icon="inline-end" /></Button></div>)}</div></CardContent></Card>
      </section>
    </div>
    <div className="hidden min-w-0 md:block">
    <header className="flex min-w-0 flex-wrap items-end justify-between gap-3"><div><p className="text-metadata font-medium uppercase tracking-[0.14em] text-primary">Freelancer workspace</p><h1 className="mt-1 break-words font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{greeting(new Date().getHours())}, {user.name.split(" ")[0]}</h1><p className="mt-1.5 max-w-2xl text-muted-body text-muted-foreground">A clear view of your profile, client relationships, work, and payments.</p></div><Button render={<Link href="/dashboard/freelancer/settings" />} nativeButton={false} variant="outline" size="sm" className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground dark:bg-card dark:hover:bg-muted"><Settings data-icon="inline-start" />Profile settings</Button></header>
    <section className="grid min-w-0 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
      <Kpi icon={ClipboardList} label="Active work" value={activeWork.length} detail={activeWork.length === 1 ? "active assignment" : "active assignments"} />
      <Kpi icon={WalletCards} label="Verified earnings" value={financial ? money(financial.summary.verifiedAmount, currency) : "Unavailable"} detail={financial ? `${financial.summary.pendingAmount > 0 ? money(financial.summary.pendingAmount, currency) : "No"} pending payment` : "Payment data unavailable"} />
      <Kpi icon={Users} label="Connections" value={activeConnections.length} detail={incoming.length ? `${incoming.length} request${incoming.length === 1 ? "" : "s"} waiting` : "active client relationships"} />
      <Kpi icon={Star} label="Reviews" value={hasReviews ? reviews.ratingAvg.toFixed(1) : "No reviews yet"} detail={hasReviews ? `${reviews.ratingCount} client review${reviews.ratingCount === 1 ? "" : "s"}` : "Reviews follow completed work"} />
    </section>
    <section className="grid min-w-0 items-start gap-3 lg:grid-cols-12">
      <Card className={`${darkCard} min-w-0 self-start lg:col-span-7`}><CardContent className="p-0"><PanelHeader title="Recent conversations" description="Messages from accepted client connections." action={<Button render={<Link href="/dashboard/freelancer/messages" />} nativeButton={false} variant="outline" size="sm" className="border-border bg-card text-foreground hover:bg-muted hover:text-foreground dark:bg-card dark:hover:bg-muted"><MessageSquare data-icon="inline-start" />Open messages</Button>} />{conversations.length ? <ul className="divide-y divide-border px-4 sm:px-5">{conversations.slice(0, 4).map((conversation) => { const other = conversation.connection.requester.id === user.id ? conversation.connection.receiver : conversation.connection.requester; return <li key={conversation.id}><Link href={`/dashboard/freelancer/messages/${conversation.id}`} className="flex min-h-15 items-center gap-3 py-3 transition-colors hover:text-primary"><Avatar className="size-8 border-border"><AvatarFallback className="bg-accent text-xs font-semibold text-accent-foreground">{initials(other.name)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold text-foreground">{other.name}</span><span className="block truncate text-metadata text-muted-foreground">{conversation.messages[0]?.body ?? "No messages yet"}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></Link></li>; })}</ul> : <CompactEmpty icon={MessageSquare} text="No conversations yet. Connect with a company to begin." href="/companies" action="Find companies" />}</CardContent></Card>
      <div className="flex min-w-0 flex-col gap-3 lg:col-span-5"><Card className={darkCard}><CardContent className="p-0"><PanelHeader title="Current work" description="Assignments from your current conversations." />{activeWork.length ? <ul className="divide-y divide-border px-4 sm:px-5">{activeWork.slice(0, 3).map((assignment) => <li key={assignment.id} className="flex min-h-14 items-center gap-3 py-3"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><ClipboardList className="size-4" /></span><span className="min-w-0 flex-1"><span className="block truncate text-body font-semibold text-foreground">{assignment.title}</span><span className="block text-metadata capitalize text-muted-foreground">{assignment.status.replaceAll("_", " ")}</span></span></li>)}</ul> : <CompactEmpty icon={CheckCircle2} text="No active work yet." href="/dashboard/freelancer/messages" action="Open messages" />}</CardContent></Card>
        <Card className={darkCard}><CardContent className="p-4 sm:p-5"><div className="flex items-center justify-between gap-3"><div><p className="text-body font-semibold text-foreground">Profile strength</p><p className="mt-1 text-metadata text-muted-foreground">Complete your profile to help clients evaluate your work.</p></div><span className="text-section-title font-semibold text-primary">{user.profileCompleteness}%</span></div><Progress value={user.profileCompleteness} className="mt-4 h-1.5 bg-muted" />{user.profileCompleteness < 100 && <Button render={<Link href="/onboarding" />} nativeButton={false} variant="ghost" size="sm" className="mt-3 px-0 text-primary hover:bg-muted hover:text-foreground"><span>Continue setup</span><ArrowRight data-icon="inline-end" /></Button>}</CardContent></Card>
      </div>
      <Card className={`${darkCard} min-w-0 lg:col-span-12`}><CardContent className="p-0"><PanelHeader title="Workspace" description="Quick access to the tools you use most." /><div className="grid divide-y divide-border sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">{ACTIONS.map(([title, description, href, Icon]) => <div key={href} className="group flex min-h-28 min-w-0 gap-3 px-4 py-4 sm:px-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-4" /></span><span className="min-w-0"><span className="block text-body font-semibold text-foreground">{title}</span><span className="mt-1 block text-metadata leading-5 text-muted-foreground">{description}</span><Button render={<Link href={href} />} nativeButton={false} variant="outline" size="sm" className="mt-3 border-border bg-card text-foreground hover:bg-muted hover:text-foreground dark:bg-card dark:hover:bg-muted"><span>Open</span><ArrowRight data-icon="inline-end" /></Button></span></div>)}</div></CardContent></Card>
    </section>
    </div>
  </div></main>;
}

function Kpi({ icon: Icon, label, value, detail }: { icon: typeof ClipboardList; label: string; value: string | number; detail: string }) { return <Card className={darkCard}><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><p className="text-metadata font-medium text-muted-foreground">{label}</p><Icon className="size-4 text-primary" /></div><p className="mt-3 break-words font-display text-2xl font-semibold tracking-tight text-foreground">{value}</p><p className="mt-1 text-metadata text-muted-foreground">{detail}</p></CardContent></Card>; }
function MobileMetric({ icon: Icon, label, value, detail }: { icon: typeof ClipboardList; label: string; value: string | number; detail: string }) { return <Card className={darkCard}><CardContent className="p-3"><div className="flex items-start justify-between gap-2"><p className="truncate text-metadata font-medium text-muted-foreground">{label}</p><Icon className="size-3.5 shrink-0 text-primary" /></div><p className="mt-2 truncate font-display text-lg font-semibold tracking-tight text-foreground">{value}</p><p className="mt-0.5 truncate text-metadata text-muted-foreground">{detail}</p></CardContent></Card>; }
function PanelHeader({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) { return <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-5"><div><h2 className="font-heading text-card-title font-semibold text-foreground">{title}</h2><p className="mt-1 text-metadata text-muted-foreground">{description}</p></div>{action}</div>; }
function CompactEmpty({ icon: Icon, text, href, action }: { icon: typeof ClipboardList; text: string; href: string; action: string }) { return <div className="flex min-h-24 items-center gap-3 px-4 py-4 sm:px-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Icon className="size-4" /></span><div><p className="text-body text-muted-foreground">{text}</p><Button render={<Link href={href} />} nativeButton={false} variant="outline" size="sm" className="mt-2 border-border bg-card text-foreground hover:bg-muted hover:text-foreground dark:bg-card dark:hover:bg-muted"><span>{action}</span><ArrowRight data-icon="inline-end" /></Button></div></div>; }
