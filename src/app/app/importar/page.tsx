import Link from "next/link";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { PageHead, SettingsTabs } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { importAction, revertImportAction } from "@/app/actions/modules";
import { ConfirmSubmit } from "@/components/confirm-submit";

export const metadata: Metadata = { title: "Importar y exportar" };

export default async function ImportExport({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const pro = await canUse(plan, "informes");
  const sp = await searchParams;
  const db = getDb();
  const [accounts, batches] = await Promise.all([
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: { createdAt: "asc" } }),
    db.importBatch.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return (
    <>
      <PageHead crumb="Configuración" title="Importar y exportar" desc="Traé movimientos desde la planilla o el extracto de tu banco. Cada importación se puede deshacer entera." />
      <SettingsTabs current="importar" />
      {sp.ok && <div className="notice g">Listo, importamos los movimientos.</div>}
      <div className="card">
        <div className="chead"><h3>Importar un archivo</h3></div>
        {accounts.length ? (
          <ActionForm action={importAction} style={{ display: "flex", flexDirection: "column", gap: 14, maxWidth: 560 }}>
            <label className="field">Archivo<input type="file" name="file" accept=".csv,.xlsx,.ofx,.qfx,text/csv,text/plain" required /></label>
            <label className="field">Cuenta de los movimientos<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label>
            <p className="sub" style={{ margin: 0 }}>CSV, Excel (.xlsx) u OFX del banco. Tiene que tener fecha, concepto e importe (o entradas y salidas en columnas separadas, como el extracto de Mercado Pago). Los importes negativos son gastos y los positivos, ingresos. Las filas que ya estaban cargadas se saltean.{pro ? "" : " Excel y OFX son parte de Pro."}</p>
            <p className="sub" style={{ margin: 0 }}>Primero tocá <b>Revisar</b>: te decimos cuántos movimientos vamos a cargar, sin guardar nada. Si está bien, tocá <b>Importar</b>.</p>
            <div className="acts"><button className="btn" type="submit" name="confirm" value="0">Revisar</button><Submit pending="Importando…" name="confirm" value="1">Importar</Submit></div>
          </ActionForm>
        ) : <div className="empty">Primero creá una cuenta para los movimientos.</div>}
      </div>
      {batches.length > 0 && (
        <div className="card">
          <div className="chead"><h3>Importaciones</h3></div>
          <div className="list">
            {batches.map((b) => (
              <div className="li" key={b.id}>
                <div className="grow"><div className="t">{b.fileName}</div><div className="s">{fmtDate(b.createdAt)} · {b.rows} movimientos{b.status === "REVERTED" ? " · deshecha" : ""}</div></div>
                {b.status !== "REVERTED" && <form action={revertImportAction}><input type="hidden" name="id" value={b.id} /><ConfirmSubmit question="¿Deshacer esta importación? Se anulan sus movimientos." yes="Sí, deshacer">Deshacer</ConfirmSubmit></form>}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        <div className="chead"><h3>Exportar</h3></div>
        <p className="sub" style={{ margin: "0 0 12px", fontSize: 14 }}>Tus datos son tuyos. Descargalos cuando quieras.</p>
        <div className="acts">
          <a className="btn" href="/app/exportar/movimientos" download>Movimientos (CSV para Excel)</a>
          {pro ? <a className="btn" href="/app/exportar/excel" download>Movimientos (Excel)</a> : <Link className="btn" href="/app/configuracion?tab=plan">Excel · Pro</Link>}
          {pro ? <Link className="btn" href="/reporte">Reporte del mes (PDF)</Link> : <Link className="btn" href="/app/configuracion?tab=plan">PDF · Pro</Link>}
          <a className="btn" href="/app/exportar/respaldo" download>Respaldo completo (JSON)</a>
        </div>
      </div>
    </>
  );
}
