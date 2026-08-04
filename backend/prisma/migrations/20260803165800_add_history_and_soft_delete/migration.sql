-- CreateEnum
CREATE TYPE "HistoryTargetKind" AS ENUM ('UNICO', 'FIJO', 'CUOTA');

-- CreateEnum
CREATE TYPE "HistoryAction" AS ENUM ('EDIT', 'DELETE');

-- AlterTable
ALTER TABLE "InstallmentGroup" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Recurring" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HistoryEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetKind" "HistoryTargetKind" NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" "HistoryAction" NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoryEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HistoryEntry_userId_createdAt_idx" ON "HistoryEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "HistoryEntry_userId_targetKind_targetId_createdAt_idx" ON "HistoryEntry"("userId", "targetKind", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "HistoryEntry_createdAt_idx" ON "HistoryEntry"("createdAt");

-- AddForeignKey
ALTER TABLE "HistoryEntry" ADD CONSTRAINT "HistoryEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

