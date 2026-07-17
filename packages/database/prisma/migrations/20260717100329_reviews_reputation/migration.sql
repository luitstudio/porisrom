-- CreateEnum
CREATE TYPE "ReviewDirection" AS ENUM ('client_to_freelancer', 'freelancer_to_client');

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "workAssignmentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "direction" "ReviewDirection" NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Review_workAssignmentId_direction_key" ON "Review"("workAssignmentId", "direction");

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_workAssignmentId_fkey" FOREIGN KEY ("workAssignmentId") REFERENCES "WorkAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
