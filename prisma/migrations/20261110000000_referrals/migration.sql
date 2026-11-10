-- Referidos (solo agrega columnas opcionales; no cambia ni borra datos)
ALTER TABLE "User" ADD COLUMN "referralCode" TEXT;
ALTER TABLE "User" ADD COLUMN "referredById" TEXT;
ALTER TABLE "User" ADD COLUMN "referralRewardedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");
