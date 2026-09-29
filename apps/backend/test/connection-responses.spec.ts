import { ConflictException, ForbiddenException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ConnectionsService } from "../src/connections/connections.service";
import type { PrismaService } from "../src/prisma/prisma.service";

function connectionHarness() {
  const state = {
    status: "pending" as "pending" | "accepted" | "declined",
    conversationCount: 0,
  };
  const connection = {
    id: "connection-1",
    requesterId: "client-1",
    receiverId: "freelancer-1",
    respondedAt: null,
    requester: { id: "client-1", name: "Client", role: "client", status: "active" },
    receiver: { id: "freelancer-1", name: "Freelancer", role: "freelancer", status: "active" },
  };
  const tx = {
    $queryRaw: vi.fn().mockResolvedValue([{ id: connection.id }]),
    connection: {
      findUnique: vi.fn(async () => ({ ...connection, status: state.status })),
      update: vi.fn(async ({ data }: { data: { status: "accepted" | "declined" } }) => {
        state.status = data.status;
        return {
          ...connection,
          status: state.status,
          conversation: state.conversationCount ? { id: "conversation-1" } : null,
        };
      }),
    },
    conversation: {
      create: vi.fn(async () => {
        state.conversationCount += 1;
        return { id: "conversation-1" };
      }),
    },
    notification: { create: vi.fn() },
  };

  let queue = Promise.resolve();
  const transaction = vi.fn(<T>(callback: (client: typeof tx) => Promise<T>) => {
    const result = queue.then(() => callback(tx));
    queue = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  });
  const prisma = { db: { $transaction: transaction } } as unknown as PrismaService;
  return { service: new ConnectionsService(prisma), state, tx, transaction };
}

describe("connection response transactions", () => {
  it("allows the receiver to accept and returns its conversation", async () => {
    const { service } = connectionHarness();
    await expect(service.accept("freelancer-1", "connection-1")).resolves.toMatchObject({
      status: "accepted",
      conversation: { id: "conversation-1" },
    });
  });

  it("allows the receiver to decline", async () => {
    const { service } = connectionHarness();
    await expect(service.decline("freelancer-1", "connection-1")).resolves.toMatchObject({
      status: "declined",
      conversation: null,
    });
  });

  it.each(["accept", "decline"] as const)("does not let the requester %s", async (action) => {
    const { service } = connectionHarness();
    await expect(service[action]("client-1", "connection-1")).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it("prevents double accept and creates exactly one conversation", async () => {
    const { service, state, tx } = connectionHarness();
    await service.accept("freelancer-1", "connection-1");
    await expect(service.accept("freelancer-1", "connection-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(state.conversationCount).toBe(1);
    expect(tx.conversation.create).toHaveBeenCalledOnce();
  });

  it("prevents double decline", async () => {
    const { service, tx } = connectionHarness();
    await service.decline("freelancer-1", "connection-1");
    await expect(service.decline("freelancer-1", "connection-1")).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.connection.update).toHaveBeenCalledOnce();
  });

  it("serializes accept versus decline into one valid final state", async () => {
    const { service, state, tx } = connectionHarness();
    const results = await Promise.allSettled([
      service.accept("freelancer-1", "connection-1"),
      service.decline("freelancer-1", "connection-1"),
    ]);

    expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
    expect(results.filter(({ status }) => status === "rejected")).toHaveLength(1);
    expect(["accepted", "declined"]).toContain(state.status);
    expect(tx.connection.update).toHaveBeenCalledOnce();
    expect(state.conversationCount).toBe(state.status === "accepted" ? 1 : 0);
  });
});
