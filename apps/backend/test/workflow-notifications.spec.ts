import { ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ConnectionsService } from "../src/connections/connections.service";
import { ConversationsService } from "../src/conversations/conversations.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { RealtimeGateway } from "../src/realtime/realtime.gateway";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";

function prismaService(db: object) {
  return { db } as unknown as PrismaService;
}

const activeConnection = {
  id: "connection-1",
  requesterId: "client-1",
  receiverId: "freelancer-1",
  status: "pending",
  respondedAt: null,
  requester: { role: "client", status: "active" },
  receiver: { role: "freelancer", status: "active" },
};

describe("core workflow notification persistence", () => {
  it("creates connection_requested for the receiver on the connection transaction client", async () => {
    const tx = {
      $queryRaw: vi.fn(),
      user: {
        findUnique: vi.fn()
          .mockResolvedValueOnce({ id: "client-1", role: "client", status: "active" })
          .mockResolvedValueOnce({ id: "freelancer-1", role: "freelancer", status: "active" }),
      },
      connection: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(activeConnection),
      },
      notification: { create: vi.fn() },
    };
    const service = new ConnectionsService(
      prismaService({ $transaction: vi.fn((callback) => callback(tx)) }),
    );

    await service.create("client-1", "freelancer-1");
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "freelancer-1", type: "connection_requested" }),
    });
  });

  it.each([
    ["accept", "connection_accepted"],
    ["decline", "connection_declined"],
  ] as const)("creates %s notification for the requester in the response transaction", async (action, type) => {
    const tx = {
      $queryRaw: vi.fn(),
      connection: {
        findUnique: vi.fn().mockResolvedValue(activeConnection),
        update: vi.fn().mockResolvedValue(activeConnection),
      },
      conversation: { create: vi.fn() },
      notification: { create: vi.fn() },
    };
    const service = new ConnectionsService(
      prismaService({ $transaction: vi.fn((callback) => callback(tx)) }),
    );

    await service[action]("freelancer-1", "connection-1");
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "client-1", type }),
    });
  });

  it("creates message_received for only the other participant after message persistence", async () => {
    const notification = vi.fn();
    const emitted = vi.fn();
    const message = {
      id: "message-1",
      conversationId: "conversation-1",
      senderId: "client-1",
      body: "Hello",
      createdAt: new Date(),
      readAt: null,
    };
    const tx = { message: { create: vi.fn().mockResolvedValue(message) }, notification: { create: notification } };
    const service = new ConversationsService(
      prismaService({
        $transaction: vi.fn((callback) => callback(tx)),
        conversation: {
          findUnique: vi.fn().mockResolvedValue({
            connection: { requesterId: "client-1", receiverId: "freelancer-1" },
          }),
        },
      }),
      { emitMessageCreated: vi.fn(), emitNotificationCreated: emitted } as unknown as RealtimeGateway,
    );

    await service.sendMessage("client-1", "conversation-1", "Hello");
    expect(tx.message.create.mock.invocationCallOrder[0]).toBeLessThan(notification.mock.invocationCallOrder[0]!);
    expect(notification.mock.invocationCallOrder[0]).toBeLessThan(emitted.mock.invocationCallOrder[0]!);
    expect(notification).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "freelancer-1", type: "message_received" }),
    });
  });

  it("creates work_assignment_proposed for the other conversation participant on the transaction client", async () => {
    const tx = {
      workAssignment: { create: vi.fn().mockResolvedValue({ id: "assignment-1" }) },
      workAssignmentEvent: { create: vi.fn() },
      notification: { create: vi.fn() },
    };
    const service = new WorkAssignmentsService(
      prismaService({
        $transaction: vi.fn((callback) => callback(tx)),
        conversation: {
          findUnique: vi.fn().mockResolvedValue({
            connection: { requesterId: "client-1", receiverId: "freelancer-1" },
          }),
        },
        user: { findUnique: vi.fn().mockResolvedValue({ role: "client" }) },
        workAssignment: { findUnique: vi.fn().mockResolvedValue(null) },
      }),
    );

    await service.create("client-1", "conversation-1", {
      title: "Work",
      description: "Description",
      budgetAmount: 100,
    });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "freelancer-1", type: "work_assignment_proposed" }),
    });
  });

  it.each([
    ["accept", "work_assignment_accepted"],
    ["reject", "work_assignment_rejected"],
  ] as const)("creates %s for the client in the response transaction", async (action, type) => {
    const assignment = {
      id: "assignment-1",
      createdById: "client-1",
      status: "proposed",
      conversation: { connection: { requesterId: "client-1", receiverId: "freelancer-1" } },
    };
    const tx = {
      workAssignment: { update: vi.fn() },
      workAssignmentEvent: { create: vi.fn() },
      notification: { create: vi.fn() },
    };
    const service = new WorkAssignmentsService(
      prismaService({
        $transaction: vi.fn((callback) => callback(tx)),
        workAssignment: { findUnique: vi.fn().mockResolvedValueOnce(assignment).mockResolvedValueOnce(null) },
        user: { findUnique: vi.fn().mockResolvedValue({ role: "freelancer" }) },
      }),
    );

    await service.respond("freelancer-1", "assignment-1", { action });
    expect(tx.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "client-1", type }),
    });
  });

  it("does not create a notification when a failed state transition is rejected", async () => {
    const notification = vi.fn();
    const service = new WorkAssignmentsService(
      prismaService({
        workAssignment: {
          findUnique: vi.fn().mockResolvedValue({
            id: "assignment-1",
            createdById: "client-1",
            status: "accepted",
            conversation: { connection: { requesterId: "client-1", receiverId: "freelancer-1" } },
          }),
        },
        user: { findUnique: vi.fn().mockResolvedValue({ role: "freelancer" }) },
        $transaction: vi.fn(),
        notification: { create: notification },
      }),
    );

    await expect(service.respond("freelancer-1", "assignment-1", { action: "accept" })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(notification).not.toHaveBeenCalled();
  });
});
