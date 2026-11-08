-- Recalcular pendientes recurrentes y resúmenes como mucho cada 15 minutos (antes era en cada página)
ALTER TABLE "Workspace" ADD COLUMN "housekeptAt" TIMESTAMP(3);
