-- CreateEnum
CREATE TYPE "PlanPeriod" AS ENUM ('MONTHLY', 'TERM', 'YEARLY');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PAID', 'UNPAID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'TRANSFER');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'ENDED', 'CANCELED');

-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('HAPPY', 'CALM', 'TIRED', 'SAD', 'UPSET');

-- CreateTable
CREATE TABLE "Plan" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "period" "PlanPeriod" NOT NULL DEFAULT 'MONTHLY',
    "services" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "planId" UUID,
    "value" DECIMAL(10,2) NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "paymentMethod" "PaymentMethod",
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "paidAt" TIMESTAMP(3),
    "lastRemindedAt" TIMESTAMP(3),
    "reminders" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DailyReport" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "childId" UUID NOT NULL,
    "date" DATE NOT NULL,
    "meals" JSONB NOT NULL DEFAULT '[]',
    "napMinutes" INTEGER,
    "toilet" INTEGER,
    "mood" "Mood",
    "activities" TEXT,
    "notes" TEXT,
    "authorId" UUID,
    "sharedAt" TIMESTAMP(3),
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Plan_daycareId_idx" ON "Plan"("daycareId");

-- CreateIndex
CREATE INDEX "Subscription_daycareId_status_paymentStatus_idx" ON "Subscription"("daycareId", "status", "paymentStatus");

-- CreateIndex
CREATE INDEX "Subscription_childId_idx" ON "Subscription"("childId");

-- CreateIndex
CREATE INDEX "DailyReport_daycareId_date_idx" ON "DailyReport"("daycareId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_childId_date_key" ON "DailyReport"("childId", "date");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyReport" ADD CONSTRAINT "DailyReport_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE CASCADE ON UPDATE CASCADE;

