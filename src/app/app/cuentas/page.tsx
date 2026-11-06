import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { accountBalances } from "@/server/ledger";
import { formatMoney, ZERO } from "@/lib/money";
import { isoDate, todayIn } from "@/lib/dates";
import { PageHead, Stat } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { createAccountAction } from "@/app/actions/app";
import { FREE_LIMITS } from "@/lib/modules";
import { ACCOUNT_TYPE_LABEL } from "@/lib/labels";
import { CURRENCIES, currencyName } from "@/lib/countries";

export const metadata: Metadata = { title: "Cuentas" };

export default async function Accounts({ searchParams }: { searchParams: Promise<{ nueva?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const [accounts, balances] = await Promise.all([db.account.findMany({ where: { workspaceId: workspace.id, type: { not: "CREDIT_CARD" } }, orderBy: { createdAt: "asc" } }), accountBalances(db, workspace.id)]);
  const act = accounts.filter((a) => a.active), ina = accounts.filter((a) => !a.active);
  const cur = workspace.baseCurrency;
  const total = (f: (a: (typeof accounts)[number]) => boolean, c = cur) => act.filter((a) => a.currency === c && f(a)).reduce((s, a) => s.plus(balances.get(a.id) ?? ZERO), ZERO);
  const card = (a: (typeof accounts)[number]) => (
    <Link key={a.id} className="card dcard" href={`/app/cuentas/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <div className="chead" style={{ marginBottom: 8 }}><div><div className="sub" style={{ margin: 0 }}>{a.institution || "—"}</div><h3>{a.name}</h3></div><span className="pill">{a.type === "INVESTMENT" ? "Inversión" : a.currency}</span></div>
      <div className="num" style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 600 }}>{formatMoney(balances.get(a.id) ?? ZERO, a.currency)}</div>
      <p className="sub">{ACCOUNT_TYPE_LABEL[a.type]}</p>
    </Link>
  );
  const atLimit = plan === "FREE" && act.length >= FREE_LIMITS.accounts;
  return (
    <>
      <PageHead crumb="Mi dinero" title="Cuentas" desc="Tocá una cuenta para ver su detalle y sus movimientos." />
      {act.length > 0 && (
        <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <Stat label={`En ${currencyName(cur).toLowerCase()}`} value={formatMoney(total((a) => a.type !== "INVESTMENT"), cur)} />
          {[...new Set(act.filter((a) => a.currency !== cur).map((a) => a.currency))].map((c) => <Stat key={c} label={`En ${currencyName(c).toLowerCase()}`} value={formatMoney(total(() => true, c), c)} />)}
          {act.some((a) => a.type === "INVESTMENT") && <Stat label="En cuentas de inversión" value={formatMoney(total((a) => a.type === "INVESTMENT"), cur)} />}
        </div>
      )}
      {act.length > 0 && <div className="grid g3">{act.map(card)}</div>}
      <div className="card">
        <details className="more" open={sp.nueva === "1" || act.length === 0}>
          <summary>+ Nueva cuenta</summary>
          {atLimit ? (
            <p className="sub" style={{ paddingTop: 8 }}>El plan Gratis incluye {FREE_LIMITS.accounts} cuentas activas. Desactivá una o pasá a Pro.</p>
          ) : (
            <ActionForm action={createAccountAction} style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 10, maxWidth: 620 }}>
              <div className="frow">
                <label className="field">Nombre<input name="name" placeholder="Ej.: Caja de ahorro sueldo" /></label>
                <label className="field">Banco o institución<input name="institution" placeholder="Ej.: Banco Nación, Mercado Pago" /></label>
              </div>
              <div className="frow">
                <label className="field">Tipo<select name="type" defaultValue="SAVINGS">{Object.entries(ACCOUNT_TYPE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
                <label className="field">Moneda<select name="currency" defaultValue={cur}>{[cur, ...workspace.extraCurrencies, ...CURRENCIES.map((c) => c.code).filter((c) => c !== cur && !workspace.extraCurrencies.includes(c))].map((c) => <option key={c} value={c}>{currencyName(c)} ({c})</option>)}</select></label>
              </div>
              <div className="frow">
                <label className="field">Saldo inicial<input name="initialBalance" inputMode="decimal" placeholder="0,00" /></label>
                <label className="field">A la fecha<input name="initialDate" type="date" defaultValue={isoDate(todayIn(workspace.timezone))} /></label>
              </div>
              <div className="calc">El saldo inicial es lo que tenía la cuenta en esa fecha. Desde ahí, NEXO suma y resta tus movimientos. Las cuentas de inversión no cuentan como dinero disponible.</div>
              <div className="acts" style={{ justifyContent: "flex-end" }}><Submit>Crear cuenta</Submit></div>
            </ActionForm>
          )}
        </details>
        {ina.length > 0 && (
          <details className="more"><summary>Cuentas desactivadas ({ina.length})</summary><div className="grid g3" style={{ paddingTop: 10 }}>{ina.map(card)}</div></details>
        )}
      </div>
    </>
  );
}
