import { BackendApiError } from "@/lib/backend-api";

export type GoogleExchangeDiagnostic = {
  event: "google_identity_exchange_rejected";
  category:
    | "password_account_link_required"
    | "invalid_or_unverified_google_identity"
    | "missing_or_expired_signup_consent"
    | "inactive_account"
    | "rate_limited"
    | "backend_server_failure"
    | "backend_rejected"
    | "exchange_unavailable";
  status?: number;
};

// Error messages are considered only to categorize known, user-safe backend
// responses. They are deliberately never included in the returned diagnostic.
export function classifyGoogleExchangeFailure(error: unknown): GoogleExchangeDiagnostic {
  if (!(error instanceof BackendApiError)) {
    return { event: "google_identity_exchange_rejected", category: "exchange_unavailable" };
  }

  const message = error.message;
  let category: GoogleExchangeDiagnostic["category"] = "backend_rejected";
  if (error.status === 409 && message === "Google account is not linked. Sign in with your password and link it from Settings.") {
    category = "password_account_link_required";
  } else if (message === "Invalid or expired Google signup intent" || message === "Complete Google signup from the registration form") {
    category = "missing_or_expired_signup_consent";
  } else if (error.status === 401) {
    category = "invalid_or_unverified_google_identity";
  } else if (error.status === 403 && message === "Account is not active") {
    category = "inactive_account";
  } else if (error.status === 429) {
    category = "rate_limited";
  } else if (error.status >= 500) {
    category = "backend_server_failure";
  }
  return { event: "google_identity_exchange_rejected", category, status: error.status };
}

export function googleDiagnosticLogPayload(diagnostic: GoogleExchangeDiagnostic) {
  // Keep logging payloads allowlisted. Never spread an Error or request object.
  return JSON.stringify(diagnostic);
}
