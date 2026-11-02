import { auditedAdminMutation } from "../admin/audited-mutation";
import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "crypto";

import { PrismaService } from "../prisma/prisma.service";
import { isLocalDocumentId, LocalDocumentStorage, localDocumentFallbackEnabled, storageConfig } from "../document-storage";

const MAX_DOCUMENT_BYTES = 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 5 * 60;
const LOCAL_ASSET_ID_PREFIX = "local:";

type UploadResult = { public_id?: string; asset_id?: string; type?: string; resource_type?: string };
type StoredIdentityDocument = { publicId: string; assetId: string; storage: "cloudinary" | "local" };
export type IdentityDocumentFile =
  | { kind: "local"; path: string }
  | { kind: "redirect"; url: string };

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

  private uploadToCloudinary(file: Express.Multer.File, publicId: string): Promise<UploadResult> {
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
          timeout: 120000,
        },
        (error, result) => (error || !result ? reject(error ?? new Error("Cloudinary upload failed")) : resolve(result)),
      );
      stream.end(file.buffer);
    });
  }

  private async uploadPdf(file: Express.Multer.File, publicId: string): Promise<StoredIdentityDocument> {
    try {
      const upload = await this.uploadToCloudinary(file, publicId);
      if (upload.type !== "authenticated" || upload.resource_type !== "image" || upload.public_id !== publicId || !upload.asset_id) {
        await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true }).catch(() => undefined);
        throw new ServiceUnavailableException("Identity document storage could not be secured");
      }
      return { publicId, assetId: upload.asset_id, storage: "cloudinary" };
    } catch (error) {
      if (this.localFallbackEnabled()) {
        return this.storeLocally(publicId, file);
      }
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException(this.storageFailureMessage(error));
    }
  }

  private localFallbackEnabled() {
    return localDocumentFallbackEnabled(storageConfig(this.config));
  }

  private storageFailureMessage(error: unknown) {
    const message = error instanceof Error ? error.message : "";
    if (/timeout/i.test(message)) return "Identity document storage timed out. Please try again in a moment.";
    return "Identity document upload failed. Please try again.";
  }

  private localStorage() {
    return new LocalDocumentStorage(storageConfig(this.config), "kyc-documents");
  }

  private publicBaseUrl() {
    return (
      this.config.get<string>("BACKEND_PUBLIC_URL")?.replace(/\/$/, "") ||
      `http://localhost:${this.config.get<string>("PORT") || "4000"}`
    );
  }

  private async storeLocally(publicId: string, file: Express.Multer.File): Promise<StoredIdentityDocument> {
    const safePublicId = publicId
      .split("/")
      .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, "-"))
      .filter(Boolean)
      .join("/");
    const relativePath = `kyc-documents/${safePublicId}.pdf`;
    const storedId = await this.localStorage().write(relativePath, file.buffer);
    return {
      publicId: storedId,
      assetId: `${LOCAL_ASSET_ID_PREFIX}${randomUUID()}`,
      storage: "local",
    };
  }

  private isLocalPublicId(publicId: string) {
    return isLocalDocumentId(publicId);
  }

  private protectedLocalDocumentUrl(userId: string) {
    return `${this.publicBaseUrl()}/admin/users/${encodeURIComponent(userId)}/identity-document/file`;
  }

  private async destroyStoredDocument(publicId: string) {
    if (this.isLocalPublicId(publicId)) {
      await this.localStorage().remove(publicId).catch(() => undefined);
      return;
    }
    await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true });
  }

  async uploadForFreelancer(userId: string, file: Express.Multer.File | undefined) {
    this.validatePdf(file);
    const profile = await this.prisma.db.freelancerProfile.findUnique({ where: { userId }, select: { id: true } });
    if (!profile) throw new NotFoundException("Complete your freelancer profile before submitting an identity document");

    const existing = await this.prisma.db.identityDocument.findUnique({ where: { freelancerProfileId: profile.id } });
    if (existing && existing.status !== "rejected") {
      throw new ConflictException("An identity document is already awaiting review or has been reviewed");
    }
    const replacedDocument = existing?.status === "rejected" ? existing : null;

    const publicId = `kyc/${userId}/${randomUUID()}`;
    const upload = await this.uploadPdf(file!, publicId);

    try {
      await this.prisma.db.identityDocument.upsert({
        where: { freelancerProfileId: profile.id },
        create: { freelancerProfileId: profile.id, cloudinaryPublicId: upload.publicId, cloudinaryAssetId: upload.assetId },
        update: { cloudinaryPublicId: upload.publicId, cloudinaryAssetId: upload.assetId, status: "pending", reviewedAt: null, reviewedBy: null },
      });
    } catch (error) {
      await this.destroyStoredDocument(upload.publicId).catch(() => undefined);
      throw error;
    }

    if (replacedDocument && replacedDocument.cloudinaryPublicId !== upload.publicId) {
      try {
        await this.destroyStoredDocument(replacedDocument.cloudinaryPublicId);
      } catch {
        await this.destroyStoredDocument(upload.publicId).catch(() => undefined);
        await this.prisma.db.identityDocument.update({
          where: { freelancerProfileId: profile.id },
          data: {
            cloudinaryPublicId: replacedDocument.cloudinaryPublicId,
            cloudinaryAssetId: replacedDocument.cloudinaryAssetId,
            status: "rejected",
            reviewedAt: replacedDocument.reviewedAt,
            reviewedBy: replacedDocument.reviewedBy,
          },
        }).catch(() => undefined);
        throw new ServiceUnavailableException("Previous identity document could not be replaced securely. Please try again.");
      }
    }
    return { status: "pending" as const };
  }

  async reviewForAdmin(adminId: string, userId: string, status: "approved" | "rejected") {
    return auditedAdminMutation(this.prisma.db, adminId, "review_identity_document", userId, { status }, async (tx) => {
      const document = await tx.identityDocument.findFirst({ where: { freelancerProfile: { userId } }, select: { id: true } });
      if (!document) throw new NotFoundException("Identity document not found");
      return tx.identityDocument.update({ where: { id: document.id }, data: { status, reviewedAt: new Date(), reviewedBy: adminId },
        select: { status: true, reviewedAt: true } });
    });
  }

  async signedUrlForAdmin(userId: string) {
    const document = await this.documentForFreelancerUser(userId);
    const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
    if (this.isLocalPublicId(document.cloudinaryPublicId)) {
      return { url: this.protectedLocalDocumentUrl(userId), expiresAt, status: document.status };
    }

    this.configuredClient();
    const url = cloudinary.utils.private_download_url(document.cloudinaryPublicId, "pdf", {
      resource_type: "image",
      type: "authenticated",
      expires_at: expiresAt,
      attachment: false,
    });
    return { url, expiresAt, status: document.status };
  }

  async fileForAdmin(userId: string): Promise<IdentityDocumentFile> {
    return this.fileForDocument(await this.documentForFreelancerUser(userId));
  }

  async fileForOwner(userId: string): Promise<IdentityDocumentFile> {
    return this.fileForDocument(await this.documentForFreelancerUser(userId));
  }

  private async fileForDocument(document: { cloudinaryPublicId: string }): Promise<IdentityDocumentFile> {
    if (!this.isLocalPublicId(document.cloudinaryPublicId)) {
      const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
      this.configuredClient();
      return {
        kind: "redirect",
        url: cloudinary.utils.private_download_url(document.cloudinaryPublicId, "pdf", {
          resource_type: "image",
          type: "authenticated",
          expires_at: expiresAt,
          attachment: false,
        }),
      };
    }

    const localPath = await this.localStorage().file(document.cloudinaryPublicId);
    return { kind: "local", path: localPath };
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
