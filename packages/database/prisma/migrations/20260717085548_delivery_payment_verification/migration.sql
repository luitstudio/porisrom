-- CreateEnum
CREATE TYPE "DeliverableType" AS ENUM ('demo', 'preview', 'watermarked_file', 'drive_link', 'github_link', 'file');

-- CreateEnum
CREATE TYPE "PaymentVerificationStatus" AS ENUM ('awaiting_client', 'awaiting_freelancer', 'mismatch', 'verified');

-- CreateTable
CREATE TABLE "Deliverable" (
    "id" TEXT NOT NULL,
    "workAssignmentId" TEXT NOT NULL,
    "type" "DeliverableType" NOT NULL,
    "url" TEXT NOT NULL,
    "note" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Deliverable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentVerification" (
    "id" TEXT NOT NULL,
    "workAssignmentId" TEXT NOT NULL,
    "clientUtr" TEXT,
    "clientClaimedAt" TIMESTAMP(3),
    "freelancerUtr" TEXT,
    "freelancerClaimedAt" TIMESTAMP(3),
    "mismatchCount" INTEGER NOT NULL DEFAULT 0,
    "status" "PaymentVerificationStatus" NOT NULL DEFAULT 'awaiting_client',
    "verifiedAt" TIMESTAMP(3),

    CONSTRAINT "PaymentVerification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentVerification_workAssignmentId_key" ON "PaymentVerification"("workAssignmentId");

-- AddForeignKey
ALTER TABLE "Deliverable" ADD CONSTRAINT "Deliverable_workAssignmentId_fkey" FOREIGN KEY ("workAssignmentId") REFERENCES "WorkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentVerification" ADD CONSTRAINT "PaymentVerification_workAssignmentId_fkey" FOREIGN KEY ("workAssignmentId") REFERENCES "WorkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
