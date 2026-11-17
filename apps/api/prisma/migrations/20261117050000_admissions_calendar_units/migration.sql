-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('UNDER_REVIEW', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "UnitItemKind" AS ENUM ('LESSON', 'ACTIVITY');

-- CreateEnum
CREATE TYPE "EventAudience" AS ENUM ('ALL', 'BRANCH', 'CLASS');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('EVENT', 'LESSON', 'ACTIVITY', 'HOLIDAY', 'MEETING', 'TRIP');

-- CreateTable
CREATE TABLE "AdmissionRequest" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "daycareId" UUID NOT NULL,
    "requestedById" UUID,
    "childName" TEXT NOT NULL,
    "childGender" "Gender" NOT NULL,
    "childBirthDate" DATE NOT NULL,
    "guardianName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "notes" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'UNDER_REVIEW',
    "rejectReason" TEXT,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "childId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "minAgeMonths" INTEGER,
    "maxAgeMonths" INTEGER,
    "goals" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "color" TEXT,
    "startDate" DATE,
    "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UnitItem" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "unitId" UUID NOT NULL,
    "kind" "UnitItemKind" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEvent" (
    "id" UUID NOT NULL,
    "daycareId" UUID,
    "audience" "EventAudience" NOT NULL DEFAULT 'BRANCH',
    "classroomId" UUID,
    "unitId" UUID,
    "teacherId" UUID,
    "type" "EventType" NOT NULL DEFAULT 'EVENT',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "CalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdmissionRequest_daycareId_status_createdAt_idx" ON "AdmissionRequest"("daycareId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "AdmissionRequest_requestedById_idx" ON "AdmissionRequest"("requestedById");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionRequest_number_key" ON "AdmissionRequest"("number");

-- CreateIndex
CREATE INDEX "Unit_daycareId_status_idx" ON "Unit"("daycareId", "status");

-- CreateIndex
CREATE INDEX "UnitItem_daycareId_unitId_idx" ON "UnitItem"("daycareId", "unitId");

-- CreateIndex
CREATE INDEX "CalendarEvent_daycareId_startDate_idx" ON "CalendarEvent"("daycareId", "startDate");

-- CreateIndex
CREATE INDEX "CalendarEvent_audience_startDate_idx" ON "CalendarEvent"("audience", "startDate");

-- AddForeignKey
ALTER TABLE "UnitItem" ADD CONSTRAINT "UnitItem_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

