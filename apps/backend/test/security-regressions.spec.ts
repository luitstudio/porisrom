import { BadRequestException, ForbiddenException, NotFoundException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import type { PaymentVerification } from "@porisrom/database";
import { describe, expect, it, vi } from "vitest";

import { AdminService } from "../src/admin/admin.service";
import { JwtStrategy } from "../src/auth/strategies/jwt.strategy";
import { ConnectionsService } from "../src/connections/connections.service";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { CompanyProfileController } from "../src/profiles/company-profile.controller";
import { CompanyProfileService } from "../src/profiles/company-profile.service";
import { FreelancerProfileController } from "../src/profiles/freelancer-profile.controller";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";
import type { PrismaService } from "../src/prisma/prisma.service";
import { WorkAssignmentsService } from "../src/work-assignments/work-assignments.service";

function prismaService(db: object) {
  return { db } as unknown as PrismaService;
}

const profilePhotos = { uploadPublicPhoto: vi.fn() };

describe("security regressions", () => {
  it.each([
    ["setBlocked", { status: "blocked" }],
    ["softDeleteUser", { status: "deleted" }],
  ] as const)("admin %s excludes passwordHash", async (method, response) => {
    const update = vi.fn().mockResolvedValue({ id: "user-1", ...response });
    const service = new AdminService(
      prismaService({
        $transaction: (fn: (tx: object) => unknown) => fn({
          $queryRaw: vi.fn(), adminActionLog: { create: vi.fn() },
          user: { findUnique: vi.fn(async ({ where }) => where.id === "moderator" ? { role: "admin", status: "active" } : { id: "user-1", status: "active" }), update },
          authSession: { updateMany: vi.fn() }, connection: { findMany: vi.fn().mockResolvedValue([]) },
        }),
        user: { findUnique: vi.fn(async ({ where }) => where.id === "moderator" ? { role: "admin", status: "active" } : { id: "user-1", status: "active" }), update },
      }),
    );

    const result =
      method === "setBlocked"
        ? await service.setBlocked("user-1", true, "moderator")
        : await service.softDeleteUser("user-1", "moderator");

    expect(update.mock.calls[0]?.[0].select).toBeDefined();
    expect(update.mock.calls[0]?.[0].select.passwordHash).toBeUndefined();
    expect(result).not.toHaveProperty("passwordHash");
  });

  it.each(["blocked", "deleted"])("rejects an existing JWT for a %s user", async (status) => {
    const strategy = new JwtStrategy(
      { getOrThrow: vi.fn().mockReturnValue("test-secret") } as unknown as ConfigService,
      prismaService({
        user: { findUnique: vi.fn().mockResolvedValue({ id: "user-1", role: "client", status }) },
        authSession: { findUnique: vi.fn().mockResolvedValue({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), revokedAt: null }) },
      }),
    );

    await expect(strategy.validate({ sub: "user-1", sid: "session-1", role: "freelancer" })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it("uses the current database role for an active JWT user", async () => {
    const strategy = new JwtStrategy(
      { getOrThrow: vi.fn().mockReturnValue("test-secret") } as unknown as ConfigService,
      prismaService({
        user: {
          findUnique: vi.fn().mockResolvedValue({ id: "user-1", role: "client", status: "active" }),
        },
        authSession: { findUnique: vi.fn().mockResolvedValue({ userId: "user-1", expiresAt: new Date(Date.now() + 60000), revokedAt: null }) },
      }),
    );

    await expect(strategy.validate({ sub: "user-1", sid: "session-1", role: "freelancer" })).resolves.toEqual({
      userId: "user-1",
      role: "client",
      sessionId: "session-1",
    });
  });

  it.each([
    [FreelancerProfileService, "freelancerProfile"],
    [CompanyProfileService, "companyProfile"],
  ] as const)("rejects non-approved public profiles via %s", async (Service, model) => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const service = new Service(prismaService({ [model]: { findFirst } }), profilePhotos as never);

    await expect(service.getPublicProfile("profile-1")).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "profile-1", verificationStatus: "approved", user: { role: model === "freelancerProfile" ? "freelancer" : "client", status: "active" } } }),
    );
  });

  it.each([
    [FreelancerProfileService, "freelancerProfile", "pending"],
    [FreelancerProfileService, "freelancerProfile", "rejected"],
    [CompanyProfileService, "companyProfile", "pending"],
    [CompanyProfileService, "companyProfile", "rejected"],
  ] as const)("returns a %s owner's %s profile", async (Service, model, verificationStatus) => {
    const findUnique = vi.fn().mockResolvedValue({
      id: "profile-1",
      verificationStatus,
      user: { id: "user-1", name: "Profile Owner", isOnboarded: true },
      categories: [],
      ...(model === "freelancerProfile" ? { skills: [], portfolioItems: [] } : {}),
    });
    const service = new Service(prismaService({ [model]: { findUnique } }), profilePhotos as never);

    const result = await service.getOwnProfile("user-1");

    expect(findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" }, select: expect.any(Object) }),
    );
    expect(findUnique.mock.calls[0]?.[0].where).not.toHaveProperty("verificationStatus");
    expect(findUnique.mock.calls[0]?.[0].select.user.select).not.toHaveProperty("passwordHash");
    expect(result).toMatchObject({
      id: "profile-1",
      verificationStatus,
      isOnboarded: true,
      user: { id: "user-1", name: "Profile Owner" },
    });
    expect(result).not.toHaveProperty("passwordHash");
    expect(result.user).not.toHaveProperty("passwordHash");
  });

  it.each([
    [FreelancerProfileService, "freelancerProfile"],
    [CompanyProfileService, "companyProfile"],
  ] as const)("returns 404 when a %s owner profile does not exist", async (Service, model) => {
    const service = new Service(
      prismaService({ [model]: { findUnique: vi.fn().mockResolvedValue(null) } }),
      profilePhotos as never,
    );

    await expect(service.getOwnProfile("user-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([
    [FreelancerProfileController, "client"],
    [CompanyProfileController, "freelancer"],
  ] as const)("rejects the wrong role for %s.getOwn", (Controller, role) => {
    const guard = new RolesGuard(new Reflector());
    const context = {
      getHandler: () => Controller.prototype.getOwn,
      getClass: () => Controller,
      switchToHttp: () => ({ getRequest: () => ({ user: { role } }) }),
    };

    expect(() => guard.canActivate(context as never)).toThrow(ForbiddenException);
  });

  it.each([
    [{ id: "requester", role: "admin", status: "active" }, { id: "receiver", role: "client", status: "active" }, ForbiddenException],
    [{ id: "requester", role: "client", status: "blocked" }, { id: "receiver", role: "freelancer", status: "active" }, ForbiddenException],
    [{ id: "requester", role: "client", status: "active" }, { id: "receiver", role: "client", status: "active" }, BadRequestException],
    [{ id: "requester", role: "client", status: "active" }, { id: "receiver", role: "freelancer", status: "deleted" }, BadRequestException],
  ])("rejects invalid connection participants", async (requester, receiver, ErrorType) => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      user: { findUnique: vi.fn().mockResolvedValueOnce(requester).mockResolvedValueOnce(receiver) },
    };
    const service = new ConnectionsService(
      prismaService({ $transaction: (callback: (client: typeof tx) => unknown) => callback(tx) }),
    );

    await expect(service.create("requester", "receiver")).rejects.toBeInstanceOf(ErrorType);
  });

  it.each([
    ["client", "clientUtr", "freelancerUtr"],
    ["freelancer", "freelancerUtr", "clientUtr"],
  ] as const)("returns only the %s caller's UTR", async (party, ownKey, counterpartyKey) => {
    const payment: PaymentVerification = {
      id: "payment-1",
      workAssignmentId: "assignment-1",
      clientUtr: "client-secret",
      clientClaimedAt: new Date(),
      freelancerUtr: "freelancer-secret",
      freelancerClaimedAt: new Date(),
      mismatchCount: 0, mismatchCountAtReopen: 0,
      status: "awaiting_client",
      verifiedAt: null,
    };
    const userId = party === "client" ? "client-1" : "freelancer-1";
    const service = new WorkAssignmentsService(
      prismaService({
        workAssignment: {
          findUnique: vi.fn().mockResolvedValue({
            id: "assignment-1",
            createdById: "client-1",
            conversation: {
              connection: { requesterId: "client-1", receiverId: "freelancer-1" },
            },
          }),
        },
        paymentVerification: { findUnique: vi.fn().mockResolvedValue(payment) },
      }),
    );

    const result = await service.getPayment(userId, "assignment-1");
    expect(result).toHaveProperty(ownKey);
    expect(result).not.toHaveProperty(counterpartyKey);
  });
});
