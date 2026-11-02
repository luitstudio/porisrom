import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { describe, expect, it, vi, beforeEach } from "vitest";

import { ProfilePhotoStorageService } from "../src/profiles/profile-photo-storage.service";

const cloudinaryMocks = vi.hoisted(() => ({
  uploadStream: vi.fn(),
  destroy: vi.fn(),
}));

vi.mock("cloudinary", () => ({
  v2: {
    config: vi.fn(),
    uploader: { upload_stream: cloudinaryMocks.uploadStream, destroy: cloudinaryMocks.destroy },
  },
}));

function config(overrides: Record<string, string | undefined> = {}) {
  return {
    get: vi.fn((key: string) => overrides[key] ?? "configured"),
  } as unknown as ConfigService;
}

function imageFile(overrides: Partial<Express.Multer.File> = {}) {
  return {
    mimetype: "image/jpeg",
    size: 4,
    buffer: Buffer.from([0xff, 0xd8, 0xff, 0xdb]),
    ...overrides,
  } as Express.Multer.File;
}

const pngBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

describe("ProfilePhotoStorageService", () => {
  beforeEach(() => {
    cloudinaryMocks.uploadStream.mockReset();
    cloudinaryMocks.destroy.mockReset();
  });

  it("uploads public profile photos with deterministic Cloudinary IDs", async () => {
    cloudinaryMocks.uploadStream.mockImplementationOnce((options: Record<string, unknown>, callback: (error: null, result: object) => void) => ({
      end: () => callback(null, { public_id: options.public_id, type: "upload", resource_type: "image", secure_url: "https://res.cloudinary.com/demo/avatar.jpg" }),
    }));

    const service = new ProfilePhotoStorageService(config());
    const result = await service.uploadPublicPhoto("profiles/freelancers/user-1/avatar", imageFile());

    expect(result).toEqual({ url: "https://res.cloudinary.com/demo/avatar.jpg" });
    expect(cloudinaryMocks.uploadStream).toHaveBeenCalledWith(
      expect.objectContaining({
        resource_type: "image",
        type: "upload",
        public_id: "profiles/freelancers/user-1/avatar",
        overwrite: true,
        invalidate: true,
        unique_filename: false,
        use_filename: false,
      }),
      expect.any(Function),
    );
  });

  it("accepts valid image bytes even when the browser sends a nonstandard MIME type", async () => {
    cloudinaryMocks.uploadStream.mockImplementationOnce((options: Record<string, unknown>, callback: (error: null, result: object) => void) => ({
      end: () => callback(null, { public_id: options.public_id, type: "upload", resource_type: "image", secure_url: "https://res.cloudinary.com/demo/avatar.png" }),
    }));

    const service = new ProfilePhotoStorageService(config());
    const result = await service.uploadPublicPhoto(
      "profiles/freelancers/user-1/avatar",
      imageFile({ mimetype: "application/octet-stream", size: pngBytes.length, buffer: pngBytes }),
    );

    expect(result).toEqual({ url: "https://res.cloudinary.com/demo/avatar.png" });
  });

  it("rejects files that are not supported image uploads", async () => {
    const service = new ProfilePhotoStorageService(config());

    await expect(
      service.uploadPublicPhoto("profiles/freelancers/user-1/avatar", imageFile({ mimetype: "application/pdf", buffer: Buffer.from("%PDF-") })),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
  });

  it("falls back to local storage when Cloudinary upload times out", async () => {
    const uploadRoot = await mkdtemp(join(tmpdir(), "porisrom-profile-photo-"));
    cloudinaryMocks.uploadStream.mockImplementationOnce((_options: Record<string, unknown>, callback: (error: Error) => void) => ({
      end: () => callback(new Error("Request Timeout")),
    }));
    const service = new ProfilePhotoStorageService(config({
      BACKEND_PUBLIC_URL: "http://localhost:4000",
      PROFILE_PHOTO_UPLOAD_DIR: uploadRoot,
    }));

    try {
      const result = await service.uploadPublicPhoto("profiles/freelancers/user-1/avatar", imageFile());

      expect(result).toEqual({ url: "http://localhost:4000/uploads/profile-photos/profiles/freelancers/user-1/avatar.jpg" });
      await expect(readFile(join(uploadRoot, "profile-photos/profiles/freelancers/user-1/avatar.jpg"))).resolves.toEqual(imageFile().buffer);
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });

  it("uses local storage when Cloudinary credentials are missing", async () => {
    const uploadRoot = await mkdtemp(join(tmpdir(), "porisrom-profile-photo-"));
    const service = new ProfilePhotoStorageService(config({
      CLOUDINARY_API_SECRET: "",
      BACKEND_PUBLIC_URL: "http://localhost:4000",
      PROFILE_PHOTO_UPLOAD_DIR: uploadRoot,
    }));

    try {
      await expect(service.uploadPublicPhoto("profiles/freelancers/user-1/avatar", imageFile())).resolves.toEqual({
        url: "http://localhost:4000/uploads/profile-photos/profiles/freelancers/user-1/avatar.jpg",
      });
      expect(cloudinaryMocks.uploadStream).not.toHaveBeenCalled();
    } finally {
      await rm(uploadRoot, { recursive: true, force: true });
    }
  });
});
