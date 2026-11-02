import { createHash } from "node:crypto";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createRefreshCoordinator as marketplaceCoordinator } from "../src/lib/refresh-coordinator";
import { createRefreshCoordinator as adminCoordinator } from "../../admin/src/lib/refresh-coordinator";

vi.mock("next-auth/jwt", () => ({ getToken: vi.fn() }));
vi.mock("@/lib/backend-api", () => ({ backendFetch: vi.fn(), BackendApiError: class extends Error { constructor(status, message) { super(message); this.status = status; } } }));
vi.mock("@/auth", () => ({ signOut: vi.fn(), handlers: { GET: vi.fn(), POST: vi.fn() } }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers({ cookie: "authjs.session-token=synthetic" })) }));
import { getToken } from "next-auth/jwt";
import { backendFetch, BackendApiError } from "@/lib/backend-api";
import { signOut, handlers } from "@/auth";
import { signOutAction } from "../src/app/dashboard/actions";
import { createAuthConfig } from "../src/auth.config";
import { GET, POST } from "../src/app/api/auth/[...nextauth]/route";

beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AUTH_SECRET", "synthetic-authjs-test-secret"); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe.each([["marketplace", marketplaceCoordinator], ["admin", adminCoordinator]])("%s refresh coordination", (_name, create) => {
  it("coalesces overlapping tabs and late responses but does not cache failures", async () => {
    const coordinate = create();
    let complete;
    const refresh = vi.fn(() => new Promise(resolve => { complete = resolve; }));
    const first = coordinate("synthetic-old-cookie", refresh);
    const second = coordinate("synthetic-old-cookie", refresh);
    await Promise.resolve();
    complete({ accessToken: "synthetic-new", refreshToken: "synthetic-next" });
    expect(await first).toEqual(await second);
    expect(await coordinate("synthetic-old-cookie", refresh)).toEqual(await first);
    expect(refresh).toHaveBeenCalledTimes(1);
    const failure = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce("recovered");
    await expect(coordinate("different-cookie", failure)).rejects.toThrow("offline");
    expect(await coordinate("different-cookie", failure)).toBe("recovered");
  });
});

it("revokes before clearing marketplace cookies using both credentials", async () => {
  getToken.mockResolvedValue({ accessToken: "synthetic-expired-access", refreshToken: "synthetic-refresh" });
  backendFetch.mockResolvedValue({ success: true });
  await signOutAction();
  expect(backendFetch).toHaveBeenCalledWith("/auth/logout", { method: "POST", accessToken: "synthetic-expired-access", body: { refreshToken: "synthetic-refresh" } });
  expect(backendFetch.mock.invocationCallOrder[0]).toBeLessThan(signOut.mock.invocationCallOrder[0]);
});

it("retains the marketplace session and reports unconfirmed revocation on failure", async () => {
  getToken.mockResolvedValue({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh" });
  backendFetch.mockRejectedValue(new Error("offline"));
  await expect(signOutAction()).rejects.toThrow("could not revoke");
  expect(signOut).not.toHaveBeenCalled();
});

it("does not rotate backend credentials during read-only rendering", async () => {
  const token = { accessTokenExpires: 0, accessToken: "expired", refreshToken: "old" };
  const result = await createAuthConfig(false).callbacks.jwt({ token });
  expect(result.error).toBe("RefreshPending");
  expect(backendFetch).not.toHaveBeenCalled();
});

it("marks a cross-worker refresh collision as pending rather than permanent failure", async () => {
  backendFetch.mockRejectedValue(new BackendApiError(409, "rotated"));
  const result = await createAuthConfig().callbacks.jwt({ token: { refreshToken: "collision-cookie", accessTokenExpires: 0 } });
  expect(result.error).toBe("RefreshPending");
});

it("does not send stale Set-Cookie values from a losing session request", async () => {
  handlers.GET.mockResolvedValue(Response.json({ error: "RefreshPending" }, { headers: { "Set-Cookie": "authjs.session-token=stale" } }));
  const result = await GET(new Request("https://synthetic.example/api/auth/session"));
  expect(result.status).toBe(200);
  expect((await result.json()).error).toBe("RefreshPending");
  expect(result.headers.get("set-cookie")).toBeNull();
});

it("checks the signed Auth.js CSRF cookie before revocation on direct signout", async () => {
  const valid = "synthetic-csrf";
  const digest = createHash("sha256").update(`${valid}${process.env.AUTH_SECRET}`).digest("hex");
  getToken.mockResolvedValue({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh" });
  backendFetch.mockResolvedValue({ success: true });
  handlers.POST.mockResolvedValue(Response.json({ url: "/" }));
  const make = signature => new Request("https://synthetic.example/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", cookie: `authjs.csrf-token=${encodeURIComponent(`${valid}|${signature}`)}; authjs.session-token=synthetic` }, body: `csrfToken=${valid}` });
  expect((await POST(make("forged"))).status).toBe(403);
  expect(backendFetch).not.toHaveBeenCalled();
  expect((await POST(make(digest))).status).toBe(200);
  expect(backendFetch).toHaveBeenCalledTimes(1);
});
