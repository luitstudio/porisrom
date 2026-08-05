"use client";

import { useActionState } from "react";

import { broadcast, type NotificationFormState } from "./actions";

const initialState: NotificationFormState = {};

export function BroadcastForm() {
  const [state, formAction, isPending] = useActionState(broadcast, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <textarea
        name="message"
        required
        rows={3}
        placeholder="Message to send to every user"
        disabled={isPending}
        className="rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      />
      {state.error && <p style={{ color: "var(--danger)" }}>{state.error}</p>}
      {state.success && <p style={{ color: "var(--muted)" }}>{state.success}</p>}
      <button
        type="submit"
        disabled={isPending}
        className="self-start rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--primary)" }}
      >
        {isPending ? "Sending..." : "Broadcast to all users"}
      </button>
    </form>
  );
}
