import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { mkdir, rm, writeFile } from "fs/promises";
import { dirname, join } from "path";

import type { StorageMutationLease } from "../storage-maintenance/storage-mutation-coordinator.service";

const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

type UploadResult = { public_id?: string; secure_url?: string; type?: string; resource_type?: string };
type ImageFormat = { extension: "jpg" | "png" | "webp" };
export type StoredPublicPhoto = { url: string; storageId: string };

@Injectable()
export class ProfilePhotoStorageService {
  constructor(private readonly config: ConfigService) {}

  /** Internal only: caller must own the encompassing coordinator operation. */
  async storePublicPhoto(lease: StorageMutationLease, publicId: string, file: Express.Multer.File | undefined): Promise<StoredPublicPhoto> {
    const format = this.validateImage(file);
    if (this.configureCloudinaryIfAvailable()) {
      try {
        const upload = await this.upload(lease, file!, publicId);
        if (upload.type === "upload" && upload.resource_type === "image" && upload.public_id === publicId && upload.secure_url) {
          return { url: upload.secure_url, storageId: `cloudinary:${publicId}` };
        }
        await this.destroyCloudinary(lease, publicId).catch(() => undefined);
        throw new ServiceUnavailableException("Profile photo storage could not be verified");
      } catch (error) {
        if (error instanceof ServiceUnavailableException) throw error;
        // Local development can use a local fallback when the provider is unavailable.
      }
    }
    return this.storeLocally(lease, publicId, file!, format);
  }

  /** Compensating cleanup for an asset created by this service. */
  async removeStoredPublicPhoto(lease: StorageMutationLease, storageId: string) {
    if (storageId.startsWith("local:")) {
      await lease.assertNotFenced();
      const relativePath = storageId.slice("local:".length);
      const fullPath = this.resolveLocalPath(relativePath);
      await rm(fullPath, { force: true });
      return;
    }
    if (storageId.startsWith("cloudinary:")) {
      await this.destroyCloudinary(lease, storageId.slice("cloudinary:".length));
      return;
    }
    throw new ServiceUnavailableException("Profile photo storage identifier is invalid");
  }

  private configureCloudinaryIfAvailable() {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");
    if (!cloudName || !apiKey || !apiSecret) return false;
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    return true;
  }

  private validateImage(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("A profile photo is required");
    if (file.size > MAX_PROFILE_PHOTO_BYTES) throw new BadRequestException("Profile photo must be 2 MB or smaller");
    const format = this.detectImageFormat(file.buffer);
    if (!format) throw new BadRequestException("Selected file is not a valid JPG, PNG, or WebP image. Try downloading or exporting the original image again.");
    return format;
  }

  private detectImageFormat(buffer: Buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: "jpg" } as const;
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: "png" } as const;
    if (buffer.subarray(0, 4).equals(Buffer.from("RIFF")) && buffer.subarray(8, 12).equals(Buffer.from("WEBP"))) return { extension: "webp" } as const;
    return null;
  }

  private async storeLocally(lease: StorageMutationLease, publicId: string, file: Express.Multer.File, format: ImageFormat): Promise<StoredPublicPhoto> {
    const safePublicId = publicId.split("/").map(part => part.replace(/[^a-zA-Z0-9_-]/g, "-")).filter(Boolean).join("/");
    const relativePath = `profile-photos/${safePublicId}.${format.extension}`;
    const fullPath = this.resolveLocalPath(relativePath);
    await lease.assertNotFenced();
    await mkdir(dirname(fullPath), { recursive: true });
    await lease.assertNotFenced();
    await writeFile(fullPath, file.buffer, { flag: "wx" });
    const publicBaseUrl = this.config.get<string>("BACKEND_PUBLIC_URL")?.replace(/\/$/, "") || `http://localhost:${this.config.get<string>("PORT") || "4000"}`;
    return { url: `${publicBaseUrl}/uploads/${relativePath}`, storageId: `local:${relativePath}` };
  }

  private resolveLocalPath(relativePath: string) {
    if (!relativePath.startsWith("profile-photos/") || relativePath.includes("..") || relativePath.includes("\\")) {
      throw new ServiceUnavailableException("Profile photo storage identifier is invalid");
    }
    return join(this.config.get<string>("PROFILE_PHOTO_UPLOAD_DIR") || join(process.cwd(), "uploads"), relativePath);
  }

  private async destroyCloudinary(lease: StorageMutationLease, publicId: string) {
    await lease.assertNotFenced();
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "upload", invalidate: true });
  }

  private async upload(lease: StorageMutationLease, file: Express.Multer.File, publicId: string): Promise<UploadResult> {
    await lease.assertNotFenced();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({ resource_type: "image", type: "upload", public_id: publicId, overwrite: false, invalidate: true, unique_filename: false, use_filename: false, timeout: 120000 }, (error, result) => (error || !result ? reject(error ?? new Error("Cloudinary upload failed")) : resolve(result)));
      stream.end(file.buffer);
    });
  }
}
