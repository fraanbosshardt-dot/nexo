-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "country" TEXT NOT NULL DEFAULT 'AR',
ADD COLUMN     "extraCurrencies" TEXT[] DEFAULT ARRAY[]::TEXT[];
