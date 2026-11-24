-- CreateTable
CREATE TABLE "AgentPending" (
    "userId" UUID NOT NULL,
    "daycareId" UUID,
    "operations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentPending_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AgentInbound" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentInbound_pkey" PRIMARY KEY ("id")
);

