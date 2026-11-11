import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { systemSettings } from "@/server/settings";
import { billingConfig } from "@/server/billing";
import { emailEnabled } from "@/lib/email";
import { googleEnabled } from "@/lib/auth/google";
import { PageHead } from "@/components/page";
import { Stats, actionName, int, when } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Sistema y seguridad" };
export const dynamic = "force-dynamic";

export default async function SystemPage() {
  await requireAdmin();
  const db = getDb();
  const bill = await billingConfig(db);
  const t0 = performance.now();
  await db.$queryRaw`SELECT 1`;
  const dbMs = Math.round(performance.now() - t0);
  const day = new Date(Date.now() - 864e5);
  const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const [cron, lastRate, pdf, failedLogins, failed2fa, deniedAdmin, problems, suspicious, sys] = await Promise.all([
    db.auditLog.findFirst({ where: { action: { in: ["cron.diario", "cron.failed"] } }, orderBy: { createdAt: "desc" } }),
    db.exchangeRate.findFirst({ where: { workspaceId: null }, orderBy: { fetchedAt: "desc" } }),
    db.auditLog.count({ where: { action: "card.pdf_read", createdAt: { gte: monthStart } } }),
    db.auditLog.count({ where: { action: "auth.login_failed", createdAt: { gte: day } } }),
    db.auditLog.count({ where: { action: "auth.2fa_failed", createdAt: { gte: day } } }),
    db.auditLog.count({ where: { action: "admin.login_denied", createdAt: { gte: new Date(Date.now() - 30 * 864e5) } } }),
    db.auditLog.findMany({ where: { OR: [{ action: { contains: "failed" } }, { action: { contains: "denied" } }] }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.auditLog.groupBy({ by: ["ip"], where: { action: "auth.login_failed", createdAt: { gte: day }, ip: { not: null } }, _count: { _all: true }, having: { ip: { _count: { gte: 5 } } } }),
    systemSettings(db),
  ]);
  const cronAge = cron ? (Date.now() - cron.createdAt.getTime()) / 36e5 : null;
  const rateAge = lastRate ? (Date.now() - lastRate.fetchedAt.getTime()) / 36e5 : null;
  const ok = (good: boolean, text: string) => <span className={`pill ${good ? "g" : "r"}`}>{text}</span>;
  return (
    <>
      <PageHead title="Sistema y seguridad" desc="Si todo funciona y si alguien está intentando entrar donde no debe." />
      {sys.maintenance && <p className="notice a">La app está en modo mantenimiento: los clientes ven el aviso en lugar de sus pantallas. Se cambia en Ajustes.</p>}
      <div className="grid g2">
        <div className="card">
          <div className="chead"><h3>Estado</h3></div>
          <dl className="kv">
            <dt>Base de datos</dt><dd>{ok(dbMs < 800, `Responde en ${dbMs} ms`)}</dd>
            <dt>Tarea diaria</dt><dd>{cron ? ok(cron.action === "cron.diario" && (cronAge ?? 99) < 30, `${cron.action === "cron.failed" ? "Falló" : "Corrió"} ${when(cron.createdAt)}`) : ok(false, "Todavía no corrió")}</dd>
            <dt>Cotizaciones</dt><dd>{lastRate ? ok((rateAge ?? 99) < 36, `Del ${when(lastRate.fetchedAt)}`) : ok(false, "Sin datos")}</dd>
            <dt>Lecturas de PDF este mes</dt><dd>{int(pdf)} (límite {sys.pdfLimit} por cliente)</dd>
            <dt>Correos (Resend)</dt><dd>{ok(emailEnabled(), emailEnabled() ? "Activado" : "Falta la clave")}</dd>
            <dt>Cobros (Mercado Pago)</dt><dd>{ok(bill.enabled, bill.enabled ? "Activado" : "Falta configurar")}</dd>
            <dt>Ingreso con Google</dt><dd>{ok(googleEnabled(), googleEnabled() ? "Activado" : "Falta configurar")}</dd>
          </dl>
        </div>
        <div className="card">
          <div className="chead"><h3>Seguridad</h3><span className="sub">Últimas 24 horas</span></div>
          <Stats items={[["Contraseñas incorrectas", int(failedLogins)], ["Códigos de dos pasos mal", int(failed2fa)], ["Intentos al panel sin permiso", int(deniedAdmin), "últimos 30 días"]]} />
          {suspicious.length > 0 ? (
            <div className="notice r" style={{ marginTop: 12 }}><span><b>Conexiones con muchos intentos fallidos:</b> {suspicious.map((s) => `${s.ip} (${s._count._all})`).join(", ")}. El sistema frena cada correo después de 8 intentos en 15 minutos.</span></div>
          ) : <p className="adm-hint" style={{ marginTop: 12 }}>No hay conexiones sospechosas.</p>}
        </div>
      </div>
      <div className="card">
        <div className="chead"><h3>Últimos problemas</h3></div>
        {problems.length ? <div className="tw"><table>
          <thead><tr><th>Cuándo</th><th>Qué pasó</th><th>Sobre</th><th>Conexión</th></tr></thead>
          <tbody>{problems.map((p) => <tr key={p.id}><td style={{ whiteSpace: "nowrap" }}>{when(p.createdAt)}</td><td>{actionName(p.action)}</td><td>{p.entityId ?? "—"}</td><td>{p.ip ?? "—"}</td></tr>)}</tbody>
        </table></div> : <div className="empty">Sin problemas registrados.</div>}
      </div>
    </>
  );
}
