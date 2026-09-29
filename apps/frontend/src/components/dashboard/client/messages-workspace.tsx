"use client";

import type { ConnectionRecord } from "@/app/connections/actions";
import type { ConversationSummary } from "@/app/messages/actions";
import { PendingConnectionsPanel } from "@/components/connections/pending-connections-panel";
import { ConversationsList } from "@/components/messages/conversations-list";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Props = { conversations: ConversationSummary[]; connections: ConnectionRecord[]; connectionsFailed: boolean; viewerUserId: string };

export function ClientMessagesWorkspace({ conversations, connections, connectionsFailed, viewerUserId }: Props) {
  const tabs = "w-full bg-[#181A1F] p-1 text-[#A0A5AF] [&_[data-slot=tabs-trigger]]:h-10 [&_[data-slot=tabs-trigger]]:rounded-lg [&_[data-slot=tabs-trigger]]:px-2 [&_[data-slot=tabs-trigger]]:text-xs min-[375px]:[&_[data-slot=tabs-trigger]]:text-sm [&_[data-slot=tabs-trigger][data-active]]:border-[#F07E6A]/40 [&_[data-slot=tabs-trigger][data-active]]:bg-[#4A2F2F] [&_[data-slot=tabs-trigger][data-active]]:text-[#F5F5F5]";
  return <Tabs defaultValue="conversations" className="gap-5"><TabsList className={tabs}><TabsTrigger value="conversations">Conversations</TabsTrigger><TabsTrigger value="requests">Connection Requests</TabsTrigger></TabsList><TabsContent value="conversations"><section><div className="mb-3 flex items-end justify-between gap-3"><div><h2 className="font-heading text-card-title font-semibold text-[#F5F5F5]">Conversations</h2><p className="mt-1 text-metadata text-[#A0A5AF]">Your latest freelancer discussions.</p></div></div><ConversationsList conversations={conversations} viewerUserId={viewerUserId} basePath="/dashboard/client/messages" clientPresentation /></section></TabsContent><TabsContent value="requests"><PendingConnectionsPanel initialConnections={connections} viewerUserId={viewerUserId} messagesBasePath="/dashboard/client/messages" currentPath="/dashboard/client/messages" loadFailed={connectionsFailed} clientPresentation /></TabsContent></Tabs>;
}
