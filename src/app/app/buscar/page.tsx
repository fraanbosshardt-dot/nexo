import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";
import { searchIds } from "@/server/search";

export const metadata: Metadata = { title: "Buscar" };

// Busca en movimientos, pendientes, cuentas, categorías, pagos que se repiten, deudas y ventas de cereal. Sin importar acentos.
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { workspace } = await requireWorkspace();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const db = getDb();
  const ws = workspace.id;
  const found = q.length >= 2 ? await searchIds(db, ws, q) : null;
  const inIds = (ids?: string[]) => ({ workspaceId: ws, id: { in: ids ?? [] } });
  const [tx, obl, accounts, cats, rules, debts, grain] = found ? await Promise.all([
    db.transaction.findMany({ where: inIds(found.tx), include: { account: true, category: true }, orderBy: { effectiveDate: "desc" } }),
    db.obligation.findMany({ where: inIds(found.obl), orderBy: { dueDate: "asc" } }),
    db.account.findMany({ where: inIds(found.accounts) }),
    db.category.findMany({ where: inIds(found.cats) }),
    db.recurringRule.findMany({ where: inIds(found.rules) }),
    db.debt.findMany({ where: inIds(found.debts) }),
    db.grainSale.findMany({ where: inIds(found.grain), orderBy: { saleDate: "desc" } }),
  ]) : [[], [], [], [], [], [], []];
  const total = tx.length + obl.length + accounts.length + cats.length + rules.length + debts.length + grain.length;
  return (
    <div className="narrow wide">
      <PageHead title="Buscar" />
      <form className="search" style={{ maxWidth: "none" }} role="search"><input name="q" defaultValue={q} placeholder="Buscar movimientos, cuentas, categorías…" aria-label="Buscar" autoFocus /></form>
      {q.length < 2 ? <p className="sub">Escribí al menos 2 letras.</p> : total === 0 ? <div className="empty">No encontramos nada con “{q}”.</div> : (
        <>
          {obl.length > 0 && <div className="card"><div className="chead"><h3>A pagar y a cobrar</h3></div><div className="list">{obl.map((o) => (
            <Link className="li" key={o.id} href={`/app/proximos/${o.id}`} style={{ color: "inherit" }}><div className="grow"><div className="t">{o.description}</div><div className="s">Vence el {fmtDate(o.dueDate)}</div></div><b className={`num ${o.direction === "RECEIVABLE" ? "pos" : "neg"}`}>{formatMoney(o.amount, o.currency)}</b></Link>
          ))}</div></div>}
          {tx.length > 0 && <div className="card"><div className="chead"><h3>Movimientos</h3></div><div className="list">{tx.map((t) => (
            <Link className="li" key={t.id} href={`/app/movimientos/${t.id}`} style={{ color: "inherit" }}><div className="grow"><div className="t">{t.description}</div><div className="s">{fmtDate(t.effectiveDate)} · {[t.category?.name, t.account.name].filter(Boolean).join(" · ")}</div></div><b className={`num ${t.type === "TRANSFER" ? "" : t.direction === "IN" ? "pos" : "neg"}`}>{t.direction === "IN" ? "+" : "−"}{formatMoney(t.amount, t.currency)}</b></Link>
          ))}</div></div>}
          {(accounts.length > 0 || cats.length > 0 || rules.length > 0 || debts.length > 0 || grain.length > 0) && <div className="card"><div className="chead"><h3>Otros</h3></div><div className="list">
            {debts.map((d) => <Link className="li" key={d.id} href={`/app/deudas/${d.id}`} style={{ color: "inherit" }}><div className="grow"><div className="t">{d.creditor}</div><div className="s">Deuda · {d.kind}</div></div><b className="num">{formatMoney(d.principal, d.currency)}</b></Link>)}
            {grain.map((g) => <Link className="li" key={g.id} href="/app/cereal" style={{ color: "inherit" }}><div className="grow"><div className="t">Venta de {g.grain.toLowerCase()}</div><div className="s">Venta de cereal · {fmtDate(g.saleDate)}</div></div></Link>)}
            {accounts.map((a) => <Link className="li" key={a.id} href={`/app/cuentas/${a.id}`} style={{ color: "inherit" }}><div className="grow"><div className="t">{a.name}</div><div className="s">Cuenta · {a.currency}</div></div></Link>)}
            {cats.map((c) => <Link className="li" key={c.id} href="/app/categorias" style={{ color: "inherit" }}><div className="grow"><div className="t">{c.name}</div><div className="s">Categoría</div></div></Link>)}
            {rules.map((r) => <Link className="li" key={r.id} href="/app/recurrentes" style={{ color: "inherit" }}><div className="grow"><div className="t">{r.description}</div><div className="s">Se repite · {formatMoney(r.amount, r.currency)}</div></div></Link>)}
          </div></div>}
        </>
      )}
    </div>
  );
}
