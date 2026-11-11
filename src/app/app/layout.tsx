import type { Metadata } from "next";
import { Shell } from "@/components/shell";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { todayIn } from "@/lib/dates";
import { logoutAction } from "@/app/actions/auth";
import { materialize } from "@/server/recurring";
import { closeStatements } from "@/server/cards";
import { coverOlderSales } from "@/server/grain";
import { MATERIALIZE_DAYS } from "@/server/forecast";
import { roleFor } from "@/server/admin-team";
import { announcement, announcementFor, systemSettings } from "@/server/settings";
import { Icon } from "@/components/icons";
import { ActionForm, Submit } from "@/components/forms";
import { BigTextSync } from "@/components/big-text";
import { resendVerifyAction } from "@/app/actions/app";

// La app es privada: nunca se indexa.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, modules, plan } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  // Pendientes de reglas recurrentes y resúmenes de tarjeta ya cerrados: se generan solos y sin duplicar.
  // Pendientes de reglas y resúmenes cerrados: se recalculan al cambiar el día o cada 15 minutos, no en cada página.
  // Las acciones que crean reglas o cargan resúmenes ya los generan en el momento.
  const kept = workspace.housekeptAt;
  if (!kept || kept < today || Date.now() - kept.getTime() > 15 * 60_000) {
    await materialize(db, workspace.id, new Date(today.getTime() + MATERIALIZE_DAYS * 864e5));
    await closeStatements(db, workspace.id, today);
    // Ventas de cereal cargadas antes de la venta mensual: su mes no se cuenta dos veces (no hace nada si ya está).
    if (modules.cereal) await coverOlderSales(db, workspace.id, today);
    await db.workspace.update({ where: { id: workspace.id }, data: { housekeptAt: new Date() } });
  }
  const [overdue, role, sys, ann] = await Promise.all([
    db.obligation.count({ where: { workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today } } }),
    roleFor(db, user.email),
    systemSettings(db),
    announcement(db),
  ]);
  const notice = announcementFor(ann, plan);
  return (
    <><BigTextSync saved={user.bigText ?? null} />
    <Shell modules={modules} overdue={overdue} userName={user.name} plan={plan} isAdmin={!!role} logout={logoutAction}>
      {notice && (
        <div className={`notice ${notice.tone === "warn" ? "a" : "b"} app-ann`} role="status">
          <Icon name={notice.tone === "warn" ? "info" : "spark"} />
          <span>{notice.text}{notice.link && <> <a className="lnk" href={notice.link}>Ver más</a></>}</span>
        </div>
      )}
      {!user.emailVerified && (
        <div className="notice a app-ann" role="status">
          <Icon name="info" />
          <ActionForm action={resendVerifyAction} className="verify-ann">
            <span>Confirmá tu correo ({user.email}) para recibir avisos y poder recuperar la contraseña.</span>
            <Submit className="btn sm" pending="Enviando…">Mandame el enlace</Submit>
          </ActionForm>
        </div>
      )}
      {sys.maintenance ? (
        <div className="empty" style={{ padding: "48px 24px" }}>
          <h2 style={{ margin: "0 0 8px", fontWeight: 400 }}>Volvemos enseguida</h2>
          <p style={{ margin: 0 }}>{sys.maintenanceMsg}</p>
        </div>
      ) : children}
    </Shell></>
  );
}
