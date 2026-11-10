import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { canUse, requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { dec, formatMoney } from "@/lib/money";
import { isoDate } from "@/lib/dates";
import { grainNet } from "@/server/grain";
import { PageHead } from "@/components/page";
import { ProGate } from "@/components/pro";
import { updateGrainSaleAction } from "@/app/actions/modules";
import { GrainForm } from "../grain-form";

export const metadata: Metadata = { title: "Editar venta de cereal" };
const num = (v: unknown, places = 2) => dec(v as string).toDecimalPlaces(places).toString().replace(".", ",");

export default async function EditGrain({ params }: { params: Promise<{ id: string }> }) {
  const { workspace, plan } = await requireWorkspace();
  if (!(await canUse(plan, "cereal"))) return <ProGate crumb="Mi dinero" title="Ventas de cereal" text="El módulo Agro es parte de Pro." trialUsed={!!workspace.subscription?.trialEndsAt} />;
  const { id } = await params;
  const db = getDb();
  const sale = await db.grainSale.findFirst({ where: { id, workspaceId: workspace.id } });
  if (!sale) notFound();
  const [ob, accounts] = await Promise.all([
    sale.obligationId ? db.obligation.findFirst({ where: { id: sale.obligationId, workspaceId: workspace.id }, include: { payments: { where: { reversalOfId: null, reversedBy: null }, orderBy: { createdAt: "desc" } } } }) : null,
    db.account.findMany({ where: { workspaceId: workspace.id, active: true, type: { notIn: ["CREDIT_CARD", "INVESTMENT"] } } }),
  ]);
  const settled = ob?.status === "SETTLED";
  const cur = workspace.baseCurrency;
  const n = grainNet(sale);
  return (
    <div className="narrow">
      <Link className="lk" href="/app/cereal">← Ventas de cereal</Link>
      <PageHead crumb="Mi dinero" title="Editar venta" desc={`Neto actual: ${formatMoney(n.net, cur)}. Al guardar se recalcula y se actualiza su cobro.`} />
      <div className="card">
        <GrainForm action={updateGrainSaleAction} mode="edit" settled={settled} accounts={accounts.map((a) => ({ id: a.id, name: a.name, currency: a.currency }))} cur={cur} submit="Guardar cambios"
          d={{
            id: sale.id, saleDate: isoDate(sale.saleDate), grain: sale.grain, quantity: num(dec(sale.tonnes.toString()).times(10)), unit: "qq",
            price: num(sale.pricePerTonne), priceCurrency: sale.priceCurrency, taxPct: num(sale.taxPct, 3), other: dec(sale.otherDeductions.toString()).gt(0) ? num(sale.otherDeductions) : "",
            fxRate: sale.fxRate ? num(sale.fxRate, 6) : "", collectDate: isoDate(sale.collectDate), accountId: ob?.payments[0]?.accountId ?? accounts[0]?.id,
          }} />
      </div>
    </div>
  );
}
