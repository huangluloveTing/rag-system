/*
  Warnings:

  - Added the required column `messageId` to the `feedbacks` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "feedbacks" ADD COLUMN     "messageId" UUID NOT NULL,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedBy" UUID,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
ADD COLUMN     "tags" TEXT[];

-- CreateIndex
CREATE INDEX "feedbacks_status_idx" ON "feedbacks"("status");

-- CreateIndex
CREATE INDEX "feedbacks_userId_idx" ON "feedbacks"("userId");
