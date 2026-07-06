-- CreateEnum
CREATE TYPE "Role" AS ENUM ('freelancer', 'client', 'admin');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'blocked', 'deleted');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role",
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "profileCompleteness" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
