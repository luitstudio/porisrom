import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { StorageMaintenanceGuard } from "../src/storage-maintenance/storage-maintenance.guard";

const context = { getHandler: () => "handler", getClass: () => "class" } as never;

describe("StorageMaintenanceGuard", () => {
  it("does not gate normal reads/downloads", async () => {
    const maintenance = { assertNewMutationsAllowed: vi.fn() };
    const guard = new StorageMaintenanceGuard({ getAllAndOverride: vi.fn(() => false) } as never, maintenance as never);
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(maintenance.assertNewMutationsAllowed).not.toHaveBeenCalled();
  });

  it("rejects marked mutation routes before their storage service executes", async () => {
    const maintenance = { assertNewMutationsAllowed: vi.fn().mockRejectedValue(new ServiceUnavailableException()) };
    const guard = new StorageMaintenanceGuard({ getAllAndOverride: vi.fn(() => true) } as never, maintenance as never);
    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
