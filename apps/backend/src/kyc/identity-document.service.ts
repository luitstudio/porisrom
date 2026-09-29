import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "crypto";

import { PrismaService } from "../prisma/prisma.service";

const MAX_DOCUMENT_BYTES = 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 5 * 60;

type UploadResult = { public_id?: string; asset_id?: string; type?: string; resource_type?: string };

@Injectable()
export class IdentityDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private configuredClient() {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException("Identity document uploads are not configured");
    }
    return cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  private validatePdf(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("An identity document PDF is required");
    if (file.size > MAX_DOCUMENT_BYTES) throw new BadRequestException("Identity document must be 1 MB or smaller");
    if (file.mimetype !== "application/pdf" || !file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new BadRequestException("Identity document must be a PDF");
    }
  }

  private uploadPdf(file: Express.Multer.File, publicId: string): Promise<UploadResult> {
    this.configuredClient();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          resource_type: "image",
          type: "authenticated",
          public_id: publicId,
          overwrite: false,
          unique_filename: false,
          use_filename: false,
          format: "pdf",
        },
        (error, result) => (error || !result ? reject(error ?? new Error("Cloudinary upload failed")) : resolve(result)),
      );
      stream.end(file.buffer);
    });
  }

  async uploadForFreelancer(userId: string, file: Express.Multer.File | undefined) {
    this.validatePdf(file);
    const profile = await this.prisma.db.freelancerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException("Complete your freelancer profile before submitting an identity document");

    const existing = await this.prisma.db.identityDocument.findUnique({ where: { freelancerProfileId: profile.id } });
    if (existing && existing.status !== "rejected") {
      throw new ConflictException("An identity document is already awaiting review or has been reviewed");
    }

    const publicId = `kyc/${userId}/${randomUUID()}`;
    let upload: UploadResult;
    try {
      upload = await this.uploadPdf(file!, publicId);
    } catch {
      throw new ServiceUnavailableException("Identity document upload failed. Please try again.");
    }
    if (upload.type !== "authenticated" || upload.resource_type !== "image" || upload.public_id !== publicId || !upload.asset_id) {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true }).catch(() => undefined);
      throw new ServiceUnavailableException("Identity document storage could not be secured");
    }

    try {
      await this.prisma.db.identityDocument.upsert({
        where: { freelancerProfileId: profile.id },
        create: { freelancerProfileId: profile.id, cloudinaryPublicId: publicId, cloudinaryAssetId: upload.asset_id },
        update: { cloudinaryPublicId: publicId, cloudinaryAssetId: upload.asset_id, status: "pending", reviewedAt: null, reviewedBy: null },
      });
    } catch (error) {
      await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true }).catch(() => undefined);
      throw error;
    }
    return { status: "pending" as const };
  }

  async reviewForAdmin(adminId: string, userId: string, status: "approved" | "rejected") {
    const document = await this.documentForFreelancerUser(userId);
    return this.prisma.db.identityDocument.update({
      where: { id: document.id },
      data: { status, reviewedAt: new Date(), reviewedBy: adminId },
      select: { status: true, reviewedAt: true },
    });
  }

  async signedUrlForAdmin(userId: string) {
    const document = await this.documentForFreelancerUser(userId);
    this.configuredClient();
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    const url = cloudinary.utils.private_download_url(document.cloudinaryPublicId, "pdf", {
      resource_type: "image",
      type: "authenticated",
      expires_at: expiresAt,
      attachment: false,
    });
    return { url, expiresAt, status: document.status };
  }

  private async documentForFreelancerUser(userId: string) {
    const document = await this.prisma.db.identityDocument.findFirst({
      where: { freelancerProfile: { userId } },
      select: { id: true, status: true, cloudinaryPublicId: true },
    });
    if (!document) throw new NotFoundException("Identity document not found");
    return document;
  }
}
