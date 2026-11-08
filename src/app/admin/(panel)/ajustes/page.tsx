import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { planSettings, PRO_FEATURES } from "@/server/plans";
import { systemSettings } from "@/server/settings";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { adminSavePlansAction, adminSaveSystemAction } from "@/app/actions/admin";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AdminSettings() {
  await requireAdmin("owner");
  const db = getDb();
  const [settings, sys] = await Promise.all([planSettings(db), systemSettings(db)]);
  return (
    <>
      <PageHead title="Ajustes" desc="Precios, qué incluye cada plan y cómo funciona la app, sin tocar código." />
      <ActionForm action={adminSaveSystemAction} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="chead"><h3>Sistema</h3></div>
        <label className="li" style={{ cursor: "pointer" }}>
          <div className="grow"><div className="t">Modo mantenimiento</div><div className="s">Los clientes ven un aviso en lugar de sus pantallas. El panel sigue funcionando.</div></div>
          <span className="sw-t"><input type="checkbox" name="maintenance" defaultChecked={sys.maintenance} aria-label="Modo mantenimiento" /><span /></span>
        </label>
        <label className="field">Mensaje de mantenimiento<input name="maintenanceMsg" defaultValue={sys.maintenanceMsg} maxLength={300} /></label>
        <label className="field" style={{ maxWidth: 260 }}>Lecturas de PDF por mes (Pro)<input name="pdfLimit" inputMode="numeric" defaultValue={sys.pdfLimit} /></label>
        <div><Submit>Guardar</Submit></div>
      </ActionForm>
      <ActionForm action={adminSavePlansAction} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="chead"><h3>Precio de Pro que se muestra (US$)</h3><span className="sub">El cobro real usa los precios de Mercado Pago en Vercel</span></div>
        <div className="frow" style={{ maxWidth: 420 }}>
          <label className="field">Por mes<input name="monthly" inputMode="decimal" defaultValue={settings.prices.monthly} /></label>
          <label className="field">Por año<input name="yearly" inputMode="decimal" defaultValue={settings.prices.yearly} /></label>
        </div>
        <div className="chead" style={{ marginTop: 8 }}><h3>Funciones Pro</h3><span className="sub">Marcá las que también querés dar gratis</span></div>
        <div className="list">{PRO_FEATURES.map((f) => (
          <label className="li" key={f.key} style={{ cursor: "pointer" }}><div className="grow"><div className="t">{f.name}{f.beta && <> <span className="pill a">Beta</span></>}</div><div className="s">{settings.freeAlso.includes(f.key) ? "Incluida en Gratis" : "Solo Pro"}</div></div><span className="sw-t"><input type="checkbox" name="freeAlso" value={f.key} defaultChecked={settings.freeAlso.includes(f.key)} aria-label={`Dar gratis: ${f.name}`} /><span /></span></label>
        ))}</div>
        <div><Submit>Guardar</Submit></div>
      </ActionForm>
    </>
  );
}
