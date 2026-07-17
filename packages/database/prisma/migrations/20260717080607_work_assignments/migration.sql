-- CreateEnum
CREATE TYPE "WorkAssignmentStatus" AS ENUM ('proposed', 'modification_requested', 'accepted', 'in_progress', 'submitted', 'revision_requested', 'delivery_accepted', 'payment_pending', 'completed', 'disputed', 'cancelled', 'rejected');

-- CreateTable
CREATE TABLE "WorkAssignment" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgetAmount" DECIMAL(65,30) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "dueDate" TIMESTAMP(3),
    "status" "WorkAssignmentStatus" NOT NULL DEFAULT 'proposed',
    "cancelRequestedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkAssignmentEvent" (
    "id" TEXT NOT NULL,
    "workAssignmentId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkAssignmentEvent_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "WorkAssignment" ADD CONSTRAINT "WorkAssignment_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkAssignmentEvent" ADD CONSTRAINT "WorkAssignmentEvent_workAssignmentId_fkey" FOREIGN KEY ("workAssignmentId") REFERENCES "WorkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
