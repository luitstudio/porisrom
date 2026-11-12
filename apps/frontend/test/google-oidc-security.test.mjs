import { describe, expect, it } from "vitest";

import { GOOGLE_OIDC_CHECKS } from "@/lib/google-oidc-security";

describe("Google OIDC security configuration", () => {
  it("requires state, PKCE, and nonce validation", () => {
    expect(GOOGLE_OIDC_CHECKS).toEqual(["state", "pkce", "nonce"]);
  });
});
