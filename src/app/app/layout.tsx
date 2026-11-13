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
import { resendVerifyAction, verifyEmailCodeAction } from "@/app/actions/app";
import { emailEnabled } from "@/server/email-verify";
import { LogoMark } from "@/components/logo-mark";
import { AnnouncementBar } from "@/components/announcement-bar";

// La app es privada: nunca se indexa.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, workspace, modules, plan, membership } = await requireWorkspace();
  const db = getDb();
  // Mantenimiento (Panel → Sistema): una pantalla completa en vez de la app. El equipo del panel sí entra, para revisar.
  const [sys, role] = await Promise.all([systemSettings(db), roleFor(db, user.email)]);
  if (sys.maintenance && !role) {
    return (
      <main className="maint" role="main">
        <div className="maint-box">
          <LogoMark className="maint-logo" />
          <h1>Volvemos enseguida</h1>
          <p>{sys.maintenanceMsg}</p>
          <span className="maint-pulse" aria-hidden="true"><i /><i /><i /></span>
          <form action={logoutAction}><button className="btn" type="submit">Cerrar sesión</button></form>
        </div>
      </main>
    );
  }
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
  const [overdue, ann] = await Promise.all([
    db.obligation.count({ where: { workspaceId: workspace.id, status: { in: ["PENDING", "PARTIAL"] }, dueDate: { lt: today } } }),
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
      {notice && <AnnouncementBar text={notice.text} tone={notice.tone} link={notice.link} />}
      {sharedView && (
        <div className="notice b app-ann" role="status">
          <Icon name="user" />
          <span>Estás viendo el espacio de {ownerOf(workspace.id)}{membership.role === "VIEWER" ? " (solo mirar)" : ""}. Cambiás al tuyo desde el menú de tu cuenta.</span>
        </div>
      )}
      {/* Confirmar el correo: solo si los correos están configurados (si no, prometería algo que no llega).
          A los 3 días sin confirmar, el aviso se vuelve más visible y explica qué te perdés. */}
      {!user.emailVerified && emailEnabled() && (() => {
        const days = Math.floor((Date.now() - user.createdAt.getTime()) / 864e5);
        const late = days >= 3;
        return (
          <div className={`vbanner ${late ? "late" : ""}`} role="status">
            <span className="vbanner-ic" aria-hidden="true"><Icon name="info" /></span>
            <div className="vbanner-body">
              <span className="vbanner-txt">
                <b>{late ? `Hace ${days} días que no confirmás tu correo` : "Confirmá tu correo"}</b>
                <span>{late ? "Sin confirmarlo no vas a poder pagar Pro, invitar a alguien ni recibir avisos por correo. " : "Así podés pagar Pro, invitar a alguien y recuperar la contraseña. "}Te mandamos un código a <b className="vbanner-mail">{user.email}</b>.</span>
              </span>
              <div className="vbanner-acts">
                <ActionForm action={verifyEmailCodeAction} className="vbanner-code">
                  <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={7} placeholder="000000" aria-label="Código de 6 números" />
                  <Submit className="btn sm pri" pending="Confirmando…">Confirmar</Submit>
                </ActionForm>
                <ActionForm action={resendVerifyAction}><Submit className="btn sm ghost" pending="Enviando…">Mandame otro código</Submit></ActionForm>
              </div>
            </div>
          </div>
        );
      })()}
      {sys.maintenance && <div className="notice a app-ann" role="status"><Icon name="info" /><span>Modo mantenimiento activo: las personas ven la pantalla de “Volvemos enseguida”. Vos entrás porque sos del equipo.</span></div>}
      {children}
    </Shell></>
  );
}
