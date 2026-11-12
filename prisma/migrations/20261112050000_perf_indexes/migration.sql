-- Índices para las búsquedas más frecuentes (solo agrega índices, no toca datos)
CREATE INDEX IF NOT EXISTS "Transaction_accountId_type_effectiveDate_idx" ON "Transaction"("accountId", "type", "effectiveDate");
CREATE INDEX IF NOT EXISTS "Transaction_workspaceId_type_economicPeriod_idx" ON "Transaction"("workspaceId", "type", "economicPeriod");
CREATE INDEX IF NOT EXISTS "Transaction_reversalOfId_idx" ON "Transaction"("reversalOfId");
CREATE INDEX IF NOT EXISTS "Obligation_workspaceId_sourceType_sourceId_idx" ON "Obligation"("workspaceId", "sourceType", "sourceId");
CREATE INDEX IF NOT EXISTS "InstallmentPlan_cardId_idx" ON "InstallmentPlan"("cardId");
CREATE INDEX IF NOT EXISTS "DebtInstallment_obligationId_idx" ON "DebtInstallment"("obligationId");
CREATE INDEX IF NOT EXISTS "GoalContribution_goalId_idx" ON "GoalContribution"("goalId");
CREATE INDEX IF NOT EXISTS "InvestmentMovement_investmentId_idx" ON "InvestmentMovement"("investmentId");
CREATE INDEX IF NOT EXISTS "Valuation_investmentId_idx" ON "Valuation"("investmentId");
CREATE INDEX IF NOT EXISTS "Valuation_assetId_idx" ON "Valuation"("assetId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_entityId_createdAt_idx" ON "AuditLog"("action", "entityId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_action_ip_createdAt_idx" ON "AuditLog"("action", "ip", "createdAt");
