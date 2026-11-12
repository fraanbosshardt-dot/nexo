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
import { switchWorkspaceAction } from "@/app/actions/sharing";
import { resendVerifyAction } from "@/app/actions/app";

// La app es privada: nunca se indexa.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, modules, plan, membership } = await requireWorkspace();
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
  // Espacios para elegir (el propio y los compartidos), con el nombre de quien los comparte.
  const others = user.memberships.filter((m) => m.role !== "OWNER");
  const owners = others.length ? await db.membership.findMany({ where: { workspaceId: { in: others.map((m) => m.workspaceId) }, role: "OWNER" }, select: { workspaceId: true, user: { select: { name: true } } } }) : [];
  const ownerOf = (wsId: string) => owners.find((o) => o.workspaceId === wsId)?.user.name.split(" ")[0] ?? "otra persona";
  const spaces = user.memberships.map((m) => ({ id: m.workspaceId, label: m.role === "OWNER" ? "Tu espacio" : `Espacio de ${ownerOf(m.workspaceId)}`, active: m.workspaceId === workspace.id }));
  const sharedView = membership.role !== "OWNER";
  return (
    <><BigTextSync saved={user.bigText ?? null} />
    <Shell spaces={spaces} switchSpace={switchWorkspaceAction} modules={modules} overdue={overdue} userName={user.name} plan={plan} isAdmin={!!role} logout={logoutAction}>
      {notice && (
        <div className={`notice ${notice.tone === "warn" ? "a" : "b"} app-ann`} role="status">
          <Icon name={notice.tone === "warn" ? "info" : "spark"} />
          <span>{notice.text}{notice.link && <> <a className="lnk" href={notice.link}>Ver más</a></>}</span>
        </div>
      )}
      {sharedView && (
        <div className="notice b app-ann" role="status">
          <Icon name="user" />
          <span>Estás viendo el espacio de {ownerOf(workspace.id)}{membership.role === "VIEWER" ? " (solo mirar)" : ""}. Cambiás al tuyo desde el menú de tu cuenta.</span>
        </div>
      )}
      {!user.emailVerified && (
        <div className="vbanner" role="status">
          <span className="vbanner-ic" aria-hidden="true"><Icon name="info" /></span>
          <ActionForm action={resendVerifyAction} className="vbanner-body">
            <span className="vbanner-txt"><b>Confirmá tu correo</b><span>Te mandamos un enlace a <b className="vbanner-mail">{user.email}</b>. Así recibís avisos y podés recuperar la contraseña.</span></span>
            <Submit className="btn sm pri" pending="Enviando…">Mandame el enlace</Submit>
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
