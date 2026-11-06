import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { cardOverview, cardStatus } from "@/server/cards";
import { formatMoney } from "@/lib/money";
import { fmtDate, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createCardAction } from "@/app/actions/modules";
import { CURRENCIES } from "@/lib/countries";

export const metadata: Metadata = { title: "Tarjetas" };

export default async function Cards() {
  const { workspace } = await requireWorkspace();
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [cards, accounts] = await Promise.all([cardOverview(db, workspace.id, today), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } })]);
  const statuses = await Promise.all(cards.map((c) => cardStatus(db, workspace.id, c.card.id, today)));
  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Tarjetas de crédito" desc="Cada compra se cuenta una sola vez, en su categoría y su mes. Pagar el resumen no es otro gasto." />
      {cards.length > 0 && (
        <div className="grid g2">{cards.map((c, i) => { const st = statuses[i]; const next = st.open[0]; return (
          <Link key={c.card.id} href={`/app/tarjetas/${c.card.id}`} className="card dcard tcard-mini" style={{ textDecoration: "none", color: "inherit" }}>
            <div className="ccard" style={{ maxWidth: 240 }}><div className="row"><span>{c.card.issuer || "Tarjeta"}</span></div><div className="nm">•••• {c.card.last4 ?? "····"}</div><div className="row"><span>{c.card.name}</span></div></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
              <div className="sub" style={{ margin: 0 }}>{!next ? "Al día" : st.overdue ? `Atrasado · venció el ${fmtDate(next.dueDate)}` : `A pagar · vence el ${fmtDate(next.dueDate)}`}</div>
              <b className={`num ${st.overdue ? "neg" : !next ? "pos" : ""}`} style={{ fontSize: 22, fontWeight: 400 }}>{next ? formatMoney(st.owed, c.card.currency) : "Sin resúmenes sin pagar"}</b>
              <div className="sub">Debés en total {formatMoney(c.debt, c.card.currency)} · próximo resumen {formatMoney(c.nextAmount, c.card.currency)}</div>
              <div className="sub">Disponible {formatMoney(c.available, c.card.currency)}</div>
              {!c.card.statements.length && !next && <div className="sub" style={{ color: "var(--blue)" }}>¿Ya debías algo? Cargá tu último resumen →</div>}
            </div>
          </Link>
        ); })}</div>
      )}
      <div className="card">
        <details className="more" open={cards.length === 0}>
          <summary>+ Nueva tarjeta</summary>
          <ActionForm action={createCardAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <div className="frow"><label className="field">Nombre<input name="name" placeholder="Ej.: Visa Galicia" /></label><label className="field">Banco o emisor<input name="issuer" placeholder="Ej.: Banco Galicia" /></label></div>
            <div className="frow"><label className="field">Últimos 4 números (opcional)<input name="last4" inputMode="numeric" maxLength={4} placeholder="1234" /></label><label className="field">Límite<input name="limit" inputMode="decimal" placeholder="0,00" /></label></div>
            <div className="frow"><label className="field">Día de cierre<input name="closingDay" inputMode="numeric" placeholder="Ej.: 26" /></label><label className="field">Día de vencimiento<input name="dueDay" inputMode="numeric" placeholder="Ej.: 7" /></label></div>
            <div className="frow"><label className="field">Moneda<select name="currency" defaultValue={workspace.baseCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code}</option>)}</select></label><label className="field">Se paga desde<select name="payAccountId">{accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></label></div>
            <div><Submit>Crear tarjeta</Submit></div>
          </ActionForm>
        </details>
      </div>
    </>
  );
}
