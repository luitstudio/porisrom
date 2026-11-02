import { vi } from "vitest";

// Explicit active pair for legacy workflow tests; moderation tests supply their own statuses.
export function activeMarketplaceFixture() {
  return {
    userBlock: { findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    user: { findMany: vi.fn().mockResolvedValue([
      { role: "client", status: "active" },
      { role: "freelancer", status: "active" },
    ]) },
  };
}
