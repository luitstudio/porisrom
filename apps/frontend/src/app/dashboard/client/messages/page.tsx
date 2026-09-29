import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { listConnectionsAction } from "@/app/connections/actions";
import { listConversationsAction } from "@/app/messages/actions";
import { PendingConnectionsPanel } from "@/components/connections/pending-connections-panel";
import { ConversationsList } from "@/components/messages/conversations-list";
import { ClientMessagesWorkspace } from "@/components/dashboard/client/messages-workspace";

export default async function ClientMessagesPage() {
  const session = await auth();
  if (!session) redirect("/auth/login");

  const [conversations, connections] = await Promise.all([
    listConversationsAction(),
    listConnectionsAction().catch(() => null),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 py-1 pb-24 text-[#F5F5F5] sm:gap-5 sm:py-2 sm:pb-2">
      <header className="border-b border-[#2B2E34] pb-4"><p className="text-metadata font-semibold uppercase tracking-[.16em] text-[#F07E6A]">Client workspace</p><h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight text-[#F5F5F5] sm:text-3xl">Messages</h1><p className="mt-1 text-metadata leading-5 text-[#A0A5AF]">Connection requests and conversations with your freelancers.</p></header>
      <div className="md:hidden"><ClientMessagesWorkspace conversations={conversations} connections={connections ?? []} connectionsFailed={connections === null} viewerUserId={session.user.id} /></div>
      <div className="hidden min-w-0 gap-4 md:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"><section className="min-w-0"><div className="mb-3"><h2 className="font-heading text-card-title font-semibold text-foreground">Conversations</h2><p className="mt-1 text-metadata text-muted-foreground">Your latest freelancer discussions.</p></div><ConversationsList conversations={conversations} viewerUserId={session.user.id} basePath="/dashboard/client/messages" /></section><aside className="min-w-0 lg:sticky lg:top-5"><PendingConnectionsPanel initialConnections={connections ?? []} viewerUserId={session.user.id} messagesBasePath="/dashboard/client/messages" currentPath="/dashboard/client/messages" loadFailed={connections === null} /></aside></div>
    </main>
  );
}
