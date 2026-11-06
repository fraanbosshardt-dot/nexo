import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate, isoDate, todayIn } from "@/lib/dates";
import { nextOccurrence } from "@/server/recurring";
import { Empty, PageHead, SettingsTabs } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { changeRuleAction, createRuleAction, endRuleAction, pauseRuleAction } from "@/app/actions/modules";

export const metadata: Metadata = { title: "Pagos que se repiten" };

const FREQ: Record<string, string> = { DAILY: "Todos los días", WEEKLY: "Cada semana", BIWEEKLY: "Cada 2 semanas", MONTHLY: "Todos los meses", BIMONTHLY: "Cada 2 meses", QUARTERLY: "Cada 3 meses", SEMIANNUAL: "Cada 6 meses", ANNUAL: "Una vez por año", CUSTOM: "Personalizada" };

export default async function Rules({ searchParams }: { searchParams: Promise<{ nueva?: string }> }) {
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [rules, accounts, cats] = await Promise.all([
    db.recurringRule.findMany({ where: { workspaceId: workspace.id, OR: [{ endDate: null }, { endDate: { gte: today } }] }, orderBy: { createdAt: "desc" } }),
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { not: "CREDIT_CARD" } }, select: { id: true, name: true, currency: true } }),
    db.category.findMany({ where: { workspaceId: workspace.id, parentId: null }, orderBy: { name: "asc" } }),
  ]);
  const open = (await searchParams).nueva === "1" || rules.length === 0;
  return (
    <>
      <PageHead crumb="Configuración" title="Pagos que se repiten" desc="Sueldos, servicios y cuotas que se repiten solos. También las podés crear al cargar un movimiento, con “¿Se repite?”." />
      <SettingsTabs current="recurrentes" />
      <div className="card">
        {rules.length ? (
          <div className="list">{rules.map((r) => {
            const next = nextOccurrence(r, today);
            return (
              <div className="li" key={r.id} style={{ flexWrap: "wrap" }}>
                <div className="grow" style={{ minWidth: 200 }}>
                  <div className="t">{r.description} {r.pausedAt && <span className="pill">Pausada</span>}</div>
                  <div className="s">{FREQ[r.frequency]}{r.dayOfMonth ? ` · día ${r.dayOfMonth}` : ""}{r.variableAmount ? " · importe variable" : ""}{next ? ` · próxima: ${fmtDate(next)}` : ""}{r.endDate ? ` · hasta ${fmtDate(r.endDate)}` : ""}</div>
                </div>
                <b className={`num ${r.direction === "RECEIVABLE" ? "pos" : ""}`}>{formatMoney(r.direction === "RECEIVABLE" ? r.amount : r.amount.neg(), r.currency, { sign: true })}</b>
                <details className="more" style={{ width: "100%" }}>
                  <summary>Cambiar</summary>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                    <ActionForm action={changeRuleAction} style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
                      <input type="hidden" name="id" value={r.id} />
                      <label className="field" style={{ flex: "1 1 160px" }}>Importe nuevo<input name="amount" inputMode="decimal" defaultValue={r.amount.toFixed(2).replace(".", ",")} /></label>
                      <label className="field" style={{ flex: "1 1 160px" }}>Desde<input name="from" type="date" defaultValue={isoDate(today)} /></label>
                      <Submit className="btn">Cambiar desde esa fecha</Submit>
                    </ActionForm>
                    <p className="sub">Lo anterior no cambia: los meses pasados quedan como estaban.</p>
                    <div className="acts">
                      <form action={pauseRuleAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="pause" value={r.pausedAt ? "0" : "1"} /><button className="btn sm" type="submit">{r.pausedAt ? "Reanudar" : "Pausar"}</button></form>
                      <form action={endRuleAction}><input type="hidden" name="id" value={r.id} /><button className="btn sm ghost" style={{ color: "var(--red)" }} type="submit">Terminar</button></form>
                    </div>
                  </div>
                </details>
              </div>
            );
          })}</div>
        ) : <Empty>Todavía no tenés reglas. Creá la primera abajo.</Empty>}
      </div>
      <div className="card">
        <details className="more" open={open}>
          <summary>+ Nueva regla</summary>
          <ActionForm action={createRuleAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <div className="frow"><label className="field">Tipo<select name="direction" defaultValue="PAYABLE"><option value="PAYABLE">Gasto (pago)</option><option value="RECEIVABLE">Ingreso (cobro)</option></select></label><label className="field">Concepto<input name="description" placeholder="Ej.: Expensas" /></label></div>
            <div className="frow"><label className="field">Importe<input name="amount" inputMode="decimal" placeholder="0,00" /></label><label className="field">Cuenta<select name="accountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name} ({a.currency})</option>)}</select></label></div>
            <div className="frow"><label className="field">Frecuencia<select name="frequency" defaultValue="MONTHLY">{Object.entries(FREQ).filter(([k]) => k !== "CUSTOM").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label><label className="field">Primera vez<input name="startDate" type="date" defaultValue={isoDate(today)} /></label></div>
            <div className="frow"><label className="field">Categoría<select name="categoryId" defaultValue=""><option value="">Sin categoría</option>{cats.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.kind === "INCOME" ? "ingreso" : "gasto"}</option>)}</select></label><label className="field">Si cae sábado o domingo<select name="weekendRule" defaultValue="NONE"><option value="NONE">Dejar la fecha</option><option value="NEXT_BUSINESS_DAY">Pasar al lunes</option><option value="PREVIOUS_BUSINESS_DAY">Adelantar al viernes</option></select></label></div>
            <details className="more"><summary>Más opciones</summary>
              <div style={{ display: "flex", flexDirection: "column", gap: 10, paddingTop: 8 }}>
                <div className="frow"><label className="field">Hasta (opcional)<input name="endDate" type="date" /></label><label className="field">Día del mes (opcional)<input name="dayOfMonth" inputMode="numeric" placeholder="Ej.: 10" /></label></div>
                <div className="frow"><label className="field">Aumento programado (%)<input name="increasePct" inputMode="decimal" placeholder="Ej.: 6" /></label><label className="field">Cada cuántos meses<input name="increaseEvery" inputMode="numeric" placeholder="Ej.: 3" /></label></div>
                <label className="simtg"><input type="checkbox" name="variable" /><span>El importe cambia cada vez</span></label>
              </div>
            </details>
            <div><Submit>Crear regla</Submit></div>
          </ActionForm>
        </details>
      </div>
    </>
  );
}
