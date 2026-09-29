import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { HealthController } from "../src/health/health.controller";
import type { PrismaService } from "../src/prisma/prisma.service";

describe("health readiness", () => {
  it("returns a minimal ready response when PostgreSQL is reachable", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ "?column?": 1 }]);
    const controller = new HealthController({ db: { $queryRaw: queryRaw } } as unknown as PrismaService);

    await expect(controller.ready()).resolves.toEqual({ status: "ready" });
    expect(queryRaw).toHaveBeenCalledOnce();
  });

  it("returns a safe 503 response when PostgreSQL is unavailable", async () => {
    const controller = new HealthController({
      db: { $queryRaw: vi.fn().mockRejectedValue(new Error("postgresql://secret-host:5432/db failed")) },
    } as unknown as PrismaService);

    try {
      await controller.ready();
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      const exception = error as ServiceUnavailableException;
      expect(exception.getStatus()).toBe(503);
      const response = exception.getResponse();
      expect(response).toEqual({ status: "not_ready" });
      expect(JSON.stringify(response)).not.toContain("postgresql");
      expect(JSON.stringify(response)).not.toContain("secret-host");
    }
  });

  it("keeps the liveness endpoint independent from Prisma", () => {
    const controller = new HealthController({ db: { $queryRaw: vi.fn() } } as unknown as PrismaService);
    expect(controller.check()).toEqual({ status: "ok" });
  });
});
