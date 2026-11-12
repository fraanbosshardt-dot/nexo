-- Tarjetas: segunda moneda, fechas por mes, suscripciones, adicionales, cargos e intereses (solo agrega)
ALTER TABLE "CreditCard" ADD COLUMN "parentId" TEXT;
ALTER TABLE "CreditCard" ADD COLUMN "financeRate" DECIMAL(9,4);
ALTER TABLE "CreditCard" ADD COLUMN "monthlyFee" DECIMAL(18,2);
ALTER TABLE "CreditCard" ADD COLUMN "alertPct" INTEGER;
ALTER TABLE "CreditCard" ADD COLUMN "holders" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "CardStatement" ADD COLUMN "carriedAmount" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "InstallmentPlan" ADD COLUMN "advancedTo" DATE;
ALTER TABLE "Transaction" ADD COLUMN "cardHolder" TEXT;

CREATE TABLE "CardCycle" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "closingDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    CONSTRAINT "CardCycle_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CardCycle_cardId_month_key" ON "CardCycle"("cardId", "month");
ALTER TABLE "CardCycle" ADD CONSTRAINT "CardCycle_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CardSubscription" (
    "id" TEXT NOT NULL,
    "cardId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "categoryId" TEXT,
    "dayOfMonth" INTEGER NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "holder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CardSubscription_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CardSubscription_cardId_idx" ON "CardSubscription"("cardId");
ALTER TABLE "CardSubscription" ADD CONSTRAINT "CardSubscription_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "CreditCard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
