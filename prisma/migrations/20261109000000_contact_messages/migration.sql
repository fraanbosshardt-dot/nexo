-- Consultas del formulario de Contacto (solo agrega una tabla nueva)
CREATE TABLE "ContactMessage" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "area" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "reply" TEXT,
  "userId" TEXT,
  "ip" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactMessage_code_key" ON "ContactMessage"("code");
CREATE INDEX "ContactMessage_status_createdAt_idx" ON "ContactMessage"("status", "createdAt");
CREATE INDEX "ContactMessage_area_createdAt_idx" ON "ContactMessage"("area", "createdAt");
