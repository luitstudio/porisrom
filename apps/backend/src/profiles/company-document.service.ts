import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { CompanyDocumentType } from "@porisrom/database";
import { v2 as cloudinary } from "cloudinary";
import { randomUUID } from "crypto";

import { PrismaService } from "../prisma/prisma.service";
import { isLocalDocumentId, LocalDocumentStorage, localDocumentFallbackEnabled, storageConfig } from "../document-storage";
import { StorageMutationCoordinator, StorageMutationReconciliationRequiredError, type StorageMutationLease } from "../storage-maintenance/storage-mutation-coordinator.service";

const MAX_DOCUMENT_BYTES = 1024 * 1024;
const LOCAL_ASSET_ID_PREFIX = "local:";
const SIGNED_URL_TTL_SECONDS = 5 * 60;

type UploadResult = { public_id?: string; asset_id?: string; type?: string; resource_type?: string };
type StoredCompanyDocument = { publicId: string; assetId: string };
type PreviousCompanyDocument = { companyProfileId: string; type: CompanyDocumentType; uploadStatus: "uploaded"; storagePublicId: string; storageAssetId: string };
type CompanyDocumentSummaryRecord = {
  id: string;
  type: CompanyDocumentType;
  uploadStatus: string;
  createdAt: Date;
  updatedAt: Date;
};
export type CompanyDocumentFile = { kind: "local"; path: string } | { kind: "redirect"; url: string };

