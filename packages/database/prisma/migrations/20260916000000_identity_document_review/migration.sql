-- Private Cloudinary identifiers only; document binaries and signed URLs are never stored in PostgreSQL.
CREATE TYPE "IdentityDocumentReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "IdentityDocument" (
    "id" TEXT NOT NULL,
    "freelancerProfileId" TEXT NOT NULL,
    "status" "IdentityDocumentReviewStatus" NOT NULL DEFAULT 'pending',
    "cloudinaryPublicId" TEXT NOT NULL,
    "cloudinaryAssetId" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IdentityDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IdentityDocument_freelancerProfileId_key" ON "IdentityDocument"("freelancerProfileId");
ALTER TABLE "IdentityDocument" ADD CONSTRAINT "IdentityDocument_freelancerProfileId_fkey"
  FOREIGN KEY ("freelancerProfileId") REFERENCES "FreelancerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
