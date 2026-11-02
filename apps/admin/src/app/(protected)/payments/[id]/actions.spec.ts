import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/session", () => ({ requireSession: vi.fn() }));
vi.mock("@/lib/backend-api", () => ({ backendFetch: vi.fn(), BackendApiError: class extends Error { constructor(public status: number, message: string) { super(message); } } }));
import { requireSession } from "@/lib/session";
import { backendFetch, BackendApiError } from "@/lib/backend-api";
import { revalidatePath } from "next/cache";
import { resolveDispute } from "./actions";

function form(outcome = "complete", reason = "Synthetic manual review reason") {
  const data = new FormData();
  data.set("paymentId", "synthetic-payment"); data.set("outcome", outcome); data.set("reason", reason); data.set("expectedMismatchCount", "3");
  return data;
}
beforeEach(() => { vi.clearAllMocks(); vi.mocked(requireSession).mockResolvedValue({ accessToken: "synthetic-test-token", user: { id: "synthetic-admin", role: "admin", name: "Synthetic", email: "synthetic@example.test" } }); });
describe("admin dispute server action", () => {
  it.each(["complete", "reopen_claims"])("submits authenticated %s and refreshes actual state", async (outcome) => {
    vi.mocked(backendFetch).mockResolvedValue({ auditId: "synthetic-audit" });
    const result = await resolveDispute({}, form(outcome));
    expect(result.success).toBeTruthy();
    expect(backendFetch).toHaveBeenCalledWith("/admin/payments/synthetic-payment/resolve", { method: "POST", accessToken: "synthetic-test-token",
      body: { outcome, reason: "Synthetic manual review reason", expectedMismatchCount: 3 } });
    expect(revalidatePath).toHaveBeenCalledWith("/payments/synthetic-payment");
  });
  it("requires the actual administrator session before requesting a mutation", async () => {
    vi.mocked(requireSession).mockRejectedValue(new Error("Access denied"));
    await expect(resolveDispute({}, form())).rejects.toThrow("Access denied");
    expect(backendFetch).not.toHaveBeenCalled();
  });
  it.each([403, 409, 500])("reports API failure %i without claiming success", async (status) => {
    vi.mocked(backendFetch).mockRejectedValue(new BackendApiError(status, "Synthetic API failure"));
    expect(await resolveDispute({}, form())).toEqual({ error: "Synthetic API failure" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("reports an unconfirmed network result and requires checking current state", async () => {
    vi.mocked(backendFetch).mockRejectedValue(new Error("Synthetic outage"));
    expect((await resolveDispute({}, form())).error).toContain("Reload the dispute");
  });
  it.each([["refund", "Synthetic manual review reason"], ["complete", "short"]])("rejects invalid input %#", async (outcome, reason) => {
    expect((await resolveDispute({}, form(outcome, reason))).error).toBeTruthy();
    expect(backendFetch).not.toHaveBeenCalled();
  });
});
