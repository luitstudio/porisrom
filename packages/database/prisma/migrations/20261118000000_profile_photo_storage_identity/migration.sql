-- Versioned photo/logo assets need a durable provider/local identifier for
-- compensating cleanup. Existing URL-only assets deliberately remain null:
-- guessing an old provider identifier would be destructive.
ALTER TABLE "FreelancerProfile" ADD COLUMN "profilePhotoStorageId" TEXT;
ALTER TABLE "CompanyProfile" ADD COLUMN "logoStorageId" TEXT;
