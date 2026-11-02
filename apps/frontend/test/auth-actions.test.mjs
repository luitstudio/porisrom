import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/navigation", () => ({ redirect: (path) => { throw Error(`redirect:${path}`); } }));
vi.mock("next-auth", () => ({ AuthError: class AuthError extends Error {} }));
vi.mock("@/auth", () => ({ signIn: vi.fn() }));
vi.mock("@/lib/backend-api", () => ({ backendFetch: vi.fn(), BackendApiError: class extends Error {} }));
import { signIn } from "@/auth";
import { backendFetch } from "@/lib/backend-api";
import { AuthError } from "next-auth";
import { loginAction, signupAction } from "../src/app/auth/actions";
function form() { const data = new FormData(); for (const [key, value] of Object.entries({ email: "synthetic@example.test", password: "Synthetic-test-only!", name: "Synthetic User", role: "client" })) data.set(key, value); return data; }
beforeEach(() => { vi.clearAllMocks(); });
describe("marketplace login session ownership", () => {
  it("logs in only through Credentials without issuing a discarded preflight session", async () => {
    signIn.mockResolvedValue(undefined);
    await expect(loginAction({}, form())).rejects.toThrow("redirect:/dashboard");
    expect(signIn).toHaveBeenCalledTimes(1); expect(backendFetch).not.toHaveBeenCalled();
  });
  it("does not authenticate invalid form data", async () => {
    const data = form(); data.set("email", "invalid");
    expect((await loginAction({}, data)).error).toBeTruthy(); expect(signIn).not.toHaveBeenCalled();
  });
  it("reports rejected credentials without a second backend login", async () => {
    signIn.mockRejectedValueOnce(new AuthError("Synthetic credential rejection"));
    expect(await loginAction({}, form())).toEqual({ error: "Invalid email or password." });
    expect(backendFetch).not.toHaveBeenCalled();
  });
  it("revokes the transient signup session before Credentials sign-in", async () => {
    backendFetch.mockResolvedValueOnce({ accessToken: "synthetic-registration", refreshToken: "synthetic-registration-refresh" }).mockResolvedValueOnce({ success: true });
    signIn.mockResolvedValue(undefined);
    await expect(signupAction({}, form())).rejects.toThrow("redirect:/onboarding");
    expect(backendFetch).toHaveBeenLastCalledWith("/auth/logout", { method: "POST", accessToken: "synthetic-registration", body: { refreshToken: "synthetic-registration-refresh" } });
    expect(backendFetch.mock.invocationCallOrder[1]).toBeLessThan(signIn.mock.invocationCallOrder[0]);
  });
  it("does not claim registration-session revocation if it failed", async () => {
    backendFetch.mockResolvedValueOnce({ accessToken: "synthetic-registration", refreshToken: "synthetic-registration-refresh" }).mockRejectedValueOnce(Error("Synthetic outage"));
    expect((await signupAction({}, form())).error).toContain("Account created"); expect(signIn).not.toHaveBeenCalled();
  });
});
