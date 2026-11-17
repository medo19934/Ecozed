-- CreateTable
CREATE TABLE "KioskTokenUse" (
    "tokenHash" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KioskTokenUse_pkey" PRIMARY KEY ("tokenHash","userId")
);

-- CreateIndex
CREATE INDEX "KioskTokenUse_usedAt_idx" ON "KioskTokenUse"("usedAt");

