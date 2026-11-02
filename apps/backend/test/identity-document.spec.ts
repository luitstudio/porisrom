import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { existsSync } from "fs";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IdentityDocumentService } from "../src/kyc/identity-document.service";
import type { PrismaService } from "../src/prisma/prisma.service";

const cloudinaryMocks = vi.hoisted(() => ({
  uploadStream: vi.fn(),
  destroy: vi.fn().mockResolvedValue({}),
  signedUrl: vi.fn(() => "https://res.cloudinary.com/example/authenticated/signed.pdf"),
}));

vi.mock("cloudinary", () => ({
  v2: { config: vi.fn(), uploader: { upload_stream: cloudinaryMocks.uploadStream, destroy: cloudinaryMocks.destroy }, utils: { private_download_url: cloudinaryMocks.signedUrl } },
}));

function file(overrides: Partial<Express.Multer.File> = {}) {
  return {
    size: 100,
    mimetype: "application/pdf",
    buffer: Buffer.from("%PDF-1.7 test"),
    ...overrides,
  } as Express.Multer.File;
}

function service(
  db: object,
  options: {
    configured?: boolean;
    localFallback?: boolean;
    uploadDir?: string;
    publicBaseUrl?: string;
  } = {},
) {
  const { configured = true, localFallback = false, uploadDir, publicBaseUrl = "http://localhost:4000" } = options;
  const config = {
    get: vi.fn((key: string) => {
      if (key === "KYC_LOCAL_FALLBACK_ENABLED") return localFallback ? "true" : "false";
      if (key === "KYC_DOCUMENT_UPLOAD_DIR") return uploadDir;
      if (key === "PRIVATE_DOCUMENT_UPLOAD_DIR") return uploadDir;
      if (key === "PROFILE_PHOTO_UPLOAD_DIR") return undefined;
      if (key === "BACKEND_PUBLIC_URL") return publicBaseUrl;
      if (key === "PORT") return "4000";
      if (key === "NODE_ENV") return "test";
      return configured && key.startsWith("CLOUDINARY_") ? `value-for-${key}` : undefined;
    }),
  };
  return new IdentityDocumentService({ db } as unknown as PrismaService, config as never);
}

