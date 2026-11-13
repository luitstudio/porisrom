import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ session: {}, cookie: "authjs.session-token=synthetic-new; Path=/; HttpOnly" }));
vi.mock("next-auth", () => ({ default: () => ({ auth: callback => async request => {
  const response = await callback({ nextUrl: request.nextUrl, auth: state.session });
  if (state.cookie) response.headers.append("Set-Cookie", state.cookie);
  return response;
} }) }));
vi.mock("@/lib/backend-api", () => ({ backendFetch: vi.fn() }));
import proxy from "../src/proxy";
import { backendFetch } from "@/lib/backend-api";

beforeEach(() => {
  state.session = { user: { role: "client", isOnboarded: true }, accessToken: "synthetic-new" };
  state.cookie = "authjs.session-token=synthetic-new; Path=/; HttpOnly";
  vi.mocked(backendFetch).mockResolvedValue({ role: "client", isOnboarded: true });
});

it("forwards the refreshed cookie to read-only rendering as well as the browser", async () => {
  const request = new NextRequest("https://synthetic.example/dashboard/client", { headers: { cookie: "authjs.session-token=stale; unrelated=preserved" } });
  const response = await proxy(request, {});
  expect(response.headers.get("x-middleware-request-cookie")).toContain("authjs.session-token=synthetic-new");
  expect(response.headers.get("x-middleware-request-cookie")).toContain("unrelated=preserved");
  expect(response.headers.get("x-middleware-request-cookie")).not.toContain("stale");
  expect(response.headers.get("set-cookie")).toContain("synthetic-new");
});

it("does not overwrite a winner's cookie when proxy refresh loses", async () => {
  state.session.error = "RefreshPending";
  const response = await proxy(new NextRequest("https://synthetic.example/dashboard/client"), {});
  expect(response.status).toBe(409);
  expect(response.headers.get("set-cookie")).toBeNull();
});

it("allows login after refresh revocation instead of redirecting back to a broken dashboard", async () => {
  state.session.error = "RefreshFailed";
  const response = await proxy(new NextRequest("https://synthetic.example/auth/login"), {});
  expect(response.headers.get("location")).toBeNull();
});

it("allows login when an otherwise unexpired cached JWT belongs to a revoked backend session", async () => {
  backendFetch.mockRejectedValueOnce(new Error("Unauthorized"));
  const response = await proxy(new NextRequest("https://synthetic.example/auth/login"), {});
  expect(response.headers.get("location")).toBeNull();
});

it("uses the backend role for dashboard routing when the Auth.js JWT role is stale", async () => {
  state.session = { user: { role: "client", isOnboarded: true }, accessToken: "synthetic-new" };
  backendFetch.mockResolvedValueOnce({ role: "freelancer", isOnboarded: true });
  const response = await proxy(new NextRequest("https://synthetic.example/dashboard/client"), {});
  expect(response.headers.get("location")).toBe("https://synthetic.example/dashboard/freelancer");
});
