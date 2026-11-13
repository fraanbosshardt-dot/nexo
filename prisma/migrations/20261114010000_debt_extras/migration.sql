-- Préstamos: IVA sobre los intereses, seguro sobre el saldo y cargos fijos por cuota (solo agrega)
ALTER TABLE "Debt" ADD COLUMN "vatPct" DECIMAL(5,2);
ALTER TABLE "Debt" ADD COLUMN "insurancePct" DECIMAL(7,4);
ALTER TABLE "Debt" ADD COLUMN "insuranceFixed" DECIMAL(18,2);
ALTER TABLE "DebtInstallment" ADD COLUMN "vat" DECIMAL(18,2) NOT NULL DEFAULT 0;
ALTER TABLE "DebtInstallment" ADD COLUMN "insurance" DECIMAL(18,2) NOT NULL DEFAULT 0;
