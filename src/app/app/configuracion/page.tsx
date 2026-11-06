import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { MODULES, PLAN_FEATURES } from "@/lib/modules";
import { formatMoney } from "@/lib/money";
import { billingConfig } from "@/server/billing";
import { planSettings } from "@/server/plans";
import { cancelPlanAction, checkoutAction, startTrialAction } from "@/app/actions/modules";
import { fmtDate } from "@/lib/dates";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import { PageHead, SettingsTabs } from "@/components/page";
import { InstallApp } from "@/components/pwa";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { emailRemindersAction, confirm2faAction, disable2faAction, revokeOtherSessionsAction, saveModulesAction, start2faAction, twoFactorQr, updateProfileAction } from "@/app/actions/app";

export const metadata: Metadata = { title: "Configuración" };

const TABS = [["general", "General"], ["funciones", "Funciones"], ["seguridad", "Seguridad"], ["plan", "Plan"], ["datos", "Tus datos"]] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; pago?: string; cancelado?: string }> }) {
  const { user, workspace, modules, plan, session } = await requireWorkspace();
  const sp = await searchParams;
  const asked = sp.tab;
  const t = TABS.some(([k]) => k === asked) ? asked! : "general";
  const tabs = <SettingsTabs current={t} rules={modules.reglas} />;
  const now = new Intl.DateTimeFormat("es-AR", { timeZone: workspace.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date());

  let body: React.ReactNode = null;
  if (t === "general") {
    body = (
      <div className="card">
        <ActionForm action={updateProfileAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="frow"><label className="field">Nombre<input name="name" defaultValue={user.name} /></label><label className="field">Correo<input defaultValue={user.email} disabled /></label></div>
          <div className="frow">
            <label className="field">País<select name="country" defaultValue={workspace.country}>{COUNTRIES.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}</select></label>
            <label className="field">Moneda principal<select name="currency" defaultValue={workspace.baseCurrency}>{CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code})</option>)}</select></label>
          </div>
          <div className="field">Otras monedas que usás
            <div className="chips">{CURRENCIES.filter((c) => c.code !== workspace.baseCurrency).map((c) => (
              <label key={c.code} className="chipck"><input type="checkbox" name="extraCurrencies" value={c.code} defaultChecked={workspace.extraCurrencies.includes(c.code)} /><span>{c.code}</span></label>
            ))}</div>
          </div>
          <p className="sub">La zona horaria se ajusta sola según el país. Hora actual: {now}.</p>
          <div><Submit>Guardar</Submit></div>
        </ActionForm>
      </div>
    );
  }
  if (t === "funciones") {
    body = (
      <div className="card">
        <p className="sub" style={{ marginBottom: 8 }}>Activá solo lo que usás. Lo que apagues desaparece del menú; tus datos no se borran.</p>
        <ActionForm action={saveModulesAction}>
          <div className="list">{MODULES.map((m) => (
            <div className="li" key={m.key}>
              <div className="grow"><div className="t" style={{ whiteSpace: "normal" }}>{m.name} {m.pro && <span className="pill">Pro</span>}</div><div className="s">{m.description}</div></div>
              <label className="sw-t"><input type="checkbox" name="modules" value={m.key} defaultChecked={modules[m.key]} aria-label={m.name} /><span /></label>
            </div>))}</div>
          <div style={{ marginTop: 12 }}><Submit>Guardar funciones</Submit></div>
        </ActionForm>
      </div>
    );
  }
  if (t === "seguridad") {
    const qr = user.totpEnabledAt ? null : await twoFactorQr();
    const sessions = await getDb().session.findMany({ where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    body = (
      <>
        <div className="card">
          <div className="chead"><div><h3>Verificación en dos pasos</h3><p className="sub">Además de la contraseña, te pide un código de Google Authenticator al entrar.</p></div>{user.totpEnabledAt && <span className="pill g">Activa</span>}</div>
          {user.totpEnabledAt ? (
            <ActionForm action={disable2faAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <p className="sub">Activa desde el {fmtDate(user.totpEnabledAt)}. Para desactivarla, escribí un código de la app.</p>
              <OtpInput />
              <div><Submit className="btn">Desactivar</Submit></div>
            </ActionForm>
          ) : qr ? (
            <ActionForm action={confirm2faAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <p className="sub">1. Abrí Google Authenticator y tocá “+”. 2. Escaneá el código o cargá la clave. 3. Escribí el código de 6 números.</p>
              <div className="tf-box">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr.qr} alt="Código QR para Google Authenticator" width={160} height={160} className="qr" style={{ width: 160, height: 160 }} />
                <div><div className="sub">Clave</div><b className="num sel" style={{ wordBreak: "break-all" }}>{qr.secret.replace(/(.{4})/g, "$1 ").trim()}</b></div>
              </div>
              <OtpInput />
              <div><Submit>Activar</Submit></div>
            </ActionForm>
          ) : (
            <form action={start2faAction}><button className="btn pri" type="submit">Configurar</button></form>
          )}
        </div>
        <div className="card">
          <div className="chead"><div><h3>Avisos por email</h3><p className="sub">Un día antes de cada vencimiento te mandamos lo que tenés que pagar o cobrar.</p></div>
            <form action={emailRemindersAction}><input type="hidden" name="on" value={user.emailReminders ? "0" : "1"} /><button className={`btn sm ${user.emailReminders ? "" : "pri"}`} type="submit">{user.emailReminders ? "Apagar" : "Prender"}</button></form></div>
          <p className="sub" style={{ margin: 0 }}>{user.emailReminders ? `Prendidos. Llegan a ${user.email}.` : "Apagados."}</p>
        </div>
        <div className="card">
          <div className="chead"><h3>Sesiones abiertas</h3>{sessions.length > 1 && <form action={revokeOtherSessionsAction}><button className="btn sm" type="submit">Cerrar las demás</button></form>}</div>
          <div className="list">{sessions.map((s) => (
            <div className="li" key={s.id}><div className="grow"><div className="t">{s.userAgent?.match(/(Windows|Mac OS X|Android|iPhone|Linux)/)?.[1] ?? "Dispositivo"}{s.id === session.id ? " · esta sesión" : ""}</div><div className="s">Desde el {fmtDate(s.createdAt)} · vence el {fmtDate(s.expiresAt)}</div></div></div>
          ))}</div>
          <p className="foot-note" style={{ marginTop: 10 }}>NEXO nunca te pide ni guarda las contraseñas de tu banco.</p>
        </div>
      </>
    );
  }
  if (t === "plan") {
    const sub = workspace.subscription;
    const bill = billingConfig();
    const prices = (await planSettings(getDb())).prices;
    const invoices = await getDb().invoice.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 24 });
    const paidPro = sub?.plan === "PRO" && sub.status === "ACTIVE" && sub.provider === "mercadopago";
    const trial = sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt > new Date();
    body = (
      <>
        {sp.pago && <div className="notice g">Gracias. En cuanto Mercado Pago confirme el pago, tu plan pasa a Pro.</div>}
        {sp.cancelado && <div className="notice">Cancelaste Pro. Seguís con todo lo de Gratis y tus datos quedan.</div>}
        <div className="card">
          <div className="chead"><div><h3>Tu plan: {plan === "PRO" ? "Pro" : "Gratis"}</h3><p className="sub">{trial ? `Prueba gratis hasta el ${fmtDate(sub!.trialEndsAt!)}.` : paidPro ? `Pagás con Mercado Pago, ${sub!.billingCycle === "yearly" ? "por año" : "por mes"}.` : plan === "PRO" ? "Pro activado por NEXO." : "Tenés casi todo incluido, sin costo."}</p></div></div>
          {paidPro ? (
            <form action={cancelPlanAction}><button className="btn" type="submit">Cancelar Pro</button></form>
          ) : bill.enabled ? (
            <div className="acts">
              <form action={checkoutAction}><input type="hidden" name="cycle" value="monthly" /><button className="btn pri" type="submit">Pasar a Pro · {formatMoney(String(bill.monthly), bill.currency)} por mes</button></form>
              <form action={checkoutAction}><input type="hidden" name="cycle" value="yearly" /><button className="btn" type="submit">Pagar por año · {formatMoney(String(bill.yearly), bill.currency)}</button></form>
            </div>
          ) : (
            <p className="sub">Pro cuesta US$ {prices.monthly} por mes o US$ {prices.yearly} por año. El cobro con Mercado Pago se activa pronto; mientras tanto podés usar la prueba gratis.</p>
          )}
          {!paidPro && !sub?.trialEndsAt && plan !== "PRO" && <form action={startTrialAction} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Probar Pro gratis 14 días</button></form>}
        </div>
        <div className="card"><div className="chead"><h3>Qué suma Pro</h3></div><div className="list">{PLAN_FEATURES.filter((f) => f.plan === "pro").map((f) => <div className="li" key={f.name}><span className="pill b">Pro</span><div className="grow">{f.name}</div></div>)}</div></div>
        {invoices.length > 0 && (
          <div className="card"><div className="chead"><h3>Facturas</h3></div><div className="tw"><table>
            <thead><tr><th>Fecha</th><th>Detalle</th><th>Estado</th><th className="n">Importe</th></tr></thead>
            <tbody>{invoices.map((i) => <tr key={i.id}><td>{fmtDate(i.paidAt ?? i.createdAt)}</td><td>NEXO Pro</td><td>{i.status === "approved" ? <span className="pill g">Pagada</span> : i.status === "rejected" ? <span className="pill r">Rechazada</span> : <span className="pill">{i.status}</span>}</td><td className="n">{formatMoney(i.amount, i.currency)}</td></tr>)}</tbody>
          </table></div></div>
        )}
      </>
    );
  }
  if (t === "datos") {
    body = (
      <div className="card"><div className="list">
        <div className="li"><div className="grow"><div className="t">Descargar mis movimientos</div><div className="s">Un archivo CSV que abre en Excel o Google Sheets.</div></div><a className="btn sm" href="/app/exportar/movimientos" download>Descargar</a></div>
        <div className="li"><div className="grow"><div className="t">Descargar todos mis datos</div><div className="s">Respaldo completo de tu espacio en un archivo.</div></div><a className="btn sm" href="/app/exportar/respaldo" download>Descargar</a></div>
        <div className="li"><div className="grow"><div className="t">Importar movimientos</div><div className="s">Desde la planilla o el extracto de tu banco.</div></div><a className="btn sm" href="/app/importar">Importar</a></div>
        <div className="li"><div className="grow"><div className="t neg">Eliminar cuenta y datos</div><div className="s">Escribinos desde Ayuda y la eliminamos en hasta 30 días.</div></div><a className="btn sm" href="/app/ayuda">Escribir</a></div>
      </div></div>
    );
  }
  return (<div className="narrow wide"><PageHead crumb="Ajustes" title="Configuración" />{tabs}{t === "general" && <InstallApp />}{body}</div>);
}
