import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { JwtService } from "@nestjs/jwt";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { OAuth2Client } from "google-auth-library";
import { describe, expect, it, vi, afterEach } from "vitest";

import { AuthService } from "../src/auth/auth.service";
import { GoogleAuthDto } from "../src/auth/dto/google-auth.dto";
import type { PrismaService } from "../src/prisma/prisma.service";

const activeUser = {
  id: "user-1", name: "Google User", email: "person@example.test", passwordHash: "hash",
  role: "client", status: "active", isOnboarded: false, profileCompleteness: 0,
  createdAt: new Date(), updatedAt: new Date(), termsAcceptedAt: null, termsVersion: null,
  privacyPolicyAcceptedAt: null, privacyPolicyVersion: null,
};

function harness() {
  const db = {
    user: { findUnique: vi.fn(), create: vi.fn() },
    externalIdentity: { findUnique: vi.fn(), create: vi.fn() },
    googleLinkIntent: { create: vi.fn(), updateMany: vi.fn() },
    authSession: { create: vi.fn().mockResolvedValue({}) },
  };
  const jwt = {
    sign: vi.fn(() => "signed-token"),
    verify: vi.fn(() => ({ purpose: "google-signup", role: "client", termsVersion: "2026-11-03", privacyPolicyVersion: "2026-11-03" })),
    decode: vi.fn(() => ({ exp: Math.floor(Date.now() / 1000) + 600 })),
  };
  const config = { getOrThrow: vi.fn((name: string) => name === "GOOGLE_CLIENT_ID" ? "google-client" : "jwt-secret"), get: vi.fn() };
  return { db, jwt, service: new AuthService({ db } as unknown as PrismaService, jwt as unknown as JwtService, config as unknown as ConfigService) };
}

function verifiedTicket(overrides: Record<string, unknown> = {}) {
  return { getPayload: () => ({ sub: "google-subject", email: "person@example.test", email_verified: true, iss: "https://accounts.google.com", ...overrides }) };
}

