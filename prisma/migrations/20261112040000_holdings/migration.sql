-- Inversiones por especie (ticker, nominales) y cotizaciones guardadas (solo agrega)
ALTER TABLE "Investment" ADD COLUMN "ticker" TEXT;
ALTER TABLE "Investment" ADD COLUMN "assetClass" TEXT;
ALTER TABLE "Investment" ADD COLUMN "quoteId" TEXT;
ALTER TABLE "Investment" ADD COLUMN "manualPrice" DECIMAL(24,8);
ALTER TABLE "Investment" ADD COLUMN "manualPriceAt" DATE;

CREATE TABLE "Quote" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "price" DECIMAL(24,8) NOT NULL,
    "currency" TEXT NOT NULL,
    "changePct" DECIMAL(9,4),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Quote_source_symbol_key" ON "Quote"("source", "symbol");
