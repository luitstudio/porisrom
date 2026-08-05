"use client";

import { useActionState } from "react";

import { sendDirectMessage, type NotificationFormState } from "./actions";

const initialState: NotificationFormState = {};

export function DirectMessageForm({ users }: { users: { id: string; name: string; email: string }[] }) {
  const [state, formAction, isPending] = useActionState(sendDirectMessage, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <select
        name="userId"
        required
        disabled={isPending}
        defaultValue=""
        className="rounded-md border px-3 py-2 text-sm"
        style={{ borderColor: "var(--border)", background: "var(--background)" }}
      >
        <option value="" disabled>
          Select a recipient
        </option>
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.email})
          </option>
        ))}
      </select>
      <textarea
        name="directMessage"
        required
        rows={3}
        placeholder="Message to send to this user"
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
        {isPending ? "Sending..." : "Send direct message"}
      </button>
    </form>
  );
}