describe("Google authentication exchange", () => {
  afterEach(() => vi.restoreAllMocks());

  it("accepts an omitted signup intent but rejects a non-string supplied value", async () => {
    const omitted = plainToInstance(GoogleAuthDto, { idToken: "test-token" });
    const invalid = plainToInstance(GoogleAuthDto, { idToken: "test-token", signupIntent: 1 });

    await expect(validate(omitted)).resolves.toHaveLength(0);
    await expect(validate(invalid)).resolves.toEqual(expect.arrayContaining([
      expect.objectContaining({ property: "signupIntent" }),
    ]));
  });

  it("creates a Google signup with durable identity, consent, and ordinary backend tokens", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.externalIdentity.findUnique.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue(null);
    db.user.create.mockImplementation(async ({ data }: { data: typeof activeUser }) => ({ ...activeUser, ...data }));

    const result = await service.googleAuthenticate({ idToken: "test-token", signupIntent: "intent" });

    expect(result.accessToken).toBe("signed-token");
    expect(db.user.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      passwordHash: expect.any(String), termsVersion: "2026-11-03", privacyPolicyVersion: "2026-11-03",
      externalIdentities: expect.objectContaining({ create: expect.objectContaining({ provider: "google", providerSubject: "google-subject" }) }),
    }) }));
  });

  it("rejects an invalid Google token before looking up or issuing a session", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockRejectedValue(new Error("invalid"));
    await expect(service.googleAuthenticate({ idToken: "bad" })).rejects.toBeInstanceOf(UnauthorizedException);
    expect(db.externalIdentity.findUnique).not.toHaveBeenCalled();
  });

  it("requires explicit linking rather than joining a password account by email", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.externalIdentity.findUnique.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue(activeUser);
    await expect(service.googleAuthenticate({ idToken: "test-token" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects a missing or replay-invalid signup intent without creating an account", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.externalIdentity.findUnique.mockResolvedValue(null);
    db.user.findUnique.mockResolvedValue(null);
    await expect(service.googleAuthenticate({ idToken: "test-token" })).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.user.create).not.toHaveBeenCalled();
  });

  it("links only an explicitly authenticated matching-email account", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.user.findUnique.mockResolvedValue(activeUser);
    db.externalIdentity.findUnique.mockResolvedValue(null);
    db.externalIdentity.create.mockResolvedValue({});
    await expect(service.linkGoogleIdentity(activeUser.id, { idToken: "test-token" })).resolves.toEqual({ linked: true });
    expect(db.externalIdentity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: activeUser.id, providerSubject: "google-subject" }) }));
  });

  it("keeps linking idempotent when that Google identity already belongs to the authenticated user", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.user.findUnique.mockResolvedValue(activeUser);
    db.externalIdentity.findUnique.mockResolvedValue({ userId: activeUser.id });
    await expect(service.linkGoogleIdentity(activeUser.id, { idToken: "test-token" })).resolves.toEqual({ linked: true });
    expect(db.externalIdentity.create).not.toHaveBeenCalled();
  });

  it("rejects linking an identity already owned by another user or a mismatched Google email", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.user.findUnique.mockResolvedValue(activeUser);
    db.externalIdentity.findUnique.mockResolvedValue({ userId: "another-user" });
    await expect(service.linkGoogleIdentity(activeUser.id, { idToken: "test-token" })).rejects.toBeInstanceOf(ConflictException);

    db.externalIdentity.findUnique.mockResolvedValue(null);
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket({ email: "different@example.test" }) as never);
    await expect(service.linkGoogleIdentity(activeUser.id, { idToken: "test-token" })).rejects.toBeInstanceOf(ConflictException);
  });

  it("rejects Google linking for an inactive account or an invalid Google identity", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.user.findUnique.mockResolvedValue({ ...activeUser, status: "blocked" });
    await expect(service.linkGoogleIdentity(activeUser.id, { idToken: "test-token" })).rejects.toBeInstanceOf(ForbiddenException);

    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockRejectedValue(new Error("invalid"));
    await expect(service.linkGoogleIdentity(activeUser.id, { idToken: "test-token" })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("creates a session-bound link intent and consumes it only once before linking", async () => {
    const { db, service } = harness();
    db.googleLinkIntent.create.mockResolvedValue({});
    const created = await service.createGoogleLinkIntent({ userId: activeUser.id, role: activeUser.role, sessionId: "session-1" });
    expect(created.nonce).toEqual(expect.any(String));
    expect(db.googleLinkIntent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: activeUser.id, sessionId: "session-1", expiresAt: expect.any(Date) }),
    }));

    db.googleLinkIntent.updateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    vi.spyOn(service, "linkGoogleIdentity").mockResolvedValue({ linked: true });
    await expect(service.linkGoogleIdentityWithIntent(
      { userId: activeUser.id, role: activeUser.role, sessionId: "session-1" },
      { idToken: "test-token", linkIntentNonce: created.nonce },
    )).resolves.toEqual({ linked: true });
    await expect(service.linkGoogleIdentityWithIntent(
      { userId: activeUser.id, role: activeUser.role, sessionId: "session-1" },
      { idToken: "test-token", linkIntentNonce: created.nonce },
    )).rejects.toBeInstanceOf(ForbiddenException);
    expect(db.googleLinkIntent.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ nonce: created.nonce, userId: activeUser.id, sessionId: "session-1", consumedAt: null }),
    }));
  });

  it("does not issue a session for a disabled linked account", async () => {
    const { db, service } = harness();
    vi.spyOn(OAuth2Client.prototype, "verifyIdToken").mockResolvedValue(verifiedTicket() as never);
    db.externalIdentity.findUnique.mockResolvedValue({ user: { ...activeUser, status: "blocked" } });
    await expect(service.googleAuthenticate({ idToken: "test-token" })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
