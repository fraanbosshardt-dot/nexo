-- Contar movimientos por categoría sin recorrer todos (solo agrega un índice)
CREATE INDEX IF NOT EXISTS "Transaction_workspaceId_categoryId_idx" ON "Transaction"("workspaceId", "categoryId");