describe("identity document upload security", () => {
  beforeEach(() => {
    cloudinaryMocks.uploadStream.mockReset();
    cloudinaryMocks.destroy.mockReset();
    cloudinaryMocks.destroy.mockResolvedValue({});
    cloudinaryMocks.signedUrl.mockClear();
  });

  it("rejects a non-PDF or a file larger than 1 MB before storage", async () => {
    const upload = vi.fn();
    const instance = service({ freelancerProfile: { findUnique: vi.fn() }, identityDocument: { findUnique: vi.fn(), upsert: upload } });
    await expect(instance.uploadForFreelancer("freelancer-1", file({ mimetype: "image/png" }))).rejects.toBeInstanceOf(BadRequestException);
    await expect(instance.uploadForFreelancer("freelancer-1", file({ size: 1024 * 1024 + 1 }))).rejects.toBeInstanceOf(BadRequestException);
    expect(upload).not.toHaveBeenCalled();
  });

  it("does not create KYC metadata when Cloudinary upload fails", async () => {
    cloudinaryMocks.uploadStream.mockImplementationOnce((_options: unknown, callback: (error: Error) => void) => ({ end: () => callback(new Error("upload failed")) }));
    const upsert = vi.fn();
    const instance = service({
      freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1" }) },
      identityDocument: { findUnique: vi.fn().mockResolvedValue(null), upsert },
    });
    await expect(instance.uploadForFreelancer("freelancer-1", file())).rejects.toMatchObject({ status: 503 });
    expect(upsert).not.toHaveBeenCalled();
  });

  it("falls back to local KYC storage when enabled for development", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "porisrom-kyc-"));
    try {
      cloudinaryMocks.uploadStream.mockImplementationOnce((_options: unknown, callback: (error: Error) => void) => ({
        end: () => callback(new Error("Request Timeout")),
      }));
      const upsert = vi.fn().mockResolvedValue({});
      const instance = service({
        freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1" }) },
        identityDocument: { findUnique: vi.fn().mockResolvedValue(null), upsert },
      }, { localFallback: true, uploadDir });

      await expect(instance.uploadForFreelancer("freelancer-1", file())).resolves.toEqual({ status: "pending" });

      const createData = upsert.mock.calls[0]?.[0].create as { cloudinaryPublicId: string; cloudinaryAssetId: string };
      expect(createData.cloudinaryPublicId).toMatch(/^private-local:kyc-documents\/kyc\/freelancer-1\//);
      expect(createData.cloudinaryAssetId).toMatch(/^local:/);
      const relativePath = createData.cloudinaryPublicId.replace(/^private-local:/, "");
      expect(existsSync(join(uploadDir, relativePath))).toBe(true);
    } finally {
      await rm(uploadDir, { recursive: true, force: true });
    }
  });

  it("uses a server-generated authenticated Cloudinary public ID and stores no filename", async () => {
    let options: Record<string, unknown> | undefined;
    cloudinaryMocks.uploadStream.mockImplementationOnce((value: Record<string, unknown>, callback: (error: null, result: object) => void) => {
      options = value;
      return { end: () => callback(null, { public_id: value.public_id, asset_id: "asset-1", type: "authenticated", resource_type: "image" }) };
    });
    const upsert = vi.fn().mockResolvedValue({});
    const instance = service({
      freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1" }) },
      identityDocument: { findUnique: vi.fn().mockResolvedValue(null), upsert },
    });
    await expect(instance.uploadForFreelancer("freelancer-1", file({ originalname: "1234-aadhaar.pdf" }))).resolves.toEqual({ status: "pending" });
    expect(options).toMatchObject({ type: "authenticated", resource_type: "image", overwrite: false, use_filename: false });
    expect(options?.public_id).toMatch(/^kyc\/freelancer-1\//);
    expect(options?.public_id).not.toContain("1234-aadhaar");
    expect(upsert.mock.calls[0]?.[0].create).not.toHaveProperty("originalname");
  });

  it("prevents another pending or reviewed document from being overwritten", async () => {
    const instance = service({
      freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1" }) },
      identityDocument: { findUnique: vi.fn().mockResolvedValue({ status: "pending" }) },
    });
    await expect(instance.uploadForFreelancer("freelancer-1", file())).rejects.toBeInstanceOf(ConflictException);
  });

  it("destroys the previous rejected Cloudinary asset after a secure replacement", async () => {
    cloudinaryMocks.uploadStream.mockImplementationOnce((value: Record<string, unknown>, callback: (error: null, result: object) => void) => ({
      end: () => callback(null, { public_id: value.public_id, asset_id: "asset-new", type: "authenticated", resource_type: "image" }),
    }));
    const upsert = vi.fn().mockResolvedValue({});
    const existing = {
      status: "rejected",
      cloudinaryPublicId: "kyc/freelancer-1/old",
      cloudinaryAssetId: "asset-old",
      reviewedAt: new Date("2026-01-01T00:00:00Z"),
      reviewedBy: "admin-1",
    };
    const instance = service({
      freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1" }) },
      identityDocument: { findUnique: vi.fn().mockResolvedValue(existing), upsert },
    });

    await expect(instance.uploadForFreelancer("freelancer-1", file())).resolves.toEqual({ status: "pending" });

    expect(upsert.mock.calls[0]?.[0].update).toEqual(
      expect.objectContaining({ status: "pending", reviewedAt: null, reviewedBy: null }),
    );
    expect(cloudinaryMocks.destroy).toHaveBeenCalledWith(
      "kyc/freelancer-1/old",
      expect.objectContaining({ resource_type: "image", type: "authenticated", invalidate: true }),
    );
  });

  it("fails closed and restores rejected metadata when previous asset cleanup fails", async () => {
    cloudinaryMocks.uploadStream.mockImplementationOnce((value: Record<string, unknown>, callback: (error: null, result: object) => void) => ({
      end: () => callback(null, { public_id: value.public_id, asset_id: "asset-new", type: "authenticated", resource_type: "image" }),
    }));
    cloudinaryMocks.destroy
      .mockRejectedValueOnce(new Error("delete failed"))
      .mockResolvedValueOnce({});
    const upsert = vi.fn().mockResolvedValue({});
    const update = vi.fn().mockResolvedValue({});
    const reviewedAt = new Date("2026-01-01T00:00:00Z");
    const existing = {
      status: "rejected",
      cloudinaryPublicId: "kyc/freelancer-1/old",
      cloudinaryAssetId: "asset-old",
      reviewedAt,
      reviewedBy: "admin-1",
    };
    const instance = service({
      freelancerProfile: { findUnique: vi.fn().mockResolvedValue({ id: "profile-1" }) },
      identityDocument: { findUnique: vi.fn().mockResolvedValue(existing), upsert, update },
    });

    await expect(instance.uploadForFreelancer("freelancer-1", file())).rejects.toMatchObject({ status: 503 });

    expect(cloudinaryMocks.destroy).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledWith({
      where: { freelancerProfileId: "profile-1" },
      data: {
        cloudinaryPublicId: "kyc/freelancer-1/old",
        cloudinaryAssetId: "asset-old",
        status: "rejected",
        reviewedAt,
        reviewedBy: "admin-1",
      },
    });
  });

  it("creates a short-lived signed URL only for an existing freelancer document", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "doc-1", status: "pending", cloudinaryPublicId: "kyc/freelancer-1/random" });
    const result = await service({ identityDocument: { findFirst } }).signedUrlForAdmin("freelancer-1");
    expect(result).toMatchObject({ url: expect.stringContaining("cloudinary.com"), status: "pending" });
    expect(cloudinaryMocks.signedUrl).toHaveBeenCalledWith(expect.stringMatching(/^kyc\/freelancer-1\//), "pdf", expect.objectContaining({ type: "authenticated", expires_at: expect.any(Number) }));
    expect(findFirst.mock.calls[0]?.[0].select).not.toHaveProperty("cloudinaryAssetId");
  });

  it("returns a local dev document URL without Cloudinary signing", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "doc-1",
      status: "pending",
      cloudinaryPublicId: "local:kyc-documents/kyc/freelancer-1/debug.pdf",
    });
    const result = await service({ identityDocument: { findFirst } }, { localFallback: true }).signedUrlForAdmin("freelancer-1");
    expect(result).toMatchObject({
      url: "http://localhost:4000/admin/users/freelancer-1/identity-document/file",
      status: "pending",
    });
    expect(cloudinaryMocks.signedUrl).not.toHaveBeenCalled();
  });

  it("resolves a local admin document file only from stored metadata", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "porisrom-kyc-"));
    try {
      const documentPath = join(uploadDir, "kyc-documents/kyc/freelancer-1/debug.pdf");
      await mkdir(join(uploadDir, "kyc-documents/kyc/freelancer-1"), { recursive: true });
      await writeFile(documentPath, Buffer.from("%PDF-1.7 local"));

      await expect(service({
        identityDocument: { findFirst: vi.fn().mockResolvedValue({ cloudinaryPublicId: "local:kyc-documents/kyc/freelancer-1/debug.pdf" }) },
      }, { localFallback: true, uploadDir }).fileForAdmin("freelancer-1")).resolves.toEqual({ kind: "local", path: await realpath(documentPath) });
    } finally {
      await rm(uploadDir, { recursive: true, force: true });
    }
  });

  it("rejects manipulated local document paths before reading the filesystem", async () => {
    await expect(service({
      identityDocument: { findFirst: vi.fn().mockResolvedValue({ cloudinaryPublicId: "local:../secret.pdf" }) },
    }, { localFallback: true }).fileForAdmin("freelancer-1")).rejects.toMatchObject({ status: 503 });
  });

  it("allows the freelancer owner path to resolve only that owner's document", async () => {
    const uploadDir = await mkdtemp(join(tmpdir(), "porisrom-kyc-"));
    try {
      const documentPath = join(uploadDir, "kyc-documents/kyc/freelancer-1/debug.pdf");
      await mkdir(join(uploadDir, "kyc-documents/kyc/freelancer-1"), { recursive: true });
      await writeFile(documentPath, Buffer.from("%PDF-1.7 local"));
      const findFirst = vi.fn().mockResolvedValue({ cloudinaryPublicId: "local:kyc-documents/kyc/freelancer-1/debug.pdf" });

      await expect(service({ identityDocument: { findFirst } }, { localFallback: true, uploadDir }).fileForOwner("freelancer-1"))
        .resolves.toEqual({ kind: "local", path: await realpath(documentPath) });
      expect(findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { freelancerProfile: { userId: "freelancer-1" } } }));
    } finally {
      await rm(uploadDir, { recursive: true, force: true });
    }
  });

  it("does not resolve a document outside the freelancer owner relation", async () => {
    await expect(service({ identityDocument: { findFirst: vi.fn().mockResolvedValue(null) } }).signedUrlForAdmin("other-user"))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
