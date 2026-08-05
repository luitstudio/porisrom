import type { Metadata } from "next";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Log in — Porishrom Admin",
};

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <h1 className="text-xl font-semibold">Porishrom Admin</h1>
        <p className="mt-1 text-sm" style={{ color: "var(--muted)" }}>
          Sign in with your admin account
        </p>
        <LoginForm />
      </div>
    </main>
  );
}
