import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { nextOccurrence } from "@/server/recurring";
import { Empty, PageHead, SettingsTabs } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { changeRuleAction, createRuleAction, deleteRuleAction, endRuleAction, pauseRuleAction, setRuleEndAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Pagos que se repiten" };

const FREQ: Record<string, string> = { DAILY: "Todos los días", WEEKLY: "Cada semana", BIWEEKLY: "Cada 2 semanas", MONTHLY: "Todos los meses", BIMONTHLY: "Cada 2 meses", QUARTERLY: "Cada 3 meses", SEMIANNUAL: "Cada 6 meses", ANNUAL: "Una vez por año", CUSTOM: "Personalizada" };
const MONTHLY_LIKE = ["MONTHLY", "BIMONTHLY", "QUARTERLY", "SEMIANNUAL", "ANNUAL"];

export default async function Rules({ searchParams }: { searchParams: Promise<{ nueva?: string; borrada?: string; terminada?: string }> }) {
  const { workspace } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [all, accounts, cats] = await Promise.all([
    db.recurringRule.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" } }),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { not: "CREDIT_CARD" } }, select: { id: true, name: true, currency: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, parentId: null }, orderBy: { name: "asc" } }),
  ]);
  // Activas: sin fin o con fin en el futuro. Terminadas: fin hoy o antes (salvo las que se reemplazaron por una versión nueva).
  const replaced = new Set(all.map((r) => r.previousVersionId).filter(Boolean));
  const rules = all.filter((r) => !r.endDate || r.endDate > today);
  const ended = all.filter((r) => r.endDate && r.endDate <= today && !replaced.has(r.id));
  const open = sp.nueva === "1" || rules.length === 0;

  const row = (r: (typeof all)[number], active: boolean) => {
    const next = active ? nextOccurrence(r, today) : null;
    return (
      <div className="li" key={r.id} style={{ flexWrap: "wrap" }}>
        <div className="grow" style={{ minWidth: 200 }}>
          <div className="t">{r.description} {r.pausedAt && <span className="pill">Pausada</span>}{!active && <span className="pill">Terminada</span>}</div>
          <div className="s">{FREQ[r.frequency]}{r.dayOfMonth ? ` · día ${r.dayOfMonth}` : ""}{r.variableAmount ? " · importe variable" : ""}{next ? ` · próxima: ${fmtDate(next)}` : ""}{r.endDate ? ` · ${active ? "hasta" : "terminó el"} ${fmtDate(r.endDate)}` : " · sin fecha de fin"}</div>
        </div>
        <b className={`num ${r.direction === "RECEIVABLE" ? "pos" : ""}`}>{formatMoney(r.direction === "RECEIVABLE" ? r.amount : r.amount.neg(), r.currency, { sign: true })}</b>
        <details className="more" style={{ width: "100%" }}>
          <summary>{active ? "Cambiar, terminar o borrar" : "Opciones"}</summary>
          <div className="rule-opts">
            {active && (
              <>
                <section>
                  <h4>Cambiar desde una fecha</h4>
                  <p className="sub">Desde esa fecha cambia el importe y, si querés, el día. Lo anterior queda como estaba.</p>
                  <ActionForm action={changeRuleAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <label className="field" style={{ flex: "1 1 140px" }}>Importe<input name="amount" inputMode="decimal" defaultValue={r.amount.toFixed(2).replace(".", ",")} /></label>
                    {MONTHLY_LIKE.includes(r.frequency) && <label className="field" style={{ flex: "0 1 120px" }}>Día del mes<input name="dayOfMonth" inputMode="numeric" defaultValue={r.dayOfMonth ?? r.startDate.getUTCDate()} /></label>}
                    <label className="field" style={{ flex: "1 1 150px" }}>Desde<input name="from" type="date" defaultValue={isoDate(next ?? today)} /></label>
                    <Submit className="btn">Cambiar</Submit>
                  </ActionForm>
                </section>
                <section>
                  <h4>Hasta cuándo se repite</h4>
                  <ActionForm action={setRuleEndAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
                    <input type="hidden" name="id" value={r.id} />
                    <label className="field" style={{ flex: "1 1 160px" }}>Hasta (vacío = sin fin)<input name="endDate" type="date" defaultValue={r.endDate ? isoDate(r.endDate) : ""} /></label>
                    <Submit className="btn">Guardar</Submit>
                  </ActionForm>
                </section>
                <section>
                  <h4>Pausar o terminar</h4>
                  <p className="sub"><b>Pausar</b>: deja de aparecer hasta que la reanudes. <b>Terminar</b>: deja de repetirse desde hoy y pasa a "Terminadas"; lo que ya pagaste o cobraste queda igual.</p>
                  <div className="acts">
                    <form action={pauseRuleAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="pause" value={r.pausedAt ? "0" : "1"} /><button className="btn sm" type="submit">{r.pausedAt ? "Reanudar" : "Pausar"}</button></form>
                    <form action={endRuleAction}><input type="hidden" name="id" value={r.id} /><button className="btn sm" type="submit">Terminar desde hoy</button></form>
                  </div>
                </section>
              </>
            )}
            <section>
              <h4>Borrar</h4>
              <p className="sub">Se borra la regla y sus próximos pendientes. Lo que ya pagaste o cobraste queda en tus movimientos.</p>
              <form action={deleteRuleAction}><input type="hidden" name="id" value={r.id} /><button className="btn sm danger" type="submit">Borrar "{r.description}"</button></form>
            </section>
          </div>
        </details>
      </div>
    );
  };

  return (
    <>
      <PageHead crumb="Configuración" title="Pagos que se repiten" desc="Sueldos, servicios, cuotas y cosechas que se repiten solos. Son los que el flujo de caja proyecta a futuro." />
      <SettingsTabs current="recurrentes" />
      {sp.borrada && <p className="notice g" role="status">Listo, se borró. Lo ya pagado o cobrado quedó en tus movimientos.</p>}
      {sp.terminada && <p className="notice g" role="status">Listo, dejó de repetirse desde hoy. La ves abajo, en Terminadas.</p>}
      <div className="card">
        {rules.length ? <div className="list">{rules.map((r) => row(r, true))}</div> : <Empty>Todavía no tenés pagos que se repiten. Creá el primero abajo.</Empty>}
      </div>
      <div className="card">
        <details className="more" open={open}>
          <summary>+ Nuevo pago o cobro que se repite</summary>
          <ActionForm action={createRuleAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <div className="frow"><label className="field">Tipo<select name="direction" defaultValue="PAYABLE"><option value="PAYABLE">Gasto (pago)</option><option value="RECEIVABLE">Ingreso (cobro)</option></select></label><label className="field">Concepto<input name="description" placeholder="Ej.: Expensas, Venta de soja" /></label></div>
            <div className="frow"><label className="field">Importe<input name="amount" inputMode="decimal" placeholder="0,00" /></label><label className="field">Cuenta<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label></div>
            <div className="frow"><label className="field">Frecuencia<select name="frequency" defaultValue="MONTHLY">{Object.entries(FREQ).filter(([k]) => k !== "CUSTOM").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label><label className="field">Primera vez<input name="startDate" type="date" defaultValue={isoDate(today)} /></label></div>
            <div className="frow"><label className="field">Hasta (opcional)<input name="endDate" type="date" /></label><label className="field">Categoría<select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.kind === "INCOME" ? "ingreso" : "gasto"}</option>)}</select></label></div>
            <details className="more"><summary>Más opciones</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                <div className="frow"><label className="field">Día del mes (opcional)<input name="dayOfMonth" inputMode="numeric" placeholder="Ej.: 10" /></label><label className="field">Si cae sábado o domingo<select name="weekendRule" defaultValue="NONE"><option value="NONE">Dejar la fecha</option><option value="NEXT_BUSINESS_DAY">Pasar al lunes</option><option value="PREVIOUS_BUSINESS_DAY">Adelantar al viernes</option></select></label></div>
                <div className="frow"><label className="field">Aumento programado (%)<input name="increasePct" inputMode="decimal" placeholder="Ej.: 6" /></label><label className="field">Cada cuántos meses<input name="increaseEvery" inputMode="numeric" placeholder="Ej.: 3" /></label></div>
                <label className="simtg"><input type="checkbox" name="variable" /><span>El importe cambia cada vez (por ejemplo, una cosecha)</span></label>
              </div>
            </details>
            <div><Submit>Crear</Submit></div>
          </ActionForm>
        </details>
      </div>
      {ended.length > 0 && (
        <div className="card">
          <details className="more"><summary>Terminadas ({ended.length})</summary>
            <div className="list" style={{ marginTop: 8 }}>{ended.map((r) => row(r, false))}</div>
          </details>
        </div>
      )}
    </>
  );
}
