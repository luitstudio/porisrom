import { describe, expect, it } from "vitest";

import { BackendApiError } from "@/lib/backend-api";
import { classifyGoogleExchangeFailure, googleDiagnosticLogPayload } from "@/lib/google-auth-diagnostics";

describe("Google OAuth diagnostics", () => {
  it.each([
    [new BackendApiError(409, "Google account is not linked. Sign in with your password and link it from Settings."), "password_account_link_required"],
    [new BackendApiError(401, "Invalid Google identity token"), "invalid_or_unverified_google_identity"],
    [new BackendApiError(401, "Invalid or expired Google signup intent"), "missing_or_expired_signup_consent"],
    [new BackendApiError(403, "Complete Google signup from the registration form"), "missing_or_expired_signup_consent"],
    [new BackendApiError(403, "Account is not active"), "inactive_account"],
    [new BackendApiError(429, "Too many requests"), "rate_limited"],
    [new BackendApiError(503, "provider response containing a token must not be logged"), "backend_server_failure"],
    [new Error("network failure with secret material"), "exchange_unavailable"],
  ])("classifies %s without exposing its message", (error, category) => {
    expect(classifyGoogleExchangeFailure(error).category).toBe(category);
  });

  it("uses an allowlisted payload that excludes sensitive error content", () => {
    const secret = "synthetic-id-token-or-email-that-must-not-appear";
    const payload = googleDiagnosticLogPayload(classifyGoogleExchangeFailure(
      new BackendApiError(503, secret),
    ));
    expect(payload).toBe('{"event":"google_identity_exchange_rejected","category":"backend_server_failure","status":503}');
    expect(payload).not.toContain(secret);
    expect(payload).not.toContain("message");
  });
});
