-- Existing owner memberships become branch managers before OWNER is removed.
UPDATE "Membership" SET "role" = 'MANAGER' WHERE "role" = 'OWNER';

-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'MANAGER', 'STAFF', 'PARENT');
ALTER TABLE "Membership" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "public"."Role_old";
COMMIT;

-- AlterTable
ALTER TABLE "Daycare" DROP COLUMN "trialEndsAt",
ADD COLUMN     "nameEn" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "passwordHash",
ADD COLUMN     "googleId" TEXT;

-- DropTable
DROP TABLE "OtpCode";

-- DropEnum
DROP TYPE "OtpPurpose";

-- CreateIndex
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");

