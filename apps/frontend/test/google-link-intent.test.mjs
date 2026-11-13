import { afterEach, describe, expect, it } from "vitest";

import {
  createGoogleLinkIntent,
  GOOGLE_LINK_INTENT_MAX_AGE_SECONDS,
  resolveGoogleLinkCallback,
} from "@/lib/google-link-intent";

process.env.AUTH_SECRET = "test-only-signing-secret";

function backendToken(userId = "user-1", sessionId = "session-1") {
  const payload = Buffer.from(JSON.stringify({ sub: userId, sid: sessionId })).toString("base64url");
  return `test.${payload}.signature`;
}

function intent(now = Date.now()) {
  return createGoogleLinkIntent({
    userId: "user-1",
    sessionId: "session-1",
    returnPath: "/dashboard/freelancer/settings",
    nonce: "intent-nonce",
  }, now);
}

describe("Google link intent", () => {
  afterEach(() => { process.env.AUTH_SECRET = "test-only-signing-secret"; });

  it("routes an absent intent through the normal sign-in flow", () => {
    expect(resolveGoogleLinkCallback(undefined, backendToken())).toEqual({ kind: "normal" });
  });

  it("routes only a valid intent bound to the current backend session to linking", () => {
    expect(resolveGoogleLinkCallback(intent(), backendToken()).kind).toBe("link");
    expect(resolveGoogleLinkCallback(intent(), backendToken("user-1", "different-session"))).toEqual({
      kind: "result", result: "session_changed",
    });
  });

  it("rejects expired or tampered link intents", () => {
    const now = Date.now();
    expect(resolveGoogleLinkCallback(intent(now), backendToken()).kind).toBe("link");
    const expired = intent(now - GOOGLE_LINK_INTENT_MAX_AGE_SECONDS * 1000 - 1);
    expect(resolveGoogleLinkCallback(expired, backendToken())).toEqual({ kind: "result", result: "expired_or_invalid" });
    expect(resolveGoogleLinkCallback(`${intent()}.changed`, backendToken())).toEqual({ kind: "result", result: "expired_or_invalid" });
  });
});
