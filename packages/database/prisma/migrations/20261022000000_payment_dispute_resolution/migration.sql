-- Additive only. Administrative review is distinct from matching references.
ALTER TYPE "PaymentVerificationStatus" ADD VALUE 'administratively_resolved';
ALTER TABLE "PaymentVerification" ADD COLUMN "mismatchCountAtReopen" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "PaymentClaim" (
  "id" TEXT NOT NULL,
  "paymentVerificationId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "party" "Role" NOT NULL,
  "reference" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PaymentClaim_paymentVerificationId_createdAt_idx" ON "PaymentClaim"("paymentVerificationId", "createdAt");
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_paymentVerificationId_fkey" FOREIGN KEY ("paymentVerificationId") REFERENCES "PaymentVerification"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentClaim" ADD CONSTRAINT "PaymentClaim_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
