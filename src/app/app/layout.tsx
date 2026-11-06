import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { logoutAction } from "@/app/actions/auth";
import { materialize } from "@/server/recurring";
import { closeStatements } from "@/server/cards";
import { MATERIALIZE_DAYS } from "@/server/forecast";

// La app es privada: nunca se indexa.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, modules, plan } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  // Pendientes de reglas recurrentes y resúmenes de tarjeta ya cerrados: se generan solos y sin duplicar.
  await materialize(db, workspace.id, new Date(today.getTime() + MATERIALIZE_DAYS * 864e5));
  await closeStatements(db, workspace.id, today);
  const overdue = await db.obligation.count({ where: { workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today } } });
  return (
    <Shell modules={modules} overdue={overdue} userName={user.name} plan={plan} isAdmin={user.isAdmin || (process.env.ADMIN_EMAILS ?? "").toLowerCase().split(",").map((e) => e.trim()).includes(user.email)} logout={logoutAction}>
      {children}
    </Shell>
  );
}
