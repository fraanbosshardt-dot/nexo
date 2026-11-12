-- Orden de las cuentas elegido por el usuario (las existentes conservan el orden de creación)
ALTER TABLE "Account" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "Account" a SET "position" = r.n FROM (SELECT "id", ROW_NUMBER() OVER (PARTITION BY "workspaceId" ORDER BY "createdAt") AS n FROM "Account") r WHERE a."id" = r."id";