@Injectable()
export class CompanyDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly maintenance: StorageMutationCoordinator,
  ) {}

  async uploadForClient(
    userId: string,
    files: { certificate?: Express.Multer.File[]; aadhaar?: Express.Multer.File[] },
  ) {
    return this.maintenance.run("company_document", lease => this.uploadForClientUnchecked(lease, userId, files));
  }

  private async uploadForClientUnchecked(
    lease: StorageMutationLease,
    userId: string,
    files: { certificate?: Express.Multer.File[]; aadhaar?: Express.Multer.File[] },
  ) {
    const profile = await this.prisma.db.companyProfile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException("Complete your company profile before submitting documents");

    const uploads: { type: CompanyDocumentType; file: Express.Multer.File }[] = [
      ...(files.certificate ?? []).map((file) => ({ type: "company_certificate" as const, file })),
      ...(files.aadhaar ?? []).map((file) => ({ type: "aadhaar" as const, file })),
    ];
    if (uploads.length === 0) throw new BadRequestException("At least one company document PDF is required");
    uploads.forEach(({ file }) => this.validatePdf(file));

    const stored: { type: CompanyDocumentType; storage: StoredCompanyDocument }[] = [];
    try {
      for (const upload of uploads) {
        const publicId = `company-documents/${userId}/${upload.type}/${randomUUID()}`;
        stored.push({ type: upload.type, storage: await this.uploadPdf(lease, upload.file, publicId) });
      }
    } catch (error) {
      await this.compensateNewDocuments(lease, stored, "new_upload_compensation");
      throw error;
    }

    let replaced: PreviousCompanyDocument[];
    try {
      replaced = await this.replaceDatabaseReferences(profile.id, stored);
    } catch (error) {
      await this.compensateNewDocuments(lease, stored, "database_replacement_compensation");
      throw error;
    }

    // Do not remove old private files until their replacements are committed.
    await this.removeOldDocuments(lease, replaced);

    return this.listForOwner(userId);
  }

  private async replaceDatabaseReferences(companyProfileId: string, stored: { type: CompanyDocumentType; storage: StoredCompanyDocument }[]) {
    return this.prisma.db.$transaction(async (tx) => {
      const types = [...new Set(stored.map(document => document.type))];
      const existing = await tx.companyDocument.findMany({
        where: { companyProfileId, type: { in: types } },
        select: { companyProfileId: true, type: true, uploadStatus: true, storagePublicId: true, storageAssetId: true },
      });
      await tx.companyDocument.deleteMany({ where: { companyProfileId, type: { in: types } } });
      await tx.companyDocument.createMany({
        data: stored.map(({ type, storage }) => ({ companyProfileId, type, storagePublicId: storage.publicId, storageAssetId: storage.assetId })),
      });
      return existing;
    });
  }

  private async removeOldDocuments(lease: StorageMutationLease, documents: PreviousCompanyDocument[]) {
    const failedStorageIds: string[] = [];
    for (const document of documents) {
      try {
        await this.destroyStoredDocument(lease, document.storagePublicId);
      } catch {
        failedStorageIds.push(document.storagePublicId);
      }
    }
    if (failedStorageIds.length) {
      throw new StorageMutationReconciliationRequiredError("company_document_old_cleanup_uncertain", {
        phase: "old_document_cleanup",
        storagePublicIds: failedStorageIds,
      });
    }
  }

  private async compensateNewDocuments(lease: StorageMutationLease, documents: { type: CompanyDocumentType; storage: StoredCompanyDocument }[], phase: string) {
    const failedStorageIds: string[] = [];
    for (const document of documents) {
      try {
        await this.destroyStoredDocument(lease, document.storage.publicId);
      } catch {
        failedStorageIds.push(document.storage.publicId);
      }
    }
    if (failedStorageIds.length) {
      throw new StorageMutationReconciliationRequiredError("company_document_compensation_uncertain", {
        phase,
        storagePublicIds: failedStorageIds,
      });
    }
  }

  async listForOwner(userId: string) {
    const profile = await this.prisma.db.companyProfile.findUnique({
      where: { userId },
      select: { documents: { select: this.documentSelect(), orderBy: [{ type: "asc" }, { createdAt: "asc" }] } },
    });
    if (!profile) throw new NotFoundException("Company profile not found");
    return { documents: profile.documents.map((document) => this.publicDocument(document)) };
  }

  async listForAdmin(userId: string) {
    const profile = await this.prisma.db.companyProfile.findUnique({
      where: { userId },
      select: { documents: { select: this.documentSelect(), orderBy: [{ type: "asc" }, { createdAt: "asc" }] } },
    });
    if (!profile) throw new NotFoundException("Company profile not found");
    return { documents: profile.documents.map((document) => this.publicDocument(document)) };
  }

  async fileForOwner(userId: string, documentId: string) {
    const document = await this.prisma.db.companyDocument.findFirst({
      where: { id: documentId, companyProfile: { userId } },
      select: { storagePublicId: true },
    });
    if (!document) throw new NotFoundException("Company document not found");
    return this.fileForDocument(document.storagePublicId);
  }

  async fileForAdmin(userId: string, documentId: string) {
    const document = await this.prisma.db.companyDocument.findFirst({
      where: { id: documentId, companyProfile: { userId } },
      select: { storagePublicId: true },
    });
    if (!document) throw new NotFoundException("Company document not found");
    return this.fileForDocument(document.storagePublicId);
  }

  private documentSelect() {
    return {
      id: true,
      type: true,
      uploadStatus: true,
      createdAt: true,
      updatedAt: true,
    } as const;
  }

  private publicDocument(document: CompanyDocumentSummaryRecord) {
    return {
      id: document.id,
      type: document.type,
      uploadStatus: document.uploadStatus,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
    };
  }

  private validatePdf(file: Express.Multer.File | undefined) {
    if (!file) throw new BadRequestException("Company document PDF is required");
    if (file.size > MAX_DOCUMENT_BYTES) throw new BadRequestException("Company document must be 1 MB or smaller");
    if (file.mimetype !== "application/pdf" || !file.buffer.subarray(0, 5).equals(Buffer.from("%PDF-"))) {
      throw new BadRequestException("Company document must be a PDF");
    }
  }

  private configuredClient() {
    const cloudName = this.config.get<string>("CLOUDINARY_CLOUD_NAME");
    const apiKey = this.config.get<string>("CLOUDINARY_API_KEY");
    const apiSecret = this.config.get<string>("CLOUDINARY_API_SECRET");
    if (!cloudName || !apiKey || !apiSecret) {
      throw new ServiceUnavailableException("Company document uploads are not configured");
    }
    return cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });
  }

  private async uploadToCloudinary(lease: StorageMutationLease, file: Express.Multer.File, publicId: string): Promise<UploadResult> {
    await lease.assertNotFenced();
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

  private async uploadPdf(lease: StorageMutationLease, file: Express.Multer.File, publicId: string): Promise<StoredCompanyDocument> {
    try {
      const upload = await this.uploadToCloudinary(lease, file, publicId);
      if (upload.type !== "authenticated" || upload.resource_type !== "image" || upload.public_id !== publicId || !upload.asset_id) {
        try {
          await lease.assertNotFenced();
          await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true });
        } catch {
          throw new StorageMutationReconciliationRequiredError("company_document_invalid_upload_cleanup_uncertain", {
            phase: "invalid_upload_cleanup",
            storagePublicIds: [publicId],
          });
        }
        throw new ServiceUnavailableException("Company document storage could not be secured");
      }
      return { publicId, assetId: upload.asset_id };
    } catch (error) {
      if (error instanceof StorageMutationReconciliationRequiredError) throw error;
      if (this.localFallbackEnabled()) return this.storeLocally(lease, publicId, file);
      if (error instanceof ServiceUnavailableException) throw error;
      throw new ServiceUnavailableException("Company document upload failed. Please try again.");
    }
  }

  private localFallbackEnabled() {
    return localDocumentFallbackEnabled(storageConfig(this.config));
  }

  private localStorage() {
    return new LocalDocumentStorage(storageConfig(this.config), "company-documents");
  }

  private async storeLocally(lease: StorageMutationLease, publicId: string, file: Express.Multer.File): Promise<StoredCompanyDocument> {
    const safePublicId = publicId
      .split("/")
      .map((part) => part.replace(/[^a-zA-Z0-9_-]/g, "-"))
      .filter(Boolean)
      .join("/");
    const relativePath = `${safePublicId}.pdf`;
    await lease.assertNotFenced();
    const storedId = await this.localStorage().write(relativePath, file.buffer);
    return {
      publicId: storedId,
      assetId: `${LOCAL_ASSET_ID_PREFIX}${randomUUID()}`,
    };
  }

  private async destroyStoredDocument(lease: StorageMutationLease, publicId: string) {
    if (this.isLocalPublicId(publicId)) {
      await lease.assertNotFenced();
      await this.localStorage().remove(publicId);
      return;
    }
    await lease.assertNotFenced();
    const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", type: "authenticated", invalidate: true }) as { result?: string };
    // "not found" is safe: no old private object remains. Any other response
    // is not proof of deletion and must be reconciled instead of suppressed.
    if (!result?.result || !["ok", "not_found", "not found"].includes(result.result)) {
      throw new ServiceUnavailableException("Company document deletion could not be confirmed");
    }
  }

  private async fileForDocument(publicId: string): Promise<CompanyDocumentFile> {
    if (!this.isLocalPublicId(publicId)) {
      const expiresAt = Math.floor(Date.now() / 1000) + SIGNED_URL_TTL_SECONDS;
      this.configuredClient();
      return {
        kind: "redirect",
        url: cloudinary.utils.private_download_url(publicId, "pdf", {
          resource_type: "image",
          type: "authenticated",
          expires_at: expiresAt,
          attachment: false,
        }),
      };
    }

    const localPath = await this.localStorage().file(publicId);
    return { kind: "local", path: localPath };
  }

  private isLocalPublicId(publicId: string) {
    return isLocalDocumentId(publicId);
  }
}
