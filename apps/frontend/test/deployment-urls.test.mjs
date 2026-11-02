import { afterEach, describe, expect, it, vi } from "vitest";
import { getBackendUrl as marketplace } from "../src/lib/backend-api";
import { getBackendUrl as admin } from "../../admin/src/lib/backend-api";
import { getPublicBackendUrl } from "../src/lib/public-backend-url";
afterEach(() => vi.unstubAllEnvs());
describe.each([["marketplace", marketplace], ["admin", admin], ["socket", getPublicBackendUrl]])("%s production URL safety", (_name, getUrl) => {
  it.each(["http://localhost:4000", "https://127.0.0.1:4000", "https://[::1]:4000", "http://api.example.test", "https://user:password@api.example.test", "https://api.example.test/path", "https://api.example.test?token=secret"])("rejects an unsafe production origin %#", (value) => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("BACKEND_URL", value); vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", value);
    expect(getUrl).toThrow();
  });
  it("accepts an explicit HTTPS origin", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("BACKEND_URL", "https://api.example.test"); vi.stubEnv("NEXT_PUBLIC_BACKEND_URL", "https://api.example.test");
    expect(getUrl()).toBe("https://api.example.test");
  });
});
