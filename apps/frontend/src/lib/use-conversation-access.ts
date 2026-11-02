"use client";

import { useEffect, useState } from "react";
import { getConversationAccessAction } from "@/app/messages/actions";

export function useConversationAccess(conversationId: string) {
  const [access, setAccess] = useState({ conversationId: "", readOnly: true, checked: false });
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const current = await getConversationAccessAction(conversationId);
        if (!cancelled) setAccess({ conversationId, readOnly: current.readOnly, checked: true });
      } catch {
        if (!cancelled) setAccess({ conversationId, readOnly: true, checked: false });
      }
    };
    void check();
    const timer = setInterval(check, 4000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [conversationId]);
  return access.conversationId === conversationId ? access : { readOnly: true, checked: false };
}
