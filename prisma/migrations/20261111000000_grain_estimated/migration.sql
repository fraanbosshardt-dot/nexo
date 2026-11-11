-- Venta de cereal: "prevista" pasa a "estimada" (solo cambia el texto; no borra datos)
UPDATE "RecurringRule" SET "description" = 'Venta de cereal (estimada)' WHERE "description" = 'Venta de cereal (prevista)';
UPDATE "Obligation" SET "description" = 'Venta de cereal (estimada)' WHERE "description" = 'Venta de cereal (prevista)';
