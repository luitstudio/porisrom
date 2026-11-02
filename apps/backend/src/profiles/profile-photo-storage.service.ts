import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { mkdir, writeFile } from "fs/promises";
import { dirname, join } from "path";

const MAX_PROFILE_PHOTO_BYTES = 2 * 1024 * 1024;

type UploadResult = {
  public_id?: string;
  secure_url?: string;
  type?: string;
  resource_type?: string;
};

type ImageFormat = { extension: "jpg" | "png" | "webp" };

@Injectable()
export class ProfilePhotoStorageService {
  constructor(private readonly config: ConfigService) {}

  async uploadPublicPhoto(publicId: string, file: Express.Multer.File | undefined) {
    const format = this.validateImage(file);

    if (this.configureCloudinaryIfAvailable()) {
      try {
        const upload = await this.upload(file!, publicId);
        if (
          upload.type === "upload" &&
          upload.resource_type === "image" &&
          upload.public_id === publicId &&
          upload.secure_url
        ) {
          return { url: upload.secure_url };
        }
        await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "upload", invalidate: true }).catch(() => undefined);
      } catch {
        // Local development should not be blocked by intermittent Cloudinary timeouts.
      }
    }

    return this.storeLocally(publicId, file!, format);
  }

  private configureCloudinaryIfAvailable() {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");
    if (!cloudName || !apiKey || !apiSecret) {
      return false;
    }
    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
    return true;
  }

  private validateImage(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("A profile photo is required");
    if (file.size > MAX_PROFILE_PHOTO_BYTES) throw new BadRequestException("Profile photo must be 2 MB or smaller");
    const format = this.detectImageFormat(file.buffer);
    if (!format) {
      throw new BadRequestException("Selected file is not a valid JPG, PNG, or WebP image. Try downloading or exporting the original image again.");
    }
    return format;
  }

  private detectImageFormat(buffer: Buffer) {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { extension: "jpg" } as const;
    if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return { extension: "png" } as const;
    if (buffer.subarray(0, 4).equals(Buffer.from("RIFF")) && buffer.subarray(8, 12).equals(Buffer.from("WEBP"))) return { extension: "webp" } as const;
    return null;
  }

  private async storeLocally(publicId: string, file: Express.Multer.File, format: ImageFormat) {
    const safePublicId = publicId
      .split("/")
      .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, "-"))
      .filter(Boolean)
      .join("/");
    const relativePath = `profile-photos/${safePublicId}.${format.extension}`;
    const uploadRoot = this.config.get<string>("PROFILE_PHOTO_UPLOAD_DIR") || join(process.cwd(), "uploads");
    const fullPath = join(uploadRoot, relativePath);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.buffer);

    const publicBaseUrl =
      this.config.get<string>("BACKEND_PUBLIC_URL")?.replace(/\/$/, "") ||
      `http://localhost:${this.config.get<string>("PORT") || "4000"}`;
    return { url: `${publicBaseUrl}/uploads/${relativePath}` };
  }

  private upload(file: Express.Multer.File, publicId: string): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          type: "upload",
          public_id: publicId,
          overwrite: true,
          invalidate: true,
          unique_filename: false,
          use_filename: false,
          timeout: 120000,
        },
        (error, result) => (error || !result ? reject(error ?? new Error("Cloudinary upload failed")) : resolve(result)),
      );
      stream.end(file.buffer);
    });
  }
}
