import { describe, expect, it, vi } from "vitest";

import { ConversationsService } from "../src/conversations/conversations.service";
import { RealtimeGateway } from "../src/realtime/realtime.gateway";
import type { PrismaService } from "../src/prisma/prisma.service";

const createdAt = new Date("2026-01-01T00:00:00.000Z");
const message = {
  id: "message-1",
  conversationId: "conversation-1",
  senderId: "client-1",
  body: "Hello",
  createdAt,
  readAt: null,
};

describe("realtime chat delivery", () => {
  it("persists a message before requesting a recipient-only realtime emit", async () => {
    const persisted = vi.fn(() => Promise.resolve(message));
    const emitted = vi.fn(() => Promise.resolve());
    const prisma = {
      db: {
        $transaction: vi.fn((callback) => callback({
          message: { create: persisted },
          notification: { create: vi.fn() },
        })),
        conversation: {
          findUnique: vi.fn(() => Promise.resolve({ connection: { requesterId: "client-1", receiverId: "freelancer-1" } })),
        },
      },
    } as unknown as PrismaService;
    const gateway = {
      emitMessageCreated: emitted,
      emitNotificationCreated: vi.fn(),
    } as unknown as RealtimeGateway;
    const service = new ConversationsService(prisma, gateway);

    await expect(service.sendMessage("client-1", "conversation-1", "Hello")).resolves.toEqual(message);
    expect(persisted.mock.invocationCallOrder[0]).toBeLessThan(emitted.mock.invocationCallOrder[0]!);
    expect(emitted).toHaveBeenCalledWith(message);
  });

  it("emits message.created only to the server-derived other participant", async () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const prisma = {
      db: {
        conversation: {
          findUnique: vi.fn(() => Promise.resolve({ connection: { requesterId: "client-1", receiverId: "freelancer-1" } })),
        },
      },
    } as unknown as PrismaService;
    const gateway = new RealtimeGateway({} as never, {} as never, prisma);
    gateway.afterInit({ use: vi.fn(), to } as never);

    await gateway.emitMessageCreated(message);
    expect(to).toHaveBeenCalledWith("user:freelancer-1");
    expect(emit).toHaveBeenCalledWith("message.created", {
      ...message,
      createdAt: createdAt.toISOString(),
    });
  });

  it("does not emit when the message sender is not a conversation participant", async () => {
    const to = vi.fn();
    const prisma = {
      db: {
        conversation: {
          findUnique: vi.fn(() => Promise.resolve({ connection: { requesterId: "client-1", receiverId: "freelancer-1" } })),
        },
      },
    } as unknown as PrismaService;
    const gateway = new RealtimeGateway({} as never, {} as never, prisma);
    gateway.afterInit({ use: vi.fn(), to } as never);

    await gateway.emitMessageCreated({ ...message, senderId: "unrelated-user" });
    expect(to).not.toHaveBeenCalled();
  });
});
