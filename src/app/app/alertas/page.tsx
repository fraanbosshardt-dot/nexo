import Link from "next/link";
import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { insights } from "@/server/insights";
import { todayIn } from "@/lib/dates";
import { PageHead } from "@/components/page";

export const metadata: Metadata = { title: "Alertas y consejos" };
const LABEL = { urgent: ["Urgente", "r"], warn: ["Atención", "a"], info: ["Consejo", "b"], good: ["Bien", "g"] } as const;

export default async function Alerts() {
  const { workspace } = await requireWorkspace();
  const list = await insights(getDb(), workspace.id, workspace.baseCurrency, todayIn(workspace.timezone));
  return (
    <>
      <PageHead crumb="Análisis" title="Alertas y consejos" desc="Salen de tus propios datos y se actualizan cada vez que cargás algo." />
      <div className="card">
        {list.length ? (
          <div className="list">
            {list.map((i, k) => (
              <div className="li" key={k}>
                <span className={`pill ${LABEL[i.level][1]}`}>{LABEL[i.level][0]}</span>
                <div className="grow"><div className="t" style={{ whiteSpace: "normal" }}>{i.title}</div>{i.detail && <div className="s">{i.detail}</div>}</div>
                <Link className="btn sm" href={i.href}>Ver</Link>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty">No hay nada que revisar. Cuando tengas pagos atrasados, meses que quedan en rojo o presupuestos pasados, te avisamos acá.</div>
        )}
      </div>
    </>
  );
}
