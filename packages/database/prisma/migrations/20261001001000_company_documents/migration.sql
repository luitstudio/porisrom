CREATE TYPE "CompanyDocumentType" AS ENUM ('company_certificate', 'aadhaar');
CREATE TYPE "CompanyDocumentUploadStatus" AS ENUM ('uploaded');

CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "companyProfileId" TEXT NOT NULL,
    "type" "CompanyDocumentType" NOT NULL,
    "uploadStatus" "CompanyDocumentUploadStatus" NOT NULL DEFAULT 'uploaded',
    "storagePublicId" TEXT NOT NULL,
    "storageAssetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompanyDocument_companyProfileId_idx" ON "CompanyDocument"("companyProfileId");
CREATE INDEX "CompanyDocument_type_idx" ON "CompanyDocument"("type");

ALTER TABLE "CompanyDocument" ADD CONSTRAINT "CompanyDocument_companyProfileId_fkey"
  FOREIGN KEY ("companyProfileId") REFERENCES "CompanyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
