-- CreateEnum
CREATE TYPE "ChildAttendanceStatus" AS ENUM ('ATTENDED', 'ABSENT', 'VACATION', 'DEPARTURE');

-- CreateEnum
CREATE TYPE "AttendanceMethod" AS ENUM ('MANUAL', 'QR', 'PIN', 'GEO');

-- CreateEnum
CREATE TYPE "AttendanceDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "VacationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "pinHash" TEXT;

-- CreateTable
CREATE TABLE "ChildAttendance" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "ChildAttendanceStatus" NOT NULL,
    "checkInAt" TIMESTAMP(3),
    "checkOutAt" TIMESTAMP(3),
    "droppedOffBy" TEXT,
    "pickedUpBy" TEXT,
    "method" "AttendanceMethod" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "recordedById" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChildAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "membershipId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "checkInAt" TIMESTAMP(3) NOT NULL,
    "checkOutAt" TIMESTAMP(3),
    "method" "AttendanceMethod" NOT NULL,
    "distanceM" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceEvent" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "childId" UUID,
    "membershipId" UUID,
    "direction" "AttendanceDirection" NOT NULL,
    "method" "AttendanceMethod" NOT NULL,
    "actorId" UUID,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "distanceM" INTEGER,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VacationRequest" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "reason" TEXT,
    "status" "VacationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VacationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChildAttendance_daycareId_date_idx" ON "ChildAttendance"("daycareId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ChildAttendance_childId_date_key" ON "ChildAttendance"("childId", "date");

-- CreateIndex
CREATE INDEX "StaffAttendance_daycareId_date_idx" ON "StaffAttendance"("daycareId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAttendance_membershipId_date_key" ON "StaffAttendance"("membershipId", "date");

-- CreateIndex
CREATE INDEX "AttendanceEvent_daycareId_at_idx" ON "AttendanceEvent"("daycareId", "at");

-- CreateIndex
CREATE INDEX "AttendanceEvent_membershipId_at_idx" ON "AttendanceEvent"("membershipId", "at");

-- CreateIndex
CREATE INDEX "AttendanceEvent_childId_at_idx" ON "AttendanceEvent"("childId", "at");

-- CreateIndex
CREATE INDEX "VacationRequest_daycareId_status_idx" ON "VacationRequest"("daycareId", "status");

-- CreateIndex
CREATE INDEX "VacationRequest_childId_startDate_idx" ON "VacationRequest"("childId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_daycareId_pinHash_key" ON "Membership"("daycareId", "pinHash");

-- AddForeignKey
ALTER TABLE "ChildAttendance" ADD CONSTRAINT "ChildAttendance_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_membershipId_fkey" FOREIGN KEY ("membershipId") REFERENCES "Membership"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VacationRequest" ADD CONSTRAINT "VacationRequest_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

