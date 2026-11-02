import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/backend-api", () => ({ backendFetch: vi.fn(), BackendApiError: class extends Error {} }));
import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";
import { safetyAction } from "../src/app/safety/actions";
const form = (operation, extra = {}) => { const data = new FormData(); for (const [k, v] of Object.entries({ operation, ...extra })) data.set(k, v); return data; };
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ accessToken: "synthetic-only" }); backendFetch.mockResolvedValue({}); });
it("denies safety submissions without an active session", async () => {
  auth.mockResolvedValue({ error: "RefreshAccessTokenError" });
  expect((await safetyAction(form("block"))).error).toBe(true); expect(backendFetch).not.toHaveBeenCalled();
});
it("sends block actions through the authoritative API without cancelling assignments", async () => {
  expect((await safetyAction(form("block", { targetUserId: "synthetic-user" }))).error).toBeUndefined();
  expect(backendFetch).toHaveBeenCalledExactlyOnceWith("/safety/blocks", { method: "POST", accessToken: "synthetic-only", body: { blockedUserId: "synthetic-user" } });
});
it("sends private report reason and category without participant messaging", async () => {
  await safetyAction(form("report", { targetUserId: "synthetic-user", category: "fraud", reason: "Synthetic evidence only" }));
  expect(backendFetch).toHaveBeenCalledExactlyOnceWith("/safety/reports", expect.objectContaining({ body: { targetUserId: "synthetic-user", category: "fraud", reason: "Synthetic evidence only" } }));
});
it("does not claim success when revocation-independent safety persistence fails", async () => {
  backendFetch.mockRejectedValue(Error("Synthetic unavailable"));
  await expect(safetyAction(form("support", { category: "technical", reason: "Synthetic outage only" }))).rejects.toThrow("Synthetic unavailable");
});
it("escapes assignment identifiers and never performs financial settlement", async () => {
  await safetyAction(form("escalate", { id: "synthetic/id", reason: "Synthetic escalation" }));
  expect(backendFetch).toHaveBeenCalledExactlyOnceWith("/safety/assignments/synthetic%2Fid/escalate-cancellation", expect.objectContaining({ body: { reason: "Synthetic escalation" } }));
});
it("rejects arbitrary caller-supplied backend paths", async () => {
  expect((await safetyAction(form("/admin/users/block"))).error).toBe(true); expect(backendFetch).not.toHaveBeenCalled();
});
