import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { cardGroups } from "@/server/cards";
import { formatMoney } from "@/lib/money";
import { fmtDate, todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createCardAction } from "@/app/actions/modules";
import { CardFields } from "./card-fields";

export const metadata: Metadata = { title: "Tarjetas" };

export default async function Cards({ searchParams }: { searchParams: Promise<{ borrada?: string }> }) {
  const { workspace } = await requireWorkspace();
  const { borrada } = await searchParams;
  const db = getDb();
  const today = todayIn(workspace.timezone);
  const [cards, accounts] = await Promise.all([cardGroups(db, workspace.id, today), db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] })]);
  const active = cards.filter((c) => c.card.active), off = cards.filter((c) => !c.card.active);
  const tile = (c: (typeof cards)[number]) => {
    const st = c.status, next = st.open[0];
    const fm = (v: Parameters<typeof formatMoney>[0]) => formatMoney(v, c.card.currency);
    const ch = c.child, chNext = ch?.status.open[0];
    return (
      <Link key={c.card.id} href={`/app/tarjetas/${c.card.id}`} className="card dcard tcard-mini" style={{ textDecoration: "none", color: "inherit" }}>
        <div className="ccard" style={{ maxWidth: 240 }}><div className="row"><span>{c.card.issuer || "Tarjeta"}</span></div><div className="nm">•••• {c.card.last4 ?? "····"}</div><div className="row"><span>{c.card.name}</span></div></div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}>
          <div className="sub" style={{ margin: 0 }}>{!next && !chNext ? "Al día" : st.overdue || ch?.status.overdue ? `Atrasado · venció el ${fmtDate((next ?? chNext)!.dueDate)}` : `A pagar · vence el ${fmtDate((next ?? chNext)!.dueDate)}`}</div>
          <b className={`num ${st.overdue ? "neg" : !next && !chNext ? "pos" : ""}`} style={{ fontSize: 22, fontWeight: 400 }}>
            {next ? fm(st.owed) : !chNext ? "Sin resúmenes sin pagar" : ""}{chNext ? `${next ? " + " : ""}${formatMoney(ch!.status.owed, ch!.card.currency)}` : ""}
          </b>
          <div className="sub">Próximo resumen {fm(c.nextAmount)}{ch && ch.nextAmount.gt(0) ? ` + ${formatMoney(ch.nextAmount, ch.card.currency)}` : ""}</div>
          {c.usagePct != null && (
            <div title={`Usás el ${c.usagePct}% del límite`}>
              <div className="bar" style={{ maxWidth: 240 }}><i style={{ width: `${Math.min(100, c.usagePct)}%`, background: c.overAlert ? "var(--red)" : "var(--ink)" }} /></div>
              <div className={`sub ${c.overAlert ? "neg" : ""}`}>Usás el {c.usagePct}% del límite · disponible {fm(c.available)}</div>
            </div>
          )}
          {!c.card.statements.length && !next && <div className="sub" style={{ color: "var(--blue)" }}>¿Ya debías algo? Cargá tu último resumen →</div>}
        </div>
      </Link>
    );
  };
  return (
    <>
      <PageHead crumb="Pagos y deudas" title="Tarjetas de crédito" desc="Cada compra se cuenta una sola vez, en su categoría y su mes. Pagar el resumen no es otro gasto." />
      {borrada && <p className="notice g" role="status">Listo, eliminamos la tarjeta con sus compras y resúmenes.</p>}
      {active.length > 0 && <div className="grid g2">{active.map(tile)}</div>}
      <div className="card">
        <details className="more" open={cards.length === 0}>
          <summary>+ Nueva tarjeta</summary>
          <ActionForm action={createCardAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 640 }}>
            <CardFields accounts={accounts} base={workspace.baseCurrency} />
            <div><Submit>Crear tarjeta</Submit></div>
          </ActionForm>
        </details>
        {off.length > 0 && <details className="more"><summary>Tarjetas dadas de baja ({off.length})</summary><div className="grid g2" style={{ paddingTop: 10 }}>{off.map(tile)}</div></details>}
      </div>
    </>
  );
}
