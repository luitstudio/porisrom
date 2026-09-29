"use client";

import * as React from "react";
import { Bell, CheckCircle2, CircleDollarSign, ClipboardList, LoaderCircle, MessageSquare, RefreshCw, UserPlus, XCircle } from "lucide-react";
import { io } from "socket.io-client";
import { useRouter } from "next/navigation";

import {
  listNotificationsAction,
  markNotificationReadAction,
  type NotificationItem,
} from "@/app/notifications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";
import { getPublicBackendUrl } from "@/lib/public-backend-url";
import {
  markNotificationRead,
  unreadNotificationCount,
  upsertNotificationById,
} from "@/lib/notification-state.mjs";

type NotificationBellProps = {
  accessToken: string;
  messagesHref: string;
};

const WORKFLOW_NOTIFICATION_TYPES = new Set([
  "connection_requested",
  "connection_accepted",
  "connection_declined",
  "message_received",
  "work_assignment_proposed",
  "work_assignment_accepted",
  "work_assignment_rejected",
]);

function notificationVisual(type: string) {
  if (["connection_declined", "work_assignment_rejected"].includes(type)) return { Icon: XCircle, className: "border-destructive/30 bg-destructive/10 text-destructive" };
  if (["connection_accepted", "work_assignment_accepted"].includes(type)) return { Icon: CheckCircle2, className: "border-success/30 bg-success/10 text-success" };
  if (type === "message_received") return { Icon: MessageSquare, className: "border-primary/30 bg-primary/10 text-primary" };
  if (type === "connection_requested") return { Icon: UserPlus, className: "border-primary/30 bg-primary/10 text-primary" };
  if (type.includes("payment")) return { Icon: CircleDollarSign, className: "border-primary/30 bg-primary/10 text-primary" };
  if (type.includes("work_assignment")) return { Icon: ClipboardList, className: "border-primary/30 bg-primary/10 text-primary" };
  return { Icon: Bell, className: "border-border bg-muted text-muted-foreground" };
}

function formatNotificationTime(iso: string) {
  return new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC", timeZoneName: "short" }).format(new Date(iso));
}

export function NotificationBell({ accessToken, messagesHref }: NotificationBellProps) {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [readingId, setReadingId] = React.useState<string | null>(null);
  const hasSeenSocketConnection = React.useRef(false);
  const portalTheme = messagesHref.includes("/dashboard/client") ? "dark dashboard-theme client-theme" : "dark dashboard-theme freelancer-theme";

  const refresh = React.useCallback(async (preserveRealtimeUpdates = false) => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await listNotificationsAction();
      setNotifications((current) => {
        if (!preserveRealtimeUpdates) return fresh;
        const freshIds = new Set(fresh.map(({ id }) => id));
        return [...fresh, ...current.filter(({ id }) => !freshIds.has(id))];
      });
    } catch {
      setError("We couldn't load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void Promise.resolve().then(() => refresh(true));
  }, [refresh]);

  React.useEffect(() => {
    const socket = io(getPublicBackendUrl(), {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
    });
    const onCreated = (notification: NotificationItem) => setNotifications((current) => upsertNotificationById(current, notification));
    const onConnect = () => {
      if (hasSeenSocketConnection.current) {
        void refresh();
        return;
      }
      hasSeenSocketConnection.current = true;
    };
    socket.on("notification.created", onCreated);
    socket.on("connect", onConnect);
    return () => {
      socket.off("notification.created", onCreated);
      socket.off("connect", onConnect);
      socket.disconnect();
    };
  }, [accessToken, refresh]);

  async function openNotification(notification: NotificationItem) {
    if (!notification.isRead) {
      setReadingId(notification.id);
      try {
        await markNotificationReadAction(notification.id);
        setNotifications((current) => markNotificationRead(current, notification.id));
      } catch {
        setError("We couldn't mark that notification as read.");
        setReadingId(null);
        return;
      }
      setReadingId(null);
    }
    if (WORKFLOW_NOTIFICATION_TYPES.has(notification.type)) router.push(messagesHref);
  }

  const unreadCount = unreadNotificationCount(notifications);

  return (
    <Popover>
      <PopoverTrigger render={<button type="button" aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"} className="relative flex size-10 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />}>
        <Bell className="size-4" aria-hidden="true" />
        {unreadCount > 0 && <span className="absolute right-0.5 top-0.5 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-4 text-primary-foreground ring-2 ring-card">{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </PopoverTrigger>
      <PopoverContent className={`${portalTheme} w-[min(25rem,calc(100vw-1rem))] gap-0 overflow-hidden border border-border bg-popover p-0 text-popover-foreground shadow-lg`} align="end">
        <div className="flex min-h-13 items-center justify-between border-b border-border px-4">
          <div className="flex items-center gap-2"><PopoverTitle className="font-semibold text-foreground">Notifications</PopoverTitle>{unreadCount > 0 && <Badge variant="secondary">{unreadCount} unread</Badge>}</div>
          <Button variant="ghost" size="icon-sm" onClick={() => void refresh()} aria-label="Refresh notifications"><RefreshCw className="size-4" /></Button>
        </div>
        <div className="max-h-[min(26rem,calc(100vh-7rem))] overflow-y-auto p-2">
          {loading && <div className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground"><LoaderCircle className="size-4 animate-spin" /> Loading notifications</div>}
          {!loading && error && <div className="px-3 py-6"><p className="text-sm text-destructive">{error}</p><Button className="mt-3" variant="outline" onClick={() => void refresh()}>Retry</Button></div>}
          {!loading && !error && notifications.length === 0 && <div className="flex flex-col items-center px-3 py-8 text-center"><span className="flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground"><Bell className="size-4" /></span><p className="mt-3 text-sm font-medium text-foreground">You&apos;re all caught up</p><p className="mt-1 text-xs text-muted-foreground">New activity will appear here.</p></div>}
          {!loading && !error && notifications.map((notification) => {
            const { Icon, className } = notificationVisual(notification.type);
            return <button key={notification.id} type="button" onClick={() => void openNotification(notification)} disabled={readingId === notification.id} className={`relative flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors hover:bg-muted disabled:opacity-60 ${notification.isRead ? "text-muted-foreground" : "bg-accent/50 text-foreground"}`}>
              <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border ${className}`}><Icon className="size-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm leading-5">{notification.message}</span><time className="mt-1 block text-xs text-muted-foreground" dateTime={notification.createdAt}>{formatNotificationTime(notification.createdAt)}</time></span>
              {!notification.isRead && <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
              {readingId === notification.id && <LoaderCircle className="absolute bottom-2 right-3 size-3 animate-spin text-primary" aria-label="Marking as read" />}
            </button>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
