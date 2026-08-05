"use client";

import { useActionState } from "react";

import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(login, initialState);

  return (
    <form action={formAction} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          disabled={isPending}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          disabled={isPending}
          className="rounded-md border px-3 py-2 text-sm"
          style={{ borderColor: "var(--border)", background: "var(--background)" }}
        />
      </div>

      {state.error && (
        <p className="text-sm" style={{ color: "var(--danger)" }}>
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 rounded-md px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        style={{ background: "var(--primary)" }}
      >
        {isPending ? "Signing in..." : "Sign in"}
      </button>
    </form>
  );
}
