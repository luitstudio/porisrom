import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => store, headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
vi.mock("./backend-api", () => ({ backendFetch: vi.fn(), BackendApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { backendFetch, BackendApiError } from "./backend-api";
import { getSession, loginAdmin, logoutAdmin, refreshAdminSession } from "./session";
import { sessionReturnUrl } from "./session-return-url";

describe("admin session lifecycle", () => {
  it.each(["//evil.example", "/\n/evil.example", "/\\evil.example", "/api/auth/refresh", "https://evil.example"])("confines refresh return URL %s", path => {
    expect(sessionReturnUrl("https://admin.example/api/auth/refresh", path).href).toBe("https://admin.example/");
  });
  beforeEach(() => {
    vi.clearAllMocks();
    store.get.mockImplementation((name: string) => ({ value: name.includes("refresh") ? "synthetic-refresh" : "synthetic-expired-access" }));
  });
  it("logs in an administrator and persists only protected session cookies", async () => {
    vi.mocked(backendFetch).mockResolvedValue({ user: { role: "admin" }, accessToken: "synthetic-admin-access", refreshToken: "synthetic-admin-refresh" });
    await loginAdmin("synthetic@example.test", "synthetic-test-password");
    expect(store.set).toHaveBeenCalledTimes(2);
    expect(store.set).toHaveBeenCalledWith("admin_access_token", "synthetic-admin-access", expect.objectContaining({ httpOnly: true }));
  });
  it("revokes the transient session of a non-admin login and sets no administrator cookies", async () => {
    vi.mocked(backendFetch).mockResolvedValueOnce({ user: { role: "client" }, accessToken: "synthetic-client-access", refreshToken: "synthetic-client-refresh" }).mockResolvedValueOnce({ success: true });
    await expect(loginAdmin("synthetic@example.test", "synthetic-test-password")).rejects.toMatchObject({ status: 403 });
    expect(store.set).not.toHaveBeenCalled();
    expect(backendFetch).toHaveBeenLastCalledWith("/auth/logout", { method: "POST", accessToken: "synthetic-client-access", body: { refreshToken: "synthetic-client-refresh" } });
  });
  it("revokes before deleting either cookie", async () => {
    vi.mocked(backendFetch).mockResolvedValue({ success: true });
    await logoutAdmin();
    expect(backendFetch).toHaveBeenCalledWith("/auth/logout", { method: "POST", accessToken: "synthetic-expired-access", body: { refreshToken: "synthetic-refresh" } });
    expect(store.delete).toHaveBeenCalledTimes(2);
    expect(vi.mocked(backendFetch).mock.invocationCallOrder[0]).toBeLessThan(store.delete.mock.invocationCallOrder[0]!);
  });
  it("preserves cookies when revocation is not confirmed", async () => {
    vi.mocked(backendFetch).mockRejectedValue(new Error("offline"));
    await expect(logoutAdmin()).rejects.toThrow("could not revoke");
    expect(store.delete).not.toHaveBeenCalled();
  });
  it("redirects rendering to a writable refresh route without rotating", async () => {
    vi.mocked(backendFetch).mockRejectedValue(new BackendApiError(401, "expired"));
    await expect(getSession()).rejects.toThrow("redirect:/api/auth/refresh?returnTo=%2F");
    expect(backendFetch).toHaveBeenCalledTimes(1);
    expect(store.set).not.toHaveBeenCalled();
  });
  it("coalesces refreshes and persists the replacement pair in a writable route", async () => {
    vi.mocked(backendFetch).mockResolvedValue({ user: { id: "synthetic-admin", role: "admin" }, accessToken: "new", refreshToken: "next" });
    await Promise.all([refreshAdminSession(), refreshAdminSession()]);
    expect(backendFetch).toHaveBeenCalledTimes(1);
    expect(store.set).toHaveBeenCalledWith("admin_refresh_token", "next", expect.objectContaining({ httpOnly: true }));
  });
});
