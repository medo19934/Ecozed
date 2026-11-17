-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "RecordStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DocumentOwner" AS ENUM ('BRANCH', 'STAFF', 'CHILD');

-- AlterTable
ALTER TABLE "Daycare" DROP COLUMN "logoUrl",
ADD COLUMN     "logoKey" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "address" TEXT,
ADD COLUMN     "isTest" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "joinDate" DATE,
ADD COLUMN     "qualification" TEXT,
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "Classroom" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 20,
    "minAgeMonths" INTEGER,
    "maxAgeMonths" INTEGER,
    "color" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Classroom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassTeacher" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "classroomId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,

    CONSTRAINT "ClassTeacher_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Child" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "classroomId" UUID,
    "fullName" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "birthDate" DATE NOT NULL,
    "photoKey" TEXT,
    "allergies" TEXT,
    "medicalNotes" TEXT,
    "pickupPeople" JSONB NOT NULL DEFAULT '[]',
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Child_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChildGuardian" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "userId" UUID,
    "fullName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildGuardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Document" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "ownerType" "DocumentOwner" NOT NULL,
    "ownerId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "expiresAt" DATE,
    "uploadedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Classroom_daycareId_idx" ON "Classroom"("daycareId");

-- CreateIndex
CREATE INDEX "ClassTeacher_daycareId_idx" ON "ClassTeacher"("daycareId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassTeacher_classroomId_membershipId_key" ON "ClassTeacher"("classroomId", "membershipId");

-- CreateIndex
CREATE INDEX "Child_daycareId_status_idx" ON "Child"("daycareId", "status");

-- CreateIndex
CREATE INDEX "Child_daycareId_classroomId_idx" ON "Child"("daycareId", "classroomId");

-- CreateIndex
CREATE INDEX "ChildGuardian_daycareId_idx" ON "ChildGuardian"("daycareId");

-- CreateIndex
CREATE INDEX "ChildGuardian_email_idx" ON "ChildGuardian"("email");

-- CreateIndex
CREATE INDEX "ChildGuardian_userId_idx" ON "ChildGuardian"("userId");

-- CreateIndex
CREATE INDEX "Document_daycareId_ownerType_ownerId_idx" ON "Document"("daycareId", "ownerType", "ownerId");

-- AddForeignKey
ALTER TABLE "Classroom" ADD CONSTRAINT "Classroom_daycareId_fkey" FOREIGN KEY ("daycareId") REFERENCES "Daycare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_daycareId_fkey" FOREIGN KEY ("daycareId") REFERENCES "Daycare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Child" ADD CONSTRAINT "Child_classroomId_fkey" FOREIGN KEY ("classroomId") REFERENCES "Classroom"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildGuardian" ADD CONSTRAINT "ChildGuardian_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChildGuardian" ADD CONSTRAINT "ChildGuardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

