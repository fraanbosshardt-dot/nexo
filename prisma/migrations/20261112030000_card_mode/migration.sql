-- Tarjeta en modo simple (solo el resumen) o detallado (cada compra). Las que ya existen quedan como estaban (detallado).
ALTER TABLE "CreditCard" ADD COLUMN "mode" TEXT NOT NULL DEFAULT 'DETAILED';
-- Resumen cargado por la persona desde el banco (a mano o PDF), no armado solo por Finan.
ALTER TABLE "CardStatement" ADD COLUMN "loaded" BOOLEAN NOT NULL DEFAULT false;
