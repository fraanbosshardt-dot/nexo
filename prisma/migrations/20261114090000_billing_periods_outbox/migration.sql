ALTER TABLE "Invoice" ADD COLUMN "agreementRef" TEXT, ADD COLUMN "paymentId" TEXT, ADD COLUMN "periodStart" TIMESTAMP(3), ADD COLUMN "periodEnd" TIMESTAMP(3), ADD COLUMN "providerUpdatedAt" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "legacyPaidUntil" TIMESTAMP(3);
ALTER TABLE "Subscription" ADD COLUMN "nextPaymentAt" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN "billingDisabledAt" TIMESTAMP(3);
UPDATE "Subscription" SET "legacyPaidUntil"="currentPeriodEnd" WHERE "provider"='mercadopago';
CREATE UNIQUE INDEX "Invoice_paymentId_key" ON "Invoice"("paymentId");
ALTER TABLE "Invoice" ADD COLUMN "refundedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
CREATE TABLE "BillingAgreement" (
 "id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT NOT NULL REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "providerRef" TEXT, "checkoutUrl" TEXT, "cycle" TEXT NOT NULL, "amount" DECIMAL(18,2) NOT NULL, "currency" TEXT NOT NULL DEFAULT 'ARS',
 "couponCode" TEXT, "couponCounted" BOOLEAN NOT NULL DEFAULT false, "status" TEXT NOT NULL DEFAULT 'creating', "startsAt" TIMESTAMP(3),
 "providerUpdatedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE UNIQUE INDEX "BillingAgreement_providerRef_key" ON "BillingAgreement"("providerRef");
CREATE INDEX "BillingAgreement_workspaceId_status_idx" ON "BillingAgreement"("workspaceId", "status");
INSERT INTO "BillingAgreement" ("id","workspaceId","providerRef","cycle","amount","status","updatedAt")
 SELECT 'legacy-' || "id", "workspaceId", "providerRef", COALESCE("billingCycle",'monthly'), 0,
 CASE WHEN "status"='CANCELED' THEN 'cancelled' WHEN "status"='PAST_DUE' THEN 'paused' ELSE 'authorized' END, CURRENT_TIMESTAMP
 FROM "Subscription" WHERE "provider"='mercadopago' AND "providerRef" IS NOT NULL;
CREATE TABLE "EmailOutbox" (
 "id" TEXT NOT NULL PRIMARY KEY, "dedupeKey" TEXT NOT NULL, "workspaceId" TEXT, "to" TEXT NOT NULL, "subject" TEXT NOT NULL, "text" TEXT NOT NULL, "purpose" TEXT NOT NULL,
 "attempts" INTEGER NOT NULL DEFAULT 0, "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "sentAt" TIMESTAMP(3), "providerId" TEXT, "lastError" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");
CREATE INDEX "EmailOutbox_sentAt_nextAttemptAt_idx" ON "EmailOutbox"("sentAt", "nextAttemptAt");
