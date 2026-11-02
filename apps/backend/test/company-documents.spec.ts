import { BadRequestException, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompanyDocumentService } from "../src/profiles/company-document.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const pdf = Buffer.from("%PDF-1.4\nclient document\n%%EOF");

function file(overrides: Partial<Express.Multer.File> = {}): Express.Multer.File {
  const buffer = overrides.buffer ?? pdf;
  return {
    fieldname: "certificate",
    originalname: "document.pdf",
    encoding: "7bit",
    mimetype: "application/pdf",
    size: buffer.length,
    buffer,
    destination: "",
    filename: "",
    path: "",
    stream: undefined as never,
    ...overrides,
  };
}

function config(uploadDir: string) {
  return {
    get: vi.fn((key: string) => {
      if (key === "KYC_LOCAL_FALLBACK_ENABLED") return "true";
      if (key === "KYC_DOCUMENT_UPLOAD_DIR") return uploadDir;
      if (key === "PRIVATE_DOCUMENT_UPLOAD_DIR") return uploadDir;
      if (key === "NODE_ENV") return "test";
      return undefined;
    }),
  } as unknown as ConfigService;
}

function prismaHarness() {
  const documents: {
    id: string;
    companyProfileId: string;
    type: "company_certificate" | "aadhaar";
    uploadStatus: "uploaded";
    storagePublicId: string;
    storageAssetId: string;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];
  let sequence = 0;
  const profile = { id: "company-profile-1" };

  const companyDocument = {
    findMany: vi.fn(({ where }: { where: { companyProfileId: string; type?: { in: string[] } } }) =>
      Promise.resolve(documents.filter((document) =>
        document.companyProfileId === where.companyProfileId &&
        (!where.type?.in || where.type.in.includes(document.type)),
      )),
    ),
    deleteMany: vi.fn(({ where }: { where: { companyProfileId: string; type: { in: string[] } } }) => {
      for (let index = documents.length - 1; index >= 0; index -= 1) {
        if (documents[index].companyProfileId === where.companyProfileId && where.type.in.includes(documents[index].type)) {
          documents.splice(index, 1);
        }
      }
      return Promise.resolve({ count: 1 });
    }),
    createMany: vi.fn(({ data }: { data: { companyProfileId: string; type: "company_certificate" | "aadhaar"; storagePublicId: string; storageAssetId: string }[] }) => {
      for (const item of data) {
        sequence += 1;
        documents.push({
          id: `document-${sequence}`,
          companyProfileId: item.companyProfileId,
          type: item.type,
          uploadStatus: "uploaded",
          storagePublicId: item.storagePublicId,
          storageAssetId: item.storageAssetId,
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
        });
      }
      return Promise.resolve({ count: data.length });
    }),
    findFirst: vi.fn(({ where }: { where: { id: string; companyProfile: { userId: string } } }) => {
      if (where.companyProfile.userId !== "client-1" && where.companyProfile.userId !== "admin-target") return Promise.resolve(null);
      const document = documents.find((item) => item.id === where.id);
      return Promise.resolve(document ? { storagePublicId: document.storagePublicId } : null);
    }),
  };
  const companyProfile = {
    findUnique: vi.fn(({ where, select }: { where: { userId: string }; select: { documents?: object } }) => {
      if (where.userId !== "client-1" && where.userId !== "admin-target") return Promise.resolve(null);
      if (select.documents) {
        return Promise.resolve({
          documents: documents
            .filter((document) => document.companyProfileId === profile.id)
            .map((document) => ({
              id: document.id,
              type: document.type,
              uploadStatus: document.uploadStatus,
              createdAt: document.createdAt,
              updatedAt: document.updatedAt,
            })),
        });
      }
      return Promise.resolve(profile);
    }),
  };
  const db = {
    companyProfile,
    companyDocument,
    $transaction: vi.fn((callback: (tx: { companyDocument: typeof companyDocument }) => unknown) => callback({ companyDocument })),
  };
  return { db, documents };
}

describe("company document uploads", () => {
  let uploadDir: string;

  afterEach(async () => {
    if (uploadDir) await rm(uploadDir, { recursive: true, force: true });
  });

  async function serviceHarness() {
    uploadDir = await mkdtemp(join(tmpdir(), "porisrom-company-documents-"));
    const { db, documents } = prismaHarness();
    const service = new CompanyDocumentService(
      { db } as unknown as PrismaService,
      config(uploadDir),
    );
    return { db, documents, service };
  }

  it("uploads certificate and aadhaar PDFs as private persisted company documents", async () => {
    const { documents, service } = await serviceHarness();

    const result = await service.uploadForClient("client-1", {
      certificate: [file({ fieldname: "certificate" })],
      aadhaar: [file({ fieldname: "aadhaar" })],
    });

    expect(result.documents).toHaveLength(2);
    expect(result.documents.map((document) => document.type).sort()).toEqual(["aadhaar", "company_certificate"]);
    expect(documents).toHaveLength(2);
    expect(documents.every((document) => document.storagePublicId.startsWith("private-local:company-documents/client-1/"))).toBe(true);
    const stored = await readFile(join(uploadDir, documents[0].storagePublicId.replace("private-local:", "")));
    expect(stored.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("rejects invalid file types and oversized PDFs", async () => {
    const { service } = await serviceHarness();

    await expect(service.uploadForClient("client-1", {
      certificate: [file({ mimetype: "text/plain", buffer: Buffer.from("not a pdf"), size: 9 })],
    })).rejects.toBeInstanceOf(BadRequestException);

    await expect(service.uploadForClient("client-1", {
      certificate: [file({ size: 1024 * 1024 + 1 })],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it("allows owner and admin document retrieval but denies other users", async () => {
    const { service } = await serviceHarness();
    const result = await service.uploadForClient("client-1", { certificate: [file()] });
    const documentId = result.documents[0].id;

    await expect(service.fileForOwner("client-1", documentId)).resolves.toMatchObject({ kind: "local" });
    await expect(service.fileForAdmin("admin-target", documentId)).resolves.toMatchObject({ kind: "local" });
    await expect(service.fileForOwner("other-client", documentId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("replaces documents of the uploaded type without removing unrelated types", async () => {
    const { documents, service } = await serviceHarness();
    await service.uploadForClient("client-1", {
      certificate: [file({ buffer: Buffer.from("%PDF-1.4\ncertificate-one\n%%EOF") })],
      aadhaar: [file({ buffer: Buffer.from("%PDF-1.4\naadhaar-one\n%%EOF") })],
    });
    const aadhaarId = documents.find((document) => document.type === "aadhaar")?.id;

    const replaced = await service.uploadForClient("client-1", {
      certificate: [file({ buffer: Buffer.from("%PDF-1.4\ncertificate-two\n%%EOF") })],
    });

    expect(replaced.documents).toHaveLength(2);
    expect(documents.find((document) => document.type === "aadhaar")?.id).toBe(aadhaarId);
    expect(documents.filter((document) => document.type === "company_certificate")).toHaveLength(1);
  });

  it("denies manipulated local storage paths", async () => {
    const { documents, service } = await serviceHarness();
    documents.push({
      id: "bad-document",
      companyProfileId: "company-profile-1",
      type: "aadhaar",
      uploadStatus: "uploaded",
      storagePublicId: "local:../secret.pdf",
      storageAssetId: "local:bad",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await expect(service.fileForOwner("client-1", "bad-document")).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
