// Creación del espacio de cada usuario, con categorías iniciales.
import type { PrismaClient } from "@/generated/prisma/client";
import { defaultModules } from "@/lib/modules";

export const DEFAULT_CATEGORIES: { kind: "INCOME" | "EXPENSE"; name: string; children?: string[] }[] = [
  { kind: "EXPENSE", name: "Vivienda", children: ["Alquiler", "Expensas", "Mantenimiento"] },
  { kind: "EXPENSE", name: "Alimentación", children: ["Supermercado", "Delivery"] },
  { kind: "EXPENSE", name: "Servicios", children: ["Luz", "Gas", "Internet", "Celular"] },
  { kind: "EXPENSE", name: "Transporte", children: ["Combustible", "Peajes"] },
  { kind: "EXPENSE", name: "Salud", children: ["Prepaga", "Farmacia"] },
  { kind: "EXPENSE", name: "Educación" },
  { kind: "EXPENSE", name: "Suscripciones" },
  { kind: "EXPENSE", name: "Entretenimiento" },
  { kind: "EXPENSE", name: "Impuestos" },
  { kind: "EXPENSE", name: "Seguros" },
  { kind: "EXPENSE", name: "Hogar" },
  { kind: "EXPENSE", name: "Extraordinarios" },
  { kind: "EXPENSE", name: "Otros" },
  { kind: "INCOME", name: "Sueldos", children: ["Sueldo", "Aguinaldo"] },
  { kind: "INCOME", name: "Honorarios" },
  { kind: "INCOME", name: "Alquileres" },
  { kind: "INCOME", name: "Ventas" },
  { kind: "INCOME", name: "Venta de cereal" },
  { kind: "INCOME", name: "Rendimientos" },
  { kind: "INCOME", name: "Reintegros" },
  { kind: "INCOME", name: "Otros" },
];

export async function createWorkspaceForUser(db: PrismaClient, userId: string, name = "Personal") {
  return db.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name,
        modules: defaultModules(),
        members: { create: { userId, role: "OWNER" } },
        subscription: { create: { plan: "FREE", status: "ACTIVE" } },
      },
    });
    for (const c of DEFAULT_CATEGORIES) {
      const parent = await tx.category.create({ data: { workspaceId: ws.id, kind: c.kind, name: c.name } });
      for (const child of c.children ?? []) {
        await tx.category.create({ data: { workspaceId: ws.id, kind: c.kind, name: child, parentId: parent.id } });
      }
    }
    return ws;
  });
}
