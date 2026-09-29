import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listConnectionsAction } from "@/app/connections/actions";
import { listConversationsAction } from "@/app/messages/actions";
import { PendingConnectionsPanel } from "@/components/connections/pending-connections-panel";
import { ConversationsList } from "@/components/messages/conversations-list";
import { AppPageHeader } from "@/components/dashboard/app-page-header";

export default async function FreelancerMessagesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const [conversations, connections] = await Promise.all([
    listConversationsAction(),
    listConnectionsAction().catch(() => null),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-3 py-5 min-[375px]:px-4 sm:px-6 sm:py-8 lg:px-8">
      <AppPageHeader title="Messages" description="Connection requests and conversations with your clients." />
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <section className="min-w-0"><div className="mb-3"><h2 className="font-heading text-card-title font-semibold text-foreground">Conversations</h2><p className="mt-1 text-metadata text-muted-foreground">Your latest client discussions.</p></div><ConversationsList conversations={conversations} viewerUserId={session.user.id} basePath="/dashboard/freelancer/messages" /></section>
        <aside className="min-w-0 lg:sticky lg:top-5"><PendingConnectionsPanel initialConnections={connections ?? []} viewerUserId={session.user.id} messagesBasePath="/dashboard/freelancer/messages" currentPath="/dashboard/freelancer/messages" loadFailed={connections === null} /></aside>
      </div>
    </main>
  );
}
