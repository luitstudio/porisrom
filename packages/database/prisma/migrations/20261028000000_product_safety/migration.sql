-- CreateEnum
CREATE TYPE "SafetyCaseKind" AS ENUM ('user_report', 'cancellation', 'support');

-- CreateEnum
CREATE TYPE "SafetyCaseStatus" AS ENUM ('open', 'resolved', 'dismissed');

-- CreateTable
CREATE TABLE "UserBlock" (
    "id" TEXT NOT NULL,
    "blockerId" TEXT NOT NULL,
    "blockedUserId" TEXT NOT NULL,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unblockedAt" TIMESTAMP(3),

    CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyCase" (
    "id" TEXT NOT NULL,
    "kind" "SafetyCaseKind" NOT NULL,
    "status" "SafetyCaseStatus" NOT NULL DEFAULT 'open',
    "reporterId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "conversationId" TEXT,
    "assignmentId" TEXT,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "activeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "decision" TEXT,
    "decisionReason" TEXT,

    CONSTRAINT "SafetyCase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SafetyCaseEvent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SafetyCaseEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "socket_io_attachments" (
    "id" BIGSERIAL NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" BYTEA NOT NULL,

    CONSTRAINT "socket_io_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserBlock_activeKey_key" ON "UserBlock"("activeKey");

-- CreateIndex
CREATE INDEX "UserBlock_blockerId_blockedUserId_unblockedAt_idx" ON "UserBlock"("blockerId", "blockedUserId", "unblockedAt");

-- CreateIndex
CREATE INDEX "UserBlock_blockedUserId_blockerId_unblockedAt_idx" ON "UserBlock"("blockedUserId", "blockerId", "unblockedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SafetyCase_activeKey_key" ON "SafetyCase"("activeKey");

-- CreateIndex
CREATE INDEX "SafetyCase_kind_status_createdAt_idx" ON "SafetyCase"("kind", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyCase_reporterId_createdAt_idx" ON "SafetyCase"("reporterId", "createdAt");

-- CreateIndex
CREATE INDEX "SafetyCase_assignmentId_idx" ON "SafetyCase"("assignmentId");

-- CreateIndex
CREATE INDEX "SafetyCaseEvent_caseId_createdAt_idx" ON "SafetyCaseEvent"("caseId", "createdAt");

-- CreateIndex
CREATE INDEX "socket_io_attachments_created_at_idx" ON "socket_io_attachments"("created_at");

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedUserId_fkey" FOREIGN KEY ("blockedUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCase" ADD CONSTRAINT "SafetyCase_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "WorkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCaseEvent" ADD CONSTRAINT "SafetyCaseEvent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "SafetyCase"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SafetyCaseEvent" ADD CONSTRAINT "SafetyCaseEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
