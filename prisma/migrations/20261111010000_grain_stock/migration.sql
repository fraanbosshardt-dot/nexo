-- Stock de cereal sin vender (solo agrega; no cambia ni borra datos)
CREATE TABLE "GrainStock" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "grain" TEXT NOT NULL,
    "tonnes" DECIMAL(14,3) NOT NULL,
    "pricePerTonne" DECIMAL(18,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ARS',
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GrainStock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GrainStock_workspaceId_grain_key" ON "GrainStock"("workspaceId", "grain");
ALTER TABLE "GrainStock" ADD CONSTRAINT "GrainStock_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
