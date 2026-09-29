import { describe, expect, it, vi } from "vitest";

import { RealtimeGateway } from "../src/realtime/realtime.gateway";
import type { PrismaService } from "../src/prisma/prisma.service";

type TestUser = { id: string; role: string; status: "active" | "blocked" | "deleted" };

function harness(user: TestUser | null, verify = vi.fn()) {
  const jwtService = { verifyAsync: verify };
  const configService = { getOrThrow: vi.fn(() => "test-access-secret") };
  const prisma = {
    db: { user: { findUnique: vi.fn(() => Promise.resolve(user)) } },
  } as unknown as PrismaService;
  const gateway = new RealtimeGateway(jwtService as never, configService as never, prisma);
  let middleware: ((socket: unknown, next: (error?: Error) => void) => void) | undefined;
  gateway.afterInit({ use: vi.fn((handler) => { middleware = handler; }) } as never);

  const socket = {
    handshake: { auth: {}, headers: {} },
    data: {},
    join: vi.fn(),
  };
  return { configService, gateway, jwtService, middleware: middleware!, prisma, socket };
}

async function runMiddleware(
  middleware: (socket: unknown, next: (error?: Error) => void) => void,
  socket: unknown,
) {
  return new Promise<Error | undefined>((resolve) => middleware(socket, resolve));
}

describe("RealtimeGateway authentication", () => {
  it("accepts a verified active JWT and joins only the derived user room", async () => {
    const verify = vi.fn(() => Promise.resolve({ sub: "user-1", role: "admin" }));
    const { gateway, middleware, socket, jwtService, prisma } = harness(
      { id: "user-1", role: "freelancer", status: "active" },
      verify,
    );
    socket.handshake.auth = { token: "valid-token" };

    await expect(runMiddleware(middleware, socket)).resolves.toBeUndefined();
    expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token", { secret: "test-access-secret" });
    expect(prisma.db.user.findUnique).toHaveBeenCalledWith({
      where: { id: "user-1" },
      select: { id: true, role: true, status: true },
    });
    expect(socket.data).toEqual({ user: { userId: "user-1", role: "freelancer" } });
    gateway.handleConnection(socket as never);
    expect(socket.join).toHaveBeenCalledWith("user:user-1");
  });

  it("rejects an invalid JWT", async () => {
    const { middleware, socket } = harness(null, vi.fn(() => Promise.reject(new Error("bad token"))));
    socket.handshake.headers = { authorization: "Bearer invalid-token" };

    await expect(runMiddleware(middleware, socket)).resolves.toMatchObject({ message: "Unauthorized" });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it.each(["blocked", "deleted"] as const)("rejects a %s user after JWT verification", async (status) => {
    const { middleware, socket } = harness(
      { id: "user-1", role: "freelancer", status },
      vi.fn(() => Promise.resolve({ sub: "user-1", role: "freelancer" })),
    );
    socket.handshake.auth = { token: "valid-token" };

    await expect(runMiddleware(middleware, socket)).resolves.toMatchObject({ message: "Unauthorized" });
    expect(socket.join).not.toHaveBeenCalled();
  });

  it("rejects a malformed handshake without attempting JWT verification", async () => {
    const { middleware, socket, jwtService } = harness(
      { id: "user-1", role: "freelancer", status: "active" },
      vi.fn(),
    );
    socket.handshake.auth = { token: 42 };

    await expect(runMiddleware(middleware, socket)).resolves.toMatchObject({ message: "Unauthorized" });
    expect(jwtService.verifyAsync).not.toHaveBeenCalled();
    expect(socket.join).not.toHaveBeenCalled();
  });
});

describe("RealtimeGateway notification delivery", () => {
  it("emits notification.created only to the persisted recipient room", () => {
    const emit = vi.fn();
    const to = vi.fn(() => ({ emit }));
    const gateway = new RealtimeGateway({} as never, {} as never, {} as never);
    gateway.afterInit({ use: vi.fn(), to } as never);

    gateway.emitNotificationCreated({
      id: "notification-1",
      userId: "recipient-1",
      type: "message_received",
      message: "You received a new message.",
      isRead: false,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
    });

    expect(to).toHaveBeenCalledWith("user:recipient-1");
    expect(emit).toHaveBeenCalledWith("notification.created", {
      id: "notification-1",
      type: "message_received",
      message: "You received a new message.",
      isRead: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    });
  });

  it("does not emit broadcasts or notifications without a recipient", () => {
    const to = vi.fn();
    const gateway = new RealtimeGateway({} as never, {} as never, {} as never);
    gateway.afterInit({ use: vi.fn(), to } as never);

    gateway.emitNotificationCreated({
      id: "broadcast-1",
      userId: null,
      type: "announcement",
      message: "Announcement",
      isRead: false,
      createdAt: new Date(),
    });
    expect(to).not.toHaveBeenCalled();
  });
});
