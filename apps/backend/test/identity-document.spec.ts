import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

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

function service(db: object, configured = true) {
  const config = { get: vi.fn((key: string) => configured ? `value-for-${key}` : undefined) };
  return new IdentityDocumentService({ db } as unknown as PrismaService, config as never);
}

describe("identity document upload security", () => {
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

  it("creates a short-lived signed URL only for an existing freelancer document", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "doc-1", status: "pending", cloudinaryPublicId: "kyc/freelancer-1/random" });
    const result = await service({ identityDocument: { findFirst } }).signedUrlForAdmin("freelancer-1");
    expect(result).toMatchObject({ url: expect.stringContaining("cloudinary.com"), status: "pending" });
    expect(cloudinaryMocks.signedUrl).toHaveBeenCalledWith(expect.stringMatching(/^kyc\/freelancer-1\//), "pdf", expect.objectContaining({ type: "authenticated", expires_at: expect.any(Number) }));
    expect(findFirst.mock.calls[0]?.[0].select).not.toHaveProperty("cloudinaryAssetId");
  });

  it("does not resolve a document outside the freelancer owner relation", async () => {
    await expect(service({ identityDocument: { findFirst: vi.fn().mockResolvedValue(null) } }).signedUrlForAdmin("other-user"))
      .rejects.toBeInstanceOf(NotFoundException);
  });
});
