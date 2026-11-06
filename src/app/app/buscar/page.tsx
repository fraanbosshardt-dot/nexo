import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/dates";
import { PageHead } from "@/components/page";

export const metadata: Metadata = { title: "Buscar" };

// Busca en movimientos, pagos y cobros pendientes, cuentas, categorías y pagos que se repiten.
export default async function Search({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { workspace } = await requireWorkspace();
  const q = ((await searchParams).q ?? "").trim().slice(0, 80);
  const db = getDb();
  const ws = workspace.id;
  const like = { contains: q, mode: "insensitive" as const };
  const [tx, obl, accounts, cats, rules] = q.length >= 2 ? await Promise.all([
    db.transaction.findMany({ where: { workspaceId: ws, OR: [{ description: like }, { notes: like }, { category: { name: like } }] }, include: { account: true, category: true }, orderBy: { effectiveDate: "desc" }, take: 30 }),
    db.obligation.findMany({ where: { workspaceId: ws, status: { in: ["PENDING", "PARTIAL"] }, description: like }, orderBy: { dueDate: "asc" }, take: 15 }),
    db.account.findMany({ where: { workspaceId: ws, name: like }, take: 10 }),
    db.category.findMany({ where: { workspaceId: ws, name: like, archived: false }, take: 10 }),
    db.recurringRule.findMany({ where: { workspaceId: ws, description: like }, take: 10 }),
  ]) : [[], [], [], [], []];
  const total = tx.length + obl.length + accounts.length + cats.length + rules.length;
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
          {(accounts.length > 0 || cats.length > 0 || rules.length > 0) && <div className="card"><div className="chead"><h3>Otros</h3></div><div className="list">
            {accounts.map((a) => <Link className="li" key={a.id} href={`/app/cuentas/${a.id}`} style={{ color: "inherit" }}><div className="grow"><div className="t">{a.name}</div><div className="s">Cuenta · {a.currency}</div></div></Link>)}
            {cats.map((c) => <Link className="li" key={c.id} href="/app/categorias" style={{ color: "inherit" }}><div className="grow"><div className="t">{c.name}</div><div className="s">Categoría</div></div></Link>)}
            {rules.map((r) => <Link className="li" key={r.id} href="/app/recurrentes" style={{ color: "inherit" }}><div className="grow"><div className="t">{r.description}</div><div className="s">Se repite · {formatMoney(r.amount, r.currency)}</div></div></Link>)}
          </div></div>}
        </>
      )}
    </div>
  );
}
