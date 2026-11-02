import { ConfigService } from "@nestjs/config";
import { mkdir, mkdtemp, readFile, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { LocalDocumentStorage, localDocumentFallbackEnabled, validateDocumentStorageConfig, validateDocumentStoragePaths } from "../src/document-storage";
import { IdentityDocumentService } from "../src/kyc/identity-document.service";
import { CompanyDocumentService } from "../src/profiles/company-document.service";

describe("document storage configuration and path confinement", () => {
  let root: string;
  let config: Record<string, string>;
  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "porisrom-storage-config-"));
    config = { NODE_ENV: "test", PROFILE_PHOTO_UPLOAD_DIR: join(root, "uploads"), PRIVATE_DOCUMENT_UPLOAD_DIR: join(root, "private"), KYC_DOCUMENT_UPLOAD_DIR: join(root, "uploads") };
  });
  afterEach(async () => {
    // Test-owned allocation only. Windows directory links are removed as links by rm.
    if (root && resolve(root).startsWith(resolve(tmpdir()) + sep) && root.includes("porisrom-storage-config-")) {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("writes new PDFs outside public storage with distinct IDs and refuses overwrite", async () => {
    const storage = new LocalDocumentStorage(config, "kyc-documents");
    const bytes = Buffer.from("%PDF-1.7 synthetic");
    const id = await storage.write("kyc-documents/kyc/user-1/test.pdf", bytes);
    expect(id).toBe("private-local:kyc-documents/kyc/user-1/test.pdf");
    expect(await readFile(await storage.file(id))).toEqual(bytes);
    await expect(storage.write("kyc-documents/kyc/user-1/test.pdf", bytes)).rejects.toMatchObject({ code: "EEXIST" });
  });

  it.each([
    "private-local:kyc-documents/../test.pdf",
    "local:kyc-documents/%2e%2e/test.pdf",
    "local:kyc-documents/..\\test.pdf",
    "local:/kyc-documents/test.pdf",
    "local:C:/kyc-documents/test.pdf",
    "local:company-documents/user/test.pdf",
    "private-local:kyc-documents/user/file.pdf:stream",
    "private-local:kyc-documents/user//test.pdf",
  ])("rejects invalid paths and wrong namespaces: %s", async id => {
    await expect(new LocalDocumentStorage(config, "kyc-documents").file(id)).rejects.toMatchObject({ status: 503 });
  });

  it.each(["profile-photos", "public", "public/nested", ""]) (
    "rejects private/public root overlap: %s", suffix => {
      expect(() => validateDocumentStorageConfig({ ...config, PRIVATE_DOCUMENT_UPLOAD_DIR: join(root, "uploads", suffix) })).toThrow(/separate/);
    },
  );

  it("rejects a legacy root exposing documents beneath a public tree", () => {
    expect(() => validateDocumentStorageConfig({ ...config, KYC_DOCUMENT_UPLOAD_DIR: join(root, "uploads/profile-photos") })).toThrow(/separate/);
  });

  it("rejects physical root overlap through a junction even when a child is absent", async () => {
    await mkdir(join(root, "uploads/public"), { recursive: true });
    await symlink(join(root, "uploads/public"), join(root, "alias"), "junction");
    await expect(validateDocumentStoragePaths({ ...config, PRIVATE_DOCUMENT_UPLOAD_DIR: join(root, "alias/missing") })).rejects.toThrow(/separate/);
  });

  it("rejects document directory links escaping the private root", async () => {
    await mkdir(join(root, "private/kyc-documents"), { recursive: true });
    await mkdir(join(root, "outside"));
    await symlink(join(root, "outside"), join(root, "private/kyc-documents/escape"), "junction");
    const storage = new LocalDocumentStorage(config, "kyc-documents");
    await expect(storage.write("kyc-documents/escape/test.pdf", Buffer.from("%PDF-1.7"))).rejects.toMatchObject({ status: 503 });
    await expect(storage.file("private-local:kyc-documents/escape/test.pdf")).rejects.toMatchObject({ status: 503 });
  });

  it("fails safely on missing files", async () => {
    await expect(new LocalDocumentStorage(config, "company-documents").file("private-local:company-documents/user/missing.pdf")).rejects.toMatchObject({ status: 404 });
  });

  it("rejects explicit production fallback and disables fallback regardless of flag", () => {
    const production = { ...config, NODE_ENV: "production", KYC_LOCAL_FALLBACK_ENABLED: "true" };
    expect(() => validateDocumentStorageConfig(production)).toThrow(/disabled in production/);
    expect(localDocumentFallbackEnabled(production)).toBe(false);
    expect(() => validateDocumentStorageConfig({ ...production, KYC_LOCAL_FALLBACK_ENABLED: "false" })).not.toThrow();
    expect(localDocumentFallbackEnabled({ ...config, KYC_LOCAL_FALLBACK_ENABLED: "false" })).toBe(false);
  });

  it("fails closed without production Cloudinary credentials for both document types", async () => {
    const settings = new ConfigService({ ...config, NODE_ENV: "production", KYC_LOCAL_FALLBACK_ENABLED: "true" });
    const prisma = { db: {
      freelancerProfile: { findUnique: async () => ({ id: "profile-1" }) },
      identityDocument: { findUnique: async () => null },
      companyProfile: { findUnique: async () => ({ id: "company-1" }) },
    } };
    const pdf = { size: 8, mimetype: "application/pdf", buffer: Buffer.from("%PDF-1.7") } as Express.Multer.File;
    await expect(new IdentityDocumentService(prisma as never, settings).uploadForFreelancer("user-1", pdf)).rejects.toMatchObject({ status: 503 });
    await expect(new CompanyDocumentService(prisma as never, settings).uploadForClient("user-1", { certificate: [pdf] })).rejects.toMatchObject({ status: 503 });
  });
});
