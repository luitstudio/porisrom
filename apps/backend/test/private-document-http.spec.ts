import "reflect-metadata";
import { type INestApplication, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory, Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { get } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { AdminController } from "../src/admin/admin.controller";
import { AdminService } from "../src/admin/admin.service";
import { AdminActionLogInterceptor } from "../src/admin/interceptors/admin-action-log.interceptor";
import { RolesGuard } from "../src/auth/guards/roles.guard";
import { JwtStrategy } from "../src/auth/strategies/jwt.strategy";
import { LocalDocumentStorage } from "../src/document-storage";
import { IdentityDocumentService } from "../src/kyc/identity-document.service";
import { PrismaService } from "../src/prisma/prisma.service";
import { CompanyDocumentService } from "../src/profiles/company-document.service";
import { CompanyProfileController } from "../src/profiles/company-profile.controller";
import { CompanyProfileService } from "../src/profiles/company-profile.service";
import { FreelancerProfileController } from "../src/profiles/freelancer-profile.controller";
import { FreelancerProfileService } from "../src/profiles/freelancer-profile.service";
import { registerPublicUploads } from "../src/static-uploads";

// Real Nest routes, JWT signature verification, roles guards, document services and filesystem.
// Only database lookups are in-memory; this suite never connects to a user's database.
describe("protected private document HTTP workflows", () => {
  let app: INestApplication;
  let root: string;
  let port: number;
  const pdf = Buffer.from("%PDF-1.7 synthetic HTTP document\n%%EOF");
  const jwt = new JwtService({ secret: "synthetic-http-document-test-secret" });
  const users = new Map([
    ["freelancer-1", "freelancer"], ["freelancer-2", "freelancer"],
    ["client-1", "client"], ["client-2", "client"], ["admin-1", "admin"],
  ]);
  const identities = new Map<string, string>();
  const companies = new Map<string, { userId: string; storagePublicId: string }>();

  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "porisrom-document-http-"));
    const settings = {
      NODE_ENV: "test", KYC_LOCAL_FALLBACK_ENABLED: "true",
      PRIVATE_DOCUMENT_UPLOAD_DIR: join(root, "private"),
      KYC_DOCUMENT_UPLOAD_DIR: join(root, "uploads"),
      PROFILE_PHOTO_UPLOAD_DIR: join(root, "uploads"),
      JWT_ACCESS_SECRET: "synthetic-http-document-test-secret",
    };
    const config = new ConfigService(settings);
    identities.set("freelancer-1", await new LocalDocumentStorage(settings, "kyc-documents").write("kyc-documents/kyc/freelancer-1/new.pdf", pdf));
    companies.set("new-company", { userId: "client-1", storagePublicId: await new LocalDocumentStorage(settings, "company-documents").write("company-documents/client-1/aadhaar/new.pdf", pdf) });
    const legacyKyc = "kyc-documents/kyc/freelancer-2/legacy.pdf";
    const legacyCompany = "company-documents/client-2/company_certificate/legacy.pdf";
    for (const key of [legacyKyc, legacyCompany]) {
      const path = join(settings.KYC_DOCUMENT_UPLOAD_DIR, key);
      await mkdir(resolve(path, ".."), { recursive: true });
      await writeFile(path, pdf);
    }
    identities.set("freelancer-2", `local:${legacyKyc}`);
    companies.set("legacy-company", { userId: "client-2", storagePublicId: `local:${legacyCompany}` });
    companies.set("missing-company", { userId: "client-1", storagePublicId: "private-local:company-documents/client-1/missing.pdf" });
    companies.set("invalid-company", { userId: "client-1", storagePublicId: "local:../secret.pdf" });

    const prisma = { db: {
      authSession: { findUnique: async ({ where }: { where: { id: string } }) => users.has(where.id) ? { userId: where.id, expiresAt: new Date(Date.now() + 60000), revokedAt: null } : null },
      user: { findUnique: async ({ where }: { where: { id: string } }) => users.has(where.id) ? { id: where.id, role: users.get(where.id), status: "active" } : null },
      identityDocument: { findFirst: async ({ where }: { where: { freelancerProfile: { userId: string } } }) => {
        const id = identities.get(where.freelancerProfile.userId);
        return id ? { cloudinaryPublicId: id, status: "pending" } : null;
      } },
      companyDocument: { findFirst: async ({ where }: { where: { id: string; companyProfile: { userId: string } } }) => {
        const doc = companies.get(where.id);
        return doc?.userId === where.companyProfile.userId ? doc : null;
      } },
    } } as unknown as PrismaService;

    // Vitest/esbuild does not emit TypeScript constructor metadata. Supply only that
    // metadata; actual controller methods, route decorators and guards are unchanged.
    Reflect.defineMetadata("design:paramtypes", [FreelancerProfileService, IdentityDocumentService], FreelancerProfileController);
    Reflect.defineMetadata("design:paramtypes", [CompanyProfileService, CompanyDocumentService], CompanyProfileController);
    Reflect.defineMetadata("design:paramtypes", [AdminService, IdentityDocumentService, CompanyDocumentService], AdminController);
    Reflect.defineMetadata("design:paramtypes", [Reflector], RolesGuard);
    Reflect.defineMetadata("design:paramtypes", [Reflector, PrismaService], AdminActionLogInterceptor);
    @Module({
      controllers: [FreelancerProfileController, CompanyProfileController, AdminController],
      providers: [
        RolesGuard, AdminActionLogInterceptor,
        { provide: PrismaService, useValue: prisma },
        { provide: JwtStrategy, useFactory: () => new JwtStrategy(config, prisma) },
        { provide: IdentityDocumentService, useValue: new IdentityDocumentService(prisma, config) },
        { provide: CompanyDocumentService, useValue: new CompanyDocumentService(prisma, config) },
        { provide: FreelancerProfileService, useValue: {} },
        { provide: CompanyProfileService, useValue: {} },
        { provide: AdminService, useValue: {} },
      ],
    })
    class DocumentHttpModule {}
    app = await NestFactory.create(DocumentHttpModule, { logger: false });
    await registerPublicUploads(app, settings);
    await app.listen(0, "127.0.0.1");
    port = app.getHttpServer().address().port;
  });

  afterAll(async () => {
    if (app) await app.close();
    // Validate the allocated temporary target before recursive cleanup.
    if (root && resolve(root).startsWith(resolve(tmpdir()) + sep) && root.includes("porisrom-document-http-")) {
      await rm(root, { recursive: true, force: true });
    }
  });

  function request(path: string, user?: string, invalidToken = false) {
    return new Promise<{ status: number; body: Buffer; cache: string | undefined; type: string | undefined }>((resolveResult, reject) => {
      const token = invalidToken ? "invalid" : user ? jwt.sign({ sub: user, sid: user }, { expiresIn: "5m" }) : undefined;
      get({ hostname: "127.0.0.1", port, path, headers: token ? { Authorization: `Bearer ${token}` } : {} }, response => {
        const chunks: Buffer[] = [];
        response.on("data", chunk => chunks.push(chunk));
        response.once("end", () => resolveResult({ status: response.statusCode!, body: Buffer.concat(chunks), cache: response.headers["cache-control"], type: response.headers["content-type"] }));
      }).once("error", reject);
    });
  }

  it.each([
    ["/freelancers/me/identity-document/file", "freelancer-1", "identity", "fileForOwner"],
    ["/admin/users/freelancer-1/identity-document/file", "admin-1", "identity", "fileForAdmin"],
    ["/companies/me/documents/new-company/file", "client-1", "company", "fileForOwner"],
    ["/admin/users/client-1/company-documents/new-company/file", "admin-1", "company", "fileForAdmin"],
  ])("marks signed private redirects uncacheable: %s", async (path, user, kind, method) => {
    const service = kind === "identity" ? app.get(IdentityDocumentService) : app.get(CompanyDocumentService);
    const stub = vi.spyOn(service as any, method).mockResolvedValue({ kind: "redirect", url: "https://example.test/synthetic-private-signature" });
    try { const result = await request(path, user); expect(result.status).toBe(302); expect(result.cache).toBe("private, no-store"); }
    finally { stub.mockRestore(); }
  });

  it.each([
    ["/freelancers/me/identity-document/file", "freelancer-1"],
    ["/freelancers/me/identity-document/file", "freelancer-2"],
    ["/companies/me/documents/new-company/file", "client-1"],
    ["/companies/me/documents/legacy-company/file", "client-2"],
    ["/admin/users/freelancer-1/identity-document/file", "admin-1"],
    ["/admin/users/freelancer-2/identity-document/file", "admin-1"],
    ["/admin/users/client-1/company-documents/new-company/file", "admin-1"],
    ["/admin/users/client-2/company-documents/legacy-company/file", "admin-1"],
  ])("serves authorized new/legacy document %s to %s", async (path, user) => {
    const response = await request(path, user);
    expect(response.status).toBe(200);
    expect(response.body).toEqual(pdf);
    expect(response.cache).toBe("private, no-store");
    expect(response.type).toContain("application/pdf");
  });

  it.each([
    "/freelancers/me/identity-document/file", "/companies/me/documents/new-company/file",
    "/admin/users/freelancer-1/identity-document/file", "/admin/users/client-1/company-documents/new-company/file",
  ])("requires authentication for %s", async path => {
    expect((await request(path)).status).toBe(401);
    expect((await request(path, undefined, true)).status).toBe(401);
  });

  it("rejects wrong-role admin requests and other owners", async () => {
    expect((await request("/admin/users/freelancer-1/identity-document/file", "freelancer-1")).status).toBe(403);
    expect((await request("/admin/users/client-1/company-documents/new-company/file", "client-1")).status).toBe(403);
    expect((await request("/companies/me/documents/new-company/file", "client-2")).status).toBe(404);
    expect((await request("/admin/users/client-2/company-documents/new-company/file", "admin-1")).status).toBe(404);
    expect((await request("/freelancers/me/identity-document/file", "client-1")).status).toBe(403);
  });

  it("does not expose another freelancer's document via an owner-supplied target", async () => {
    identities.delete("freelancer-2");
    try {
      expect((await request("/freelancers/me/identity-document/file?userId=freelancer-1", "freelancer-2")).status).toBe(404);
    } finally {
      identities.set("freelancer-2", "local:kyc-documents/kyc/freelancer-2/legacy.pdf");
    }
  });

  it("fails safely for missing files and malformed stored paths", async () => {
    expect((await request("/companies/me/documents/missing-company/file", "client-1")).status).toBe(404);
    const invalid = await request("/companies/me/documents/invalid-company/file", "client-1");
    expect(invalid.status).toBe(503);
    expect(invalid.body.toString()).not.toContain(root);
    expect((await request("/admin/users/unknown/identity-document/file", "admin-1")).status).toBe(404);
  });

  it("leaves legacy metadata and bytes in place", async () => {
    expect(identities.get("freelancer-2")).toBe("local:kyc-documents/kyc/freelancer-2/legacy.pdf");
    expect(await readFile(await realpath(join(root, "uploads/kyc-documents/kyc/freelancer-2/legacy.pdf")))).toEqual(pdf);
    expect((await request("/uploads/%6byc-documents/kyc/freelancer-2/legacy.pdf")).status).toBe(404);
    expect((await request("/uploads/%63ompany-documents/client-2/company_certificate/legacy.pdf")).status).toBe(404);
  });
});
