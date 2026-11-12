import { createHmac, timingSafeEqual } from "node:crypto";

export const GOOGLE_LINK_INTENT_COOKIE = "porisrom_google_link_intent";
export const GOOGLE_LINK_INTENT_MAX_AGE_SECONDS = 5 * 60;

export type GoogleLinkReturnPath = "/dashboard/freelancer/settings" | "/dashboard/client/settings";
type GoogleLinkIntent = {
  purpose: "google-link";
  userId: string;
  sessionId: string;
  returnPath: GoogleLinkReturnPath;
  nonce: string;
  expiresAt: number;
};

export type BackendSessionBinding = { userId: string; sessionId: string };

function secret() {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("Google link intent signing is unavailable");
  return value;
}

function encode(value: object) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function signature(payload: string, signingSecret: string) {
  return createHmac("sha256", signingSecret).update(payload).digest("base64url");
}

export function createGoogleLinkIntent(
  input: Omit<GoogleLinkIntent, "purpose" | "expiresAt">,
  now = Date.now(),
) {
  const payload = encode({
    purpose: "google-link",
    ...input,
    expiresAt: now + GOOGLE_LINK_INTENT_MAX_AGE_SECONDS * 1000,
  } satisfies GoogleLinkIntent);
  return `${payload}.${signature(payload, secret())}`;
}

export function verifyGoogleLinkIntent(value: string | undefined, now = Date.now()): GoogleLinkIntent | null {
  if (!value) return null;
  const [payload, suppliedSignature, ...rest] = value.split(".");
  if (!payload || !suppliedSignature || rest.length) return null;
  const expectedSignature = signature(payload, secret());
  if (suppliedSignature.length !== expectedSignature.length ||
    !timingSafeEqual(Buffer.from(suppliedSignature), Buffer.from(expectedSignature))) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<GoogleLinkIntent>;
    if (parsed.purpose !== "google-link" || typeof parsed.userId !== "string" || typeof parsed.sessionId !== "string" ||
      !["/dashboard/freelancer/settings", "/dashboard/client/settings"].includes(parsed.returnPath ?? "") ||
      typeof parsed.nonce !== "string" || typeof parsed.expiresAt !== "number" || parsed.expiresAt <= now) return null;
    return parsed as GoogleLinkIntent;
  } catch {
    return null;
  }
}

export function backendSessionBinding(accessToken: unknown): BackendSessionBinding | null {
  if (typeof accessToken !== "string") return null;
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { sub?: unknown; sid?: unknown };
    return typeof payload.sub === "string" && typeof payload.sid === "string"
      ? { userId: payload.sub, sessionId: payload.sid }
      : null;
  } catch {
    return null;
  }
}

export function linkIntentMatchesSession(intent: GoogleLinkIntent, binding: BackendSessionBinding | null) {
  return binding?.userId === intent.userId && binding.sessionId === intent.sessionId;
}

export function resolveGoogleLinkCallback(cookieValue: string | undefined, accessToken: unknown) {
  if (!cookieValue) return { kind: "normal" as const };
  const intent = verifyGoogleLinkIntent(cookieValue);
  if (!intent) return { kind: "result" as const, result: "expired_or_invalid" };
  if (!linkIntentMatchesSession(intent, backendSessionBinding(accessToken))) {
    return { kind: "result" as const, result: "session_changed" };
  }
  return { kind: "link" as const, intent };
}

export function googleLinkCompletionPath(result: string) {
  return `/auth/google-link-result?result=${encodeURIComponent(result)}`;
}
