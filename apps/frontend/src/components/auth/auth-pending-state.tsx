"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, ShieldCheck, Sparkles } from "lucide-react";

type AuthPendingContextValue = {
  isPending: boolean;
  message: string;
  progress: number;
  setPending: (value: { isPending: boolean; messages: string[] }) => void;
};

const AuthPendingContext = React.createContext<AuthPendingContextValue | null>(null);

const DEFAULT_MESSAGE = "Checking your credentials...";

export function AuthPendingProvider({ children }: { children: React.ReactNode }) {
  const [isPending, setIsPending] = React.useState(false);
  const [messages, setMessages] = React.useState<string[]>([DEFAULT_MESSAGE]);
  const [messageIndex, setMessageIndex] = React.useState(0);

  React.useEffect(() => {
    if (!isPending) {
      return;
    }

    const messageTimer = window.setInterval(() => {
      setMessageIndex((index) => (index + 1) % messages.length);
    }, 720);

    return () => {
      window.clearInterval(messageTimer);
    };
  }, [isPending, messages.length]);

  React.useEffect(() => {
    const originalBodyCursor = document.body.style.cursor;
    const originalRootCursor = document.documentElement.style.cursor;

    if (isPending) {
      document.body.style.cursor = "progress";
      document.documentElement.style.cursor = "progress";
    }

    return () => {
      document.body.style.cursor = originalBodyCursor;
      document.documentElement.style.cursor = originalRootCursor;
    };
  }, [isPending]);

  const setPending = React.useCallback(
    ({ isPending: nextIsPending, messages: nextMessages }: { isPending: boolean; messages: string[] }) => {
      setIsPending(nextIsPending);
      setMessages(nextMessages.length > 0 ? nextMessages : [DEFAULT_MESSAGE]);
      if (nextIsPending) {
        setMessageIndex(0);
      } else {
        setMessageIndex(0);
      }
    },
    []
  );

  const value = React.useMemo<AuthPendingContextValue>(
    () => ({
      isPending,
      message: messages[messageIndex] ?? messages[0] ?? DEFAULT_MESSAGE,
      progress:
        messages.length <= 1 ? 100 : Math.min(100, ((messageIndex + 1) / messages.length) * 100),
      setPending,
    }),
    [isPending, messageIndex, messages, setPending]
  );

  return (
    <AuthPendingContext.Provider value={value}>{children}</AuthPendingContext.Provider>
  );
}

export function useAuthPending() {
  const context = React.useContext(AuthPendingContext);

  if (!context) {
    throw new Error("useAuthPending must be used within AuthPendingProvider");
  }

  return context;
}

export function useRegisterAuthPending(isPending: boolean, messages: string[]) {
  const { setPending } = useAuthPending();

  React.useLayoutEffect(() => {
    setPending({ isPending, messages });

    return () => {
      setPending({ isPending: false, messages });
    };
  }, [isPending, messages, setPending]);
}

export function PendingButtonContent({
  idleLabel,
  pendingLabel = "Authenticating...",
  pending,
}: {
  idleLabel: React.ReactNode;
  pendingLabel?: string;
  pending: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <span className="grid min-w-0 place-items-center">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={pending ? "pending" : "idle"}
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4, filter: "blur(2px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, filter: "blur(2px)" }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: "easeOut" }}
          className="col-start-1 row-start-1 flex min-w-0 items-center justify-center gap-2"
        >
          {pending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              <span className="truncate">{pendingLabel}</span>
            </>
          ) : (
            idleLabel
          )}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function AuthPendingOverlay() {
  const { isPending, message, progress } = useAuthPending();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence>
      {isPending && (
        <motion.div
          initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: "easeOut" }}
          className="absolute inset-0 z-20 grid place-items-center bg-white/60 p-6 backdrop-blur-sm"
          aria-live="polite"
          aria-busy="true"
        >
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.99 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.22, ease: "easeOut" }}
            className="flex w-full max-w-72 flex-col items-center gap-4 rounded-3xl border border-border/70 bg-white/92 p-6 text-center shadow-[0_24px_70px_-36px_rgba(20,21,43,0.5)]"
          >
            <div className="relative flex size-12 items-center justify-center rounded-2xl bg-lavender text-primary">
              <motion.div
                className="absolute inset-0 rounded-2xl border border-primary/20"
                animate={prefersReducedMotion ? undefined : { scale: [0.96, 1.06, 0.96], opacity: [0.55, 1, 0.55] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              />
              <StatusIcon message={message} />
            </div>
            <div className="grid min-h-6 place-items-center px-2">
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={message}
                  initial={prefersReducedMotion ? false : { opacity: 0, y: 8, filter: "blur(3px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -8, filter: "blur(3px)" }}
                  transition={{ duration: prefersReducedMotion ? 0 : 0.38, ease: "easeOut" }}
                  className="col-start-1 row-start-1 text-sm font-semibold text-foreground"
                >
                  {message}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="h-[3px] w-full overflow-hidden rounded-full bg-primary/10">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-primary via-orchid to-magenta"
                initial={false}
                animate={{ width: `${progress}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.45, ease: "easeOut" }}
              />
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-hidden="true">
              <span className="size-1 rounded-full bg-primary/70" />
              <motion.span
                animate={prefersReducedMotion ? undefined : { opacity: [0.35, 1, 0.35] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
                className="size-1 rounded-full bg-primary/70"
              />
              <motion.span
                animate={prefersReducedMotion ? undefined : { opacity: [0.2, 1, 0.2] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut", delay: 0.18 }}
                className="size-1 rounded-full bg-primary/70"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatusIcon({ message }: { message: string }) {
  if (message.toLowerCase().includes("secur")) {
    return <ShieldCheck className="relative size-5" aria-hidden="true" />;
  }

  if (message.toLowerCase().includes("ready") || message.toLowerCase().includes("welcome")) {
    return <Check className="relative size-5" aria-hidden="true" />;
  }

  return <Sparkles className="relative size-5" aria-hidden="true" />;
}
