import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/auth", () => ({ auth: vi.fn() }));
vi.mock("@/lib/backend-api", () => ({ backendFetch: vi.fn(), getBackendUrl: () => "http://127.0.0.1:4100" }));
import { auth } from "@/auth";
import { backendFetch } from "@/lib/backend-api";
import { completeOnboardingAction, uploadCompanyDocumentsAction } from "../src/app/onboarding/actions";
beforeEach(() => { vi.clearAllMocks(); auth.mockResolvedValue({ accessToken: "synthetic-only" }); backendFetch.mockResolvedValue({}); });
it("normalizes duplicate portfolio links in a profile submission", async () => {
  const result = await completeOnboardingAction("freelancer", { about: "Synthetic", address: "", state: "Assam", district: "", language: "", experience: "", categoryIds: [], skillIds: [], links: [" https://example.test/work ", "https://example.test/work", " "] });
  expect(result).toEqual({ redirectTo: "/dashboard/freelancer" });
  expect(backendFetch.mock.calls.filter(([p]) => p.endsWith("/portfolio"))).toHaveLength(1);
});
it("reports a failed profile save without pretending uploads completed", async () => {
  backendFetch.mockRejectedValue(Error("Synthetic unavailable"));
  expect(await completeOnboardingAction("client", { companyName: "Synthetic", categoryIds: [] })).toHaveProperty("error");
});
it("allows retry after a provider error without logging file bodies", async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({ ok: false, json: async () => ({ message: "Synthetic provider unavailable" }) });
    expect(await uploadCompanyDocumentsAction(new FormData())).toEqual({ error: "Synthetic provider unavailable" });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  } finally { globalThis.fetch = original; }
});
