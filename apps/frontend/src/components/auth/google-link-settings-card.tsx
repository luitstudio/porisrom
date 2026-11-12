import { startGoogleLinkAction } from "@/app/dashboard/google-link-actions";
import { Button } from "@/components/ui/button";

export function GoogleLinkSettingsCard({ result }: { result?: string }) {
  const message = result === "linked" ? "Google sign-in is linked to this account."
    : result === "identity_in_use" ? "That Google account is linked to another account."
    : result === "email_mismatch" ? "Use the Google account that matches this account."
    : result === "inactive" ? "This account is not active."
    : result === "invalid_identity" ? "Google could not verify that sign-in."
    : result === "session_changed" ? "Your session changed. Sign in again before linking Google."
    : result === "expired_or_invalid" ? "The Google-link request expired. Start again from Settings."
    : result === "unavailable" ? "Google linking is unavailable. Please try again." : null;
  return (
    <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Google sign-in</h2>
      <p className="mt-1 text-sm text-muted-foreground">Link Google only while signed in to this account.</p>
      {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
      <form action={startGoogleLinkAction} className="mt-4">
        <Button type="submit" variant="outline">Link Google</Button>
      </form>
    </section>
  );
}
