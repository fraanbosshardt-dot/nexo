-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "PlanCode" AS ENUM ('FREE', 'PRO');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'SAVINGS', 'CHECKING', 'WALLET', 'FOREIGN', 'INVESTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "CategoryKind" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TxType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER', 'ADJUSTMENT', 'DEBT_PAYMENT', 'CARD_PAYMENT', 'INVESTMENT');

-- CreateEnum
CREATE TYPE "Direction" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "ObligationDirection" AS ENUM ('RECEIVABLE', 'PAYABLE');

-- CreateEnum
CREATE TYPE "ObligationStatus" AS ENUM ('PENDING', 'PARTIAL', 'SETTLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Certainty" AS ENUM ('CONFIRMED', 'PROBABLE', 'HYPOTHETICAL');

-- CreateEnum
CREATE TYPE "Frequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "WeekendRule" AS ENUM ('NONE', 'PREVIOUS_BUSINESS_DAY', 'NEXT_BUSINESS_DAY');

-- CreateEnum
CREATE TYPE "AmortizationSystem" AS ENUM ('FRENCH', 'GERMAN', 'AMERICAN', 'NO_INTEREST', 'MANUAL', 'NONE');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "totpSecretEnc" TEXT,
    "totpEnabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "twoFactorVerified" BOOLEAN NOT NULL DEFAULT false,
    "userAgent" TEXT,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "baseCurrency" TEXT NOT NULL DEFAULT 'ARS',
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "locale" TEXT NOT NULL DEFAULT 'es-AR',
    "modules" JSONB NOT NULL DEFAULT '{}',
    "onboardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "plan" "PlanCode" NOT NULL DEFAULT 'FREE',
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "billingCycle" TEXT,
    "provider" TEXT,
    "providerRef" TEXT,
    "currentPeriodEnd" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "institution" TEXT,
    "type" "AccountType" NOT NULL,
    "currency" TEXT NOT NULL,
    "initialBalance" DECIMAL(18,2) NOT NULL,
    "initialDate" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "CategoryKind" NOT NULL,
    "parentId" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TxType" NOT NULL,
    "direction" "Direction" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "categoryId" TEXT,
    "effectiveDate" DATE NOT NULL,
    "economicPeriod" TEXT NOT NULL,
    "obligationId" TEXT,
    "transferGroupId" TEXT,
    "fxRate" DECIMAL(18,6),
    "fxDate" TIMESTAMP(3),
    "reversalOfId" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "notes" TEXT,
    "idempotencyKey" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Obligation" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "direction" "ObligationDirection" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "categoryId" TEXT,
    "dueDate" DATE NOT NULL,
    "economicPeriod" TEXT NOT NULL,
    "status" "ObligationStatus" NOT NULL DEFAULT 'PENDING',
    "certainty" "Certainty" NOT NULL DEFAULT 'CONFIRMED',
    "counterparty" TEXT,
    "recurringRuleId" TEXT,
    "occurrenceDate" DATE,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Obligation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecurringRule" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "direction" "ObligationDirection" NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "variableAmount" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL,
    "categoryId" TEXT,
    "accountId" TEXT,
    "frequency" "Frequency" NOT NULL,
    "interval" INTEGER NOT NULL DEFAULT 1,
    "dayOfMonth" INTEGER,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "weekendRule" "WeekendRule" NOT NULL DEFAULT 'NONE',
    "increasePct" DECIMAL(9,4),
    "increaseEveryMonths" INTEGER,
    "pausedAt" TIMESTAMP(3),
    "previousVersionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Debt" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "creditor" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "system" "AmortizationSystem" NOT NULL,
    "tna" DECIMAL(9,4),
    "tea" DECIMAL(9,4),
    "cft" DECIMAL(9,4),
    "startDate" DATE NOT NULL,
    "installments" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "cancelledAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DebtInstallment" (
    "id" TEXT NOT NULL,
    "debtId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "dueDate" DATE NOT NULL,
    "capital" DECIMAL(18,2) NOT NULL,
    "interest" DECIMAL(18,2) NOT NULL,
    "total" DECIMAL(18,2) NOT NULL,
    "balanceAfter" DECIMAL(18,2) NOT NULL,
    "obligationId" TEXT,

    CONSTRAINT "DebtInstallment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditCard" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "last4" TEXT,
    "limitAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "payAccountId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CardStatement" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "closingDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "minimumAmount" DECIMAL(18,2) NOT NULL,
    "obligationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardStatement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstallmentPlan" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "purchaseDate" DATE NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "installments" INTEGER NOT NULL,
    "installmentAmount" DECIMAL(18,2) NOT NULL,
    "interestFree" BOOLEAN NOT NULL DEFAULT true,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstallmentPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "rolloverUnused" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "limitAmount" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Goal" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetAmount" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "targetDate" DATE,
    "monthlyContribution" DECIMAL(18,2),
    "accountIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Goal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoalContribution" (
    "id" TEXT NOT NULL,
    "goalId" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "date" DATE NOT NULL,
    "transactionId" TEXT,

    CONSTRAINT "GoalContribution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investment" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "accountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Investment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvestmentMovement" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "quantity" DECIMAL(24,8),
    "date" DATE NOT NULL,
    "transactionId" TEXT,

    CONSTRAINT "InvestmentMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Valuation" (
    "id" TEXT NOT NULL,
    "investmentId" TEXT,
    "assetId" TEXT,
    "value" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "Valuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GrainSale" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "saleDate" DATE NOT NULL,
    "grain" TEXT NOT NULL,
    "tonnes" DECIMAL(14,3) NOT NULL,
    "pricePerTonne" DECIMAL(18,2) NOT NULL,
    "priceCurrency" TEXT NOT NULL DEFAULT 'ARS',
    "fxRate" DECIMAL(18,6),
    "taxPct" DECIMAL(6,3) NOT NULL DEFAULT 1.2,
    "otherDeductions" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "collectDate" DATE NOT NULL,
    "obligationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GrainSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeRate" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "base" TEXT NOT NULL,
    "quote" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "buy" DECIMAL(18,6),
    "sell" DECIMAL(18,6) NOT NULL,
    "source" TEXT NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExchangeRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "rows" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPLIED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT,
    "entityId" TEXT,
    "meta" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Membership_workspaceId_idx" ON "Membership"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_workspaceId_key" ON "Membership"("userId", "workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");

-- CreateIndex
CREATE INDEX "Account_workspaceId_idx" ON "Account"("workspaceId");

-- CreateIndex
CREATE INDEX "Category_workspaceId_idx" ON "Category"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_workspaceId_kind_parentId_name_key" ON "Category"("workspaceId", "kind", "parentId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_reversalOfId_key" ON "Transaction"("reversalOfId");

-- CreateIndex
CREATE INDEX "Transaction_workspaceId_effectiveDate_idx" ON "Transaction"("workspaceId", "effectiveDate");

-- CreateIndex
CREATE INDEX "Transaction_accountId_idx" ON "Transaction"("accountId");

-- CreateIndex
CREATE INDEX "Transaction_obligationId_idx" ON "Transaction"("obligationId");

-- CreateIndex
CREATE INDEX "Transaction_transferGroupId_idx" ON "Transaction"("transferGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_workspaceId_idempotencyKey_key" ON "Transaction"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "Obligation_workspaceId_dueDate_idx" ON "Obligation"("workspaceId", "dueDate");

-- CreateIndex
CREATE INDEX "Obligation_workspaceId_status_idx" ON "Obligation"("workspaceId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Obligation_recurringRuleId_occurrenceDate_key" ON "Obligation"("recurringRuleId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "RecurringRule_workspaceId_idx" ON "RecurringRule"("workspaceId");

-- CreateIndex
CREATE INDEX "Debt_workspaceId_idx" ON "Debt"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtInstallment_obligationId_key" ON "DebtInstallment"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "DebtInstallment_debtId_number_key" ON "DebtInstallment"("debtId", "number");

-- CreateIndex
CREATE INDEX "CreditCard_workspaceId_idx" ON "CreditCard"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "CardStatement_obligationId_key" ON "CardStatement"("obligationId");

-- CreateIndex
CREATE UNIQUE INDEX "CardStatement_cardId_closingDate_key" ON "CardStatement"("cardId", "closingDate");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_workspaceId_period_key" ON "Budget"("workspaceId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "BudgetLine_budgetId_categoryId_key" ON "BudgetLine"("budgetId", "categoryId");

-- CreateIndex
CREATE INDEX "Goal_workspaceId_idx" ON "Goal"("workspaceId");

-- CreateIndex
CREATE INDEX "Investment_workspaceId_idx" ON "Investment"("workspaceId");

-- CreateIndex
CREATE INDEX "Asset_workspaceId_idx" ON "Asset"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "GrainSale_obligationId_key" ON "GrainSale"("obligationId");

-- CreateIndex
CREATE INDEX "GrainSale_workspaceId_idx" ON "GrainSale"("workspaceId");

-- CreateIndex
CREATE INDEX "ExchangeRate_base_quote_kind_fetchedAt_idx" ON "ExchangeRate"("base", "quote", "kind", "fetchedAt");

-- CreateIndex
CREATE INDEX "AuditLog_workspaceId_createdAt_idx" ON "AuditLog"("workspaceId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Membership" ADD CONSTRAINT "Membership_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "Obligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "Transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Obligation" ADD CONSTRAINT "Obligation_recurringRuleId_fkey" FOREIGN KEY ("recurringRuleId") REFERENCES "RecurringRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringRule" ADD CONSTRAINT "RecurringRule_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DebtInstallment" ADD CONSTRAINT "DebtInstallment_debtId_fkey" FOREIGN KEY ("debtId") REFERENCES "Debt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditCard" ADD CONSTRAINT "CreditCard_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CardStatement" ADD CONSTRAINT "CardStatement_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InstallmentPlan" ADD CONSTRAINT "InstallmentPlan_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Goal" ADD CONSTRAINT "Goal_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoalContribution" ADD CONSTRAINT "GoalContribution_goalId_fkey" FOREIGN KEY ("goalId") REFERENCES "Goal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investment" ADD CONSTRAINT "Investment_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvestmentMovement" ADD CONSTRAINT "InvestmentMovement_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_investmentId_fkey" FOREIGN KEY ("investmentId") REFERENCES "Investment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Valuation" ADD CONSTRAINT "Valuation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GrainSale" ADD CONSTRAINT "GrainSale_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExchangeRate" ADD CONSTRAINT "ExchangeRate_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
