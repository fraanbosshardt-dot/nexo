import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth/admin";
import { getDb } from "@/lib/db";
import { planSettings, PRO_FEATURES } from "@/server/plans";
import { systemSettings } from "@/server/settings";
import { PageHead } from "@/components/page";
import { ActionForm, Submit } from "@/components/forms";
import { adminSaveContactAction, adminSavePlansAction, adminSaveSystemAction } from "@/app/actions/admin";
import { contactSettings } from "@/server/contact";
import { AREAS, SOCIALS } from "@/lib/brand";

export const metadata: Metadata = { title: "Ajustes" };

export default async function AdminSettings() {
  await requireAdmin("owner");
  const db = getDb();
  const [settings, sys, contact] = await Promise.all([planSettings(db), systemSettings(db), contactSettings(db)]);
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
        <div className="chead"><h3>Precio de Pro</h3><span className="sub">El cobro real usa los precios de Mercado Pago en Vercel</span></div>
        <p className="sub" style={{ margin: 0 }}>En pesos (recomendado para Argentina): si lo completás, es el precio que se ve en la web y en la app. Si lo dejás vacío, se muestra el de dólares.</p>
        <div className="frow" style={{ maxWidth: 420 }}>
          <label className="field">Pesos por mes<input name="arsMonthly" inputMode="decimal" placeholder="Ej.: 6000" defaultValue={settings.pricesArs?.monthly ?? ""} /></label>
          <label className="field">Pesos por año<input name="arsYearly" inputMode="decimal" placeholder="Ej.: 60000" defaultValue={settings.pricesArs?.yearly ?? ""} /></label>
        </div>
        <p className="sub" style={{ margin: 0 }}>En dólares (para otros países y para las métricas del panel):</p>
        <div className="frow" style={{ maxWidth: 420 }}>
          <label className="field">Por mes<input name="monthly" inputMode="decimal" defaultValue={settings.prices.monthly} /></label>
          <label className="field">Por año<input name="yearly" inputMode="decimal" defaultValue={settings.prices.yearly} /></label>
        </div>
        <div className="chead" style={{ marginTop: 8 }}><h3>Funciones Pro</h3><span className="sub">Marcá las que también querés dar gratis</span></div>
        <div className="list">{PRO_FEATURES.map((f) => (
          <label className="li" key={f.key} style={{ cursor: "pointer" }}><div className="grow"><div className="t">{f.name}{f.beta && <> <span className="pill beta">Beta</span></>}</div><div className="s">{settings.freeAlso.includes(f.key) ? "Incluida en Gratis" : "Solo Pro"}</div></div><span className="sw-t"><input type="checkbox" name="freeAlso" value={f.key} defaultChecked={settings.freeAlso.includes(f.key)} aria-label={`Dar gratis: ${f.name}`} /><span /></span></label>
        ))}</div>
        <div><Submit>Guardar</Submit></div>
      </ActionForm>
      <ActionForm action={adminSaveContactAction} className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div className="chead" id="contacto"><div><h3>Contacto y redes</h3><p className="sub">Cada consulta del sitio avisa al correo de su área (si un área no tiene, va al de Soporte). Las redes aparecen en el pie del sitio solo si cargás el link.</p></div></div>
        <div className="frow" style={{ flexWrap: "wrap" }}>{AREAS.map((a) => (
          <label className="field" key={a.key} style={{ minWidth: 240, flex: "1 1 240px" }}>{a.name}<input name={`email_${a.key}`} type="email" defaultValue={contact.emails[a.key] ?? ""} placeholder="correo@tudominio.com" /></label>
        ))}</div>
        <div className="frow" style={{ flexWrap: "wrap" }}>{SOCIALS.map((r) => (
          <label className="field" key={r.key} style={{ minWidth: 240, flex: "1 1 240px" }}>{r.name}<input name={`social_${r.key}`} type="url" defaultValue={contact.socials[r.key] ?? ""} placeholder="https://" /></label>
        ))}</div>
        <div><Submit>Guardar</Submit></div>
      </ActionForm>
    </>
  );
}
