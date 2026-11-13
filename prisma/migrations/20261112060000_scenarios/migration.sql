-- Escenarios guardados del Simulador (solo agrega)
CREATE TABLE "Scenario" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Scenario_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Scenario_workspaceId_idx" ON "Scenario"("workspaceId");
ALTER TABLE "Scenario" ADD CONSTRAINT "Scenario_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
