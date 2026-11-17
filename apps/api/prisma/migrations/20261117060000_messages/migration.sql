-- CreateEnum
CREATE TYPE "ThreadKind" AS ENUM ('CHILD', 'STAFF', 'ANNOUNCEMENT');

-- CreateTable
CREATE TABLE "MessageThread" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "kind" "ThreadKind" NOT NULL,
    "childId" UUID,
    "classroomId" UUID,
    "userA" UUID,
    "userB" UUID,
    "title" TEXT,
    "createdById" UUID,
    "lastMessageAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" UUID NOT NULL,
    "daycareId" UUID NOT NULL,
    "threadId" UUID NOT NULL,
    "senderId" UUID NOT NULL,
    "body" TEXT,
    "attachmentKey" TEXT,
    "attachmentName" TEXT,
    "attachmentMime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ThreadRead" (
    "threadId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ThreadRead_pkey" PRIMARY KEY ("threadId","userId")
);

-- CreateIndex
CREATE INDEX "MessageThread_daycareId_lastMessageAt_idx" ON "MessageThread"("daycareId", "lastMessageAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageThread_daycareId_kind_childId_key" ON "MessageThread"("daycareId", "kind", "childId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageThread_daycareId_userA_userB_key" ON "MessageThread"("daycareId", "userA", "userB");

-- CreateIndex
CREATE INDEX "Message_threadId_createdAt_idx" ON "Message"("threadId", "createdAt");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ThreadRead" ADD CONSTRAINT "ThreadRead_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "MessageThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

