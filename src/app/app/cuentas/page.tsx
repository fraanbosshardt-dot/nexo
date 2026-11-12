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
import { SortableAccounts } from "./sortable";

// Grupos de cuentas por tipo (dentro de cada uno, el orden lo elegís arrastrando).
const GROUPS: [string, string[]][] = [["Efectivo", ["CASH"]], ["Bancos", ["SAVINGS", "CHECKING"]], ["Billeteras virtuales", ["WALLET"]], ["En otra moneda", ["FOREIGN"]], ["Inversiones", ["INVESTMENT"]], ["Otras", ["OTHER"]]];

export const metadata: Metadata = { title: "Cuentas" };

export default async function Accounts({ searchParams }: { searchParams: Promise<{ nueva?: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  const sp = await searchParams;
  const db = getDb();
  const [accounts, balances] = await Promise.all([db.account.findMany({ where: { workspaceId: workspace.id, type: { not: "CREDIT_CARD" } }, orderBy: [{ position: "asc" }, { createdAt: "asc" }] }), accountBalances(db, workspace.id, todayIn(workspace.timezone))]);
  const act = accounts.filter((a) => a.active), ina = accounts.filter((a) => !a.active);
  const cur = workspace.baseCurrency;
  const total = (f: (a: (typeof accounts)[number]) => boolean, c = cur) => act.filter((a) => a.currency === c && f(a)).reduce((s, a) => s.plus(balances.get(a.id) ?? ZERO), ZERO);
  const card = (a: (typeof accounts)[number]) => {
    const bal = balances.get(a.id) ?? ZERO;
    // Una cuenta de dinero no puede quedar en negativo: casi siempre falta cargar un ingreso o corregir el saldo.
    const odd = bal.isNegative() && a.type !== "INVESTMENT";
    return (
      <Link key={a.id} className="card dcard" href={`/app/cuentas/${a.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div className="chead" style={{ marginBottom: 8 }}><div>{a.institution && <div className="sub" style={{ margin: 0 }}>{a.institution}</div>}<h3>{a.name}</h3></div><span className="pill">{a.type === "INVESTMENT" ? "Inversión" : a.currency}</span></div>
        <div className={`num ${odd ? "neg" : ""}`} style={{ fontFamily: "var(--f-display)", fontSize: 22, fontWeight: 600 }}>{formatMoney(bal, a.currency)}</div>
        <p className="sub">{odd ? "Saldo negativo: ¿falta cargar un ingreso? Entrá para corregir el saldo." : ACCOUNT_TYPE_LABEL[a.type]}</p>
      </Link>
    );
  };
  const atLimit = plan === "FREE" && act.length >= FREE_LIMITS.accounts;
  return (
    <>
      <PageHead crumb="Mi dinero" title="Cuentas" desc="Tocá una cuenta para ver su detalle. Para cambiar el orden, arrastrala desde ⠿." />
      {act.length > 0 && (
        <div className="card" style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <Stat label={`En ${currencyName(cur).toLowerCase()}`} value={formatMoney(total((a) => a.type !== "INVESTMENT"), cur)} />
          {[...new Set(act.filter((a) => a.currency !== cur).map((a) => a.currency))].map((c) => <Stat key={c} label={`En ${currencyName(c).toLowerCase()}`} value={formatMoney(total(() => true, c), c)} />)}
          {act.some((a) => a.type === "INVESTMENT") && <Stat label="En cuentas de inversión" value={formatMoney(total((a) => a.type === "INVESTMENT"), cur)} />}
        </div>
      )}
      {(() => {
        const groups = GROUPS.map(([label, types]) => ({ label, list: act.filter((a) => types.includes(a.type)) })).filter((g) => g.list.length);
        const many = groups.length > 1;
        return groups.map((g) => {
          const curs = [...new Set(g.list.map((a) => a.currency))];
          const sub = curs.length === 1 ? g.list.reduce((t, a) => t.plus(balances.get(a.id) ?? ZERO), ZERO) : null;
          return (
            <section key={g.label} className="acc-group">
              {many && <div className="acc-gh"><h2>{g.label}</h2>{sub && g.list.length > 1 && <span className="num">{formatMoney(sub, curs[0])}</span>}</div>}
              <SortableAccounts ids={g.list.map((a) => a.id)} names={g.list.map((a) => a.name)}>{g.list.map(card)}</SortableAccounts>
            </section>
          );
        });
      })()}
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
              <div className="calc">El saldo inicial es lo que tenía la cuenta en esa fecha. Desde ahí, Guafra suma y resta tus movimientos. Las cuentas de inversión no cuentan como dinero disponible.</div>
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
