-- AlterEnum
ALTER TYPE "AccountType" ADD VALUE 'CREDIT_CARD';

-- AlterEnum
ALTER TYPE "TxType" ADD VALUE 'DEBT_DISBURSEMENT';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "suspendedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Debt" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "installmentAmount" DECIMAL(18,2);

-- AlterTable
ALTER TABLE "CreditCard" ADD COLUMN     "accountId" TEXT;

-- AlterTable
ALTER TABLE "InstallmentPlan" ADD COLUMN     "firstStatementDate" DATE,
ADD COLUMN     "transactionId" TEXT;

-- AlterTable
ALTER TABLE "Asset" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SupportTicket" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "reply" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupportTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupportTicket_status_createdAt_idx" ON "SupportTicket"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CreditCard_accountId_key" ON "CreditCard"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "InstallmentPlan_transactionId_key" ON "InstallmentPlan"("transactionId");

-- AddForeignKey
ALTER TABLE "SupportTicket" ADD CONSTRAINT "SupportTicket_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
