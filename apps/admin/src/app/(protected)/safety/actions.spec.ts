import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/backend-api", () => ({ backendFetch: vi.fn(), BackendApiError: class extends Error {} }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { requireSession } from "@/lib/session";
import { backendFetch } from "@/lib/backend-api";
import { reviewSafetyCase } from "./actions";
const form = () => { const d = new FormData(); d.set("id", "synthetic-case"); d.set("decision", "deny_cancellation"); d.set("reason", "Synthetic reviewed evidence"); return d; };
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireSession).mockResolvedValue({ accessToken: "synthetic-only", user: { id: "synthetic-admin", name: "Synthetic", email: "synthetic@example.test", role: "admin" } }); });
it("requires an administrator session before reviewing a safety case", async () => {
  vi.mocked(requireSession).mockRejectedValue(Error("Synthetic denied"));
  await expect(reviewSafetyCase("", form())).rejects.toThrow("Synthetic denied"); expect(backendFetch).not.toHaveBeenCalled();
});
it("submits explicit cancellation decisions and mandatory reasons to the audited API", async () => {
  vi.mocked(backendFetch).mockResolvedValue({});
  expect(await reviewSafetyCase("", form())).toContain("audit record");
  expect(backendFetch).toHaveBeenCalledWith("/admin/safety/cases/synthetic-case/review", { method: "POST", accessToken: "synthetic-only", body: { decision: "deny_cancellation", reason: "Synthetic reviewed evidence" } });
});
it("never reports success when the required audit or database operation fails", async () => {
  vi.mocked(backendFetch).mockRejectedValue(Error("Synthetic audit failed"));
  await expect(reviewSafetyCase("", form())).rejects.toThrow("Synthetic audit failed");
});
