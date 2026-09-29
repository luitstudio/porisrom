import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ConnectionsService } from "../src/connections/connections.service";
import type { PrismaService } from "../src/prisma/prisma.service";

type TestUser = { id: string; role: "freelancer" | "client" | "admin"; status: "active" | "blocked" | "deleted" };

function harness(users: Record<string, TestUser>) {
  let existing: null | {
    id: string;
    requesterId: string;
    receiverId: string;
    status: "pending";
    respondedAt: null;
  } = null;
  const lockCalls: unknown[][] = [];
  const tx = {
    $queryRaw: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
      lockCalls.push([Array.from(strings).join("?"), ...values]);
      return Promise.resolve([{ lock_value: "" }]);
    }),
    user: { findUnique: vi.fn(({ where }: { where: { id: string } }) => Promise.resolve(users[where.id] ?? null)) },
    connection: {
      findFirst: vi.fn(() => Promise.resolve(existing)),
      create: vi.fn(({ data }: { data: { requesterId: string; receiverId: string } }) => {
        existing = { id: "connection-1", ...data, status: "pending", respondedAt: null };
        return Promise.resolve({ ...existing, requester: users[data.requesterId], receiver: users[data.receiverId], conversation: null });
      }),
      update: vi.fn(),
    },
    notification: { create: vi.fn() },
  };
  const prisma = { db: { $transaction: <T>(callback: (client: typeof tx) => Promise<T>) => callback(tx) } } as unknown as PrismaService;
  return { service: new ConnectionsService(prisma), tx, lockCalls };
}

const activePair = {
  freelancer: { id: "freelancer", role: "freelancer", status: "active" },
  client: { id: "client", role: "client", status: "active" },
} satisfies Record<string, TestUser>;

describe("connection creation advisory locking", () => {
  it("creates a connection for an active freelancer/client pair and selects a supported lock result", async () => {
    const { service, tx, lockCalls } = harness(activePair);

    await expect(service.create("client", "freelancer")).resolves.toMatchObject({ status: "pending" });
    expect(tx.connection.create).toHaveBeenCalledOnce();
    expect(lockCalls[0]?.[0]).toContain("::text AS lock_value");
  });

  it("prevents an opposite-direction duplicate while using the same unordered pair key", async () => {
    const { service, tx, lockCalls } = harness(activePair);

    await service.create("client", "freelancer");
    await expect(service.create("freelancer", "client")).rejects.toBeInstanceOf(ConflictException);
    expect(tx.connection.create).toHaveBeenCalledOnce();
    expect(lockCalls[0]?.[1]).toBe(lockCalls[1]?.[1]);
  });

  it.each([
    [{ id: "admin", role: "admin", status: "active" }, activePair.client, ForbiddenException],
    [activePair.client, { id: "other", role: "client", status: "active" }, BadRequestException],
    [{ id: "client", role: "client", status: "blocked" }, activePair.freelancer, ForbiddenException],
    [activePair.client, { id: "freelancer", role: "freelancer", status: "deleted" }, BadRequestException],
  ] as const)("preserves invalid participant rejection", async (requester, receiver, ErrorType) => {
    const { service, tx } = harness({ [requester.id]: requester, [receiver.id]: receiver });

    await expect(service.create(requester.id, receiver.id)).rejects.toBeInstanceOf(ErrorType);
    expect(tx.connection.create).not.toHaveBeenCalled();
  });
});
