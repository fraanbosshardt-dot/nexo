import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { Icon } from "@/components/icons";
import { MODULES, PLAN_FEATURES } from "@/lib/modules";
import { formatMoney } from "@/lib/money";
import { billingConfig } from "@/server/billing";
import { planSettings } from "@/server/plans";
import { cancelPlanAction, checkoutAction, startTrialAction } from "@/app/actions/modules";
import { fmtDate } from "@/lib/dates";
import { COUNTRIES, CURRENCIES } from "@/lib/countries";
import { PageHead, SettingsTabs } from "@/components/page";
import { InstallApp } from "@/components/pwa";
import { BigTextToggle } from "@/components/big-text";
import { ThemeChoice } from "@/components/theme";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { deleteMyAccountAction, emailRemindersAction, confirm2faAction, disable2faAction, revokeOtherSessionsAction, saveModulesAction, start2faAction, twoFactorQr, updateProfileAction } from "@/app/actions/app";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { ShareLink } from "@/components/referral";
import { SharingTab } from "./sharing-tab";
import { PushToggle } from "@/components/push-toggle";
import { pushConfig } from "@/server/push";

export const metadata: Metadata = { title: "Configuración" };

const TABS = [["general", "General"], ["funciones", "Funciones"], ["compartir", "Compartir"], ["seguridad", "Seguridad"], ["plan", "Plan"], ["datos", "Tus datos"]] as const;

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string; pago?: string; cancelado?: string; cupon?: string; soloduenio?: string; yatenes?: string; verificar?: string }> }) {
  const { user, workspace, modules, plan, session, membership } = await requireWorkspace();
  const sp = await searchParams;
  const asked = sp.tab;
  const t = TABS.some(([k]) => k === asked) ? asked! : "general";
  const tabs = <SettingsTabs current={t} rules={modules.reglas} />;
  const now = new Intl.DateTimeFormat("es-AR", { timeZone: workspace.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date());

  const push = pushConfig();
  let body: React.ReactNode = null;
  if (t === "compartir") body = <SharingTab workspaceId={workspace.id} role={membership.role} plan={plan} userId={user.id} />;
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
    const others = sessions.filter((x) => x.id !== session.id).length;
    body = (
      <>
        <div className="card sec-sum">
          <div className="chead"><div><h3>Estado de tu cuenta</h3><p className="sub">Lo importante para que nadie más pueda entrar.</p></div></div>
          <div className="sec-items">
            <div className={`sec-item ${user.totpEnabledAt ? "ok" : "warn"}`}><span className="sec-dot" aria-hidden="true">{user.totpEnabledAt ? "✓" : "!"}</span><span><b>Verificación en dos pasos</b><span className="sub">{user.totpEnabledAt ? "Activada" : "Desactivada: activala abajo"}</span></span></div>
            <div className={`sec-item ${user.emailVerified ? "ok" : "warn"}`}><span className="sec-dot" aria-hidden="true">{user.emailVerified ? "✓" : "!"}</span><span><b>Correo confirmado</b><span className="sub">{user.emailVerified ? user.email : "Falta confirmarlo (mirá el aviso arriba)"}</span></span></div>
            <div className={`sec-item ${others ? "warn" : "ok"}`}><span className="sec-dot" aria-hidden="true">{others ? others : "✓"}</span><span><b>Sesiones abiertas</b><span className="sub">{others ? `${others} además de esta` : "Solo esta"}</span></span>
              {others > 0 && <form action={revokeOtherSessionsAction} style={{ marginLeft: "auto" }}><ConfirmSubmit className="btn sm" question={`¿Cerrar las otras ${others} sesiones? En esos dispositivos vas a tener que volver a ingresar.`} yes="Sí, cerrarlas">Cerrar las demás</ConfirmSubmit></form>}</div>
            <div className="sec-item ok"><span className="sec-dot" aria-hidden="true">↓</span><span><b>Tus datos</b><span className="sub">Llevátelos cuando quieras</span></span><a className="btn sm" href="/app/configuracion/mis-datos" style={{ marginLeft: "auto" }}>Descargar todo</a></div>
          </div>
        </div>
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
          <p className="foot-note" style={{ marginTop: 10 }}>Guafra nunca te pide ni guarda las contraseñas de tu banco.</p>
        </div>
        <div className="card">
          <div className="chead"><div><h3>Tus datos</h3><p className="sub">Son tuyos: podés llevártelos o borrarlos cuando quieras.</p></div></div>
          <div className="acts"><a className="btn" href="/app/configuracion/mis-datos">Descargar todos mis datos</a></div>
          <details className="adm-danger" style={{ marginTop: 12 }}>
            <summary>Borrar mi cuenta</summary>
            <p className="sub" style={{ margin: 0 }}>Se borran para siempre tus cuentas, movimientos, tarjetas, deudas y todo lo que cargaste. No se puede deshacer. Si pagás Pro, cancelalo antes.</p>
            <ActionForm action={deleteMyAccountAction} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {user.passwordHash ? <label className="field">Tu contraseña<input name="password" type="password" autoComplete="current-password" /></label> : null}
              <label className="field">Para confirmar, escribí tu correo<input name="confirm" autoComplete="off" placeholder={user.email} /></label>
              <div><Submit className="btn danger" pending="Borrando…">Borrar mi cuenta para siempre</Submit></div>
            </ActionForm>
          </details>
        </div>
      </>
    );
  }
  if (t === "plan") {
    const sub = workspace.subscription;
    const bill = await billingConfig(getDb());
    const ps = await planSettings(getDb());
    const { priceLabel } = await import("@/server/plans");
    const invoices = await getDb().invoice.findMany({ where: { workspaceId: workspace.id }, orderBy: { createdAt: "desc" }, take: 24 });
    const paidPro = sub?.plan === "PRO" && sub.status === "ACTIVE" && sub.provider === "mercadopago";
    const { ensureReferralCode, referralStats, REFERRAL_DAYS } = await import("@/server/referrals");
    const { SITE } = await import("@/lib/seo");
    const [refCode, refStats] = await Promise.all([ensureReferralCode(getDb(), user.id), referralStats(getDb(), user.id)]);
    const trial = sub?.status === "TRIALING" && sub.trialEndsAt && sub.trialEndsAt > new Date();
    // Cancelada o con el pago pendiente: Pro sigue hasta el fin de lo ya pagado.
    const endsAt = plan === "PRO" && sub && sub.status !== "ACTIVE" && sub.status !== "TRIALING" ? sub.currentPeriodEnd : null;
    body = (
      <>
        {sp.pago && <div className="notice g">Gracias. En cuanto Mercado Pago confirme el pago, tu plan pasa a Pro.</div>}
        {sp.yatenes && <div className="notice g">Ya tenés Pro activo, no hace falta pagarlo de nuevo.</div>}
        {sp.cancelado && <div className="notice">{endsAt ? `Cancelaste Pro. No se te cobra más y lo seguís usando hasta el ${fmtDate(endsAt)}; después pasás a Gratis con todos tus datos.` : "Cancelaste Pro. Seguís con todo lo de Gratis y tus datos quedan."}</div>}
        <div className="card">
          <div className="chead"><div><h3>Tu plan: {plan === "PRO" ? "Pro" : "Gratis"}</h3><p className="sub">{trial ? `Prueba gratis hasta el ${fmtDate(sub!.trialEndsAt!)}.` : endsAt ? `${sub!.status === "CANCELED" ? "Cancelado" : "Pago pendiente en Mercado Pago"}: tenés Pro hasta el ${fmtDate(endsAt)}.` : paidPro ? `Pagás con Mercado Pago, ${sub!.billingCycle === "yearly" ? "por año" : "por mes"}.` : plan === "PRO" ? "Pro activado por Guafra." : "Tenés casi todo incluido, sin costo."}</p></div></div>
          {paidPro ? (
            <form action={cancelPlanAction}><ConfirmSubmit className="btn" question={sub!.currentPeriodEnd ? `¿Cancelar Pro? No se te cobra más y lo seguís usando hasta el ${fmtDate(sub!.currentPeriodEnd)}.` : "¿Cancelar Pro? Dejás de pagar y volvés al plan Gratis."} yes="Sí, cancelar">Cancelar Pro</ConfirmSubmit></form>
          ) : bill.enabled && (plan !== "PRO" || trial) ? (
            // En Gratis: a la izquierda qué suma Pro; a la derecha el precio (por mes o por año) y los botones.
            <div className="plan-up">
              <div className="plan-why">
                <h4>{trial ? "Seguí con Pro cuando termine la prueba" : "Pasate a Pro"}</h4>
                {trial && <p className="plan-note">Tu prueba termina el {fmtDate(sub!.trialEndsAt!)}. Si te suscribís, no perdés nada de esto:</p>}
                <ul>{PLAN_FEATURES.filter((f) => f.plan === "pro").slice(0, 5).map((f) => <li key={f.name}><Icon name="check" />{f.name}</li>)}</ul>
              </div>
              <div className="plan-box">
                <form action={checkoutAction} className="plan-buy">
                  {sp.cupon && <p className="auth-err" role="alert">{sp.cupon}</p>}
                  <div className="plan-cycle" role="radiogroup" aria-label="Cómo querés pagar">
                    <label><input type="radio" name="cycle" value="monthly" defaultChecked /><span>Por mes</span></label>
                    <label><input type="radio" name="cycle" value="yearly" /><span>Por año <em>2 meses gratis</em></span></label>
                  </div>
                  <div className="plan-price m"><b>{formatMoney(String(bill.monthly), bill.currency)}</b><span>por mes</span></div>
                  <div className="plan-price y"><b>{formatMoney(String(bill.yearly), bill.currency)}</b><span>por año · {formatMoney(String(Math.round(Number(bill.yearly) / 12)), bill.currency)} por mes</span></div>
                  <button className="btn pri plan-cta" type="submit">{trial ? "Suscribirme a Pro" : "Pasar a Pro"}</button>
                  <details className="plan-coupon" open={!!sp.cupon}><summary>¿Tenés un cupón?</summary><input name="coupon" autoComplete="off" placeholder="Ej.: BIENVENIDA" aria-label="Cupón" /></details>
                </form>
                {!sub?.trialEndsAt && <form action={startTrialAction}><button className="btn plan-trial" type="submit">Probar 14 días gratis</button></form>}
                <p className="plan-fine">{trial ? "El primer cobro es al suscribirte. " : ""}Pagás con Mercado Pago y cancelás cuando quieras.</p>
              </div>
            </div>
          ) : plan !== "PRO" ? (
            <p className="sub">Pro cuesta {priceLabel(ps, "monthly").text} por mes o {priceLabel(ps, "yearly").text} por año. El cobro con Mercado Pago se activa pronto; mientras tanto podés usar la prueba gratis.</p>
          ) : null}
          {!paidPro && !bill.enabled && !sub?.trialEndsAt && plan !== "PRO" && <form action={startTrialAction} style={{ marginTop: 12 }}><button className="btn ghost" type="submit">Probar Pro gratis 14 días</button></form>}
        </div>
        <div className="card">
          <div className="chead"><div><h3>Invitá y ganá Pro</h3><p className="sub">Cuando alguien se registra con tu link y termina la bienvenida, ustedes dos reciben {REFERRAL_DAYS} días de Pro.</p></div>{refStats.rewarded > 0 && <span className="pill g">{refStats.rewarded} {refStats.rewarded === 1 ? "invitación" : "invitaciones"}</span>}</div>
          <ShareLink url={`${SITE.url}/?ref=${refCode}`} text="Yo uso Guafra para ordenar mi plata. Probalo gratis:" />
          {refStats.invited > refStats.rewarded && <p className="sub" style={{ margin: "10px 0 0" }}>{refStats.invited - refStats.rewarded} {refStats.invited - refStats.rewarded === 1 ? "persona se registró y todavía no terminó" : "personas se registraron y todavía no terminaron"} la bienvenida.</p>}
          {refStats.left === 0 && <p className="sub" style={{ margin: "10px 0 0" }}>Llegaste al máximo de premios por invitar. ¡Gracias por recomendarnos!</p>}
        </div>
        <div className="card"><div className="chead"><h3>Qué suma Pro</h3></div><div className="list">{PLAN_FEATURES.filter((f) => f.plan === "pro").map((f) => <div className="li" key={f.name}><span className="pill b">Pro</span><div className="grow">{f.name}</div>{f.beta && <span className="pill beta">Beta</span>}</div>)}</div></div>
        {invoices.length > 0 && (
          <div className="card"><div className="chead"><h3>Facturas</h3></div><div className="tw"><table>
            <thead><tr><th>Fecha</th><th>Detalle</th><th>Estado</th><th className="n">Importe</th></tr></thead>
            <tbody>{invoices.map((i) => <tr key={i.id}><td>{fmtDate(i.paidAt ?? i.createdAt)}</td><td>Guafra Pro</td><td>{i.status === "approved" ? <span className="pill g">Pagada</span> : i.status === "rejected" ? <span className="pill r">Rechazada</span> : <span className="pill">{i.status}</span>}</td><td className="n">{formatMoney(i.amount, i.currency)}</td></tr>)}</tbody>
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
  return (<div className="narrow wide"><PageHead crumb="Ajustes" title="Configuración" />{tabs}{sp.verificar && <p className="notice a">{sp.verificar === "avisos" ? "Para recibir avisos por correo" : "Para pagar Pro"}, primero confirmá tu correo: escribí el código que te mandamos en el aviso de arriba (o pedí otro).</p>}{sp.soloduenio && <p className="notice a">Eso lo puede hacer solo el dueño del espacio.</p>}{t === "general" && <><ThemeChoice /><BigTextToggle />{push.enabled && <PushToggle publicKey={push.publicKey} />}<InstallApp /></>}{body}</div>);
}
