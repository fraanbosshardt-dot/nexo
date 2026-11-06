import type { Metadata } from "next";
import { requireWorkspace } from "@/lib/auth/session";
import { getDb } from "@/lib/db";
import { MODULES, PLAN_FEATURES, PRICE_USD } from "@/lib/modules";
import { fmtDate } from "@/lib/dates";
import { PageHead, Tabs } from "@/components/page";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { confirm2faAction, disable2faAction, revokeOtherSessionsAction, saveModulesAction, start2faAction, twoFactorQr, updateProfileAction } from "@/app/actions/app";

export const metadata: Metadata = { title: "Configuración" };

const TABS = [["general", "General"], ["funciones", "Funciones"], ["seguridad", "Seguridad"], ["plan", "Plan"], ["datos", "Tus datos"]] as const;
const TIMEZONES = [
  ["America/Argentina/Buenos_Aires", "Buenos Aires, Argentina (GMT−3)"],
  ["America/Argentina/Cordoba", "Córdoba, Argentina (GMT−3)"],
  ["America/Montevideo", "Montevideo, Uruguay (GMT−3)"],
  ["America/Santiago", "Santiago, Chile (GMT−4)"],
];

export default async function Settings({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { user, workspace, modules, plan, session } = await requireWorkspace();
  const asked = (await searchParams).tab;
  const t = TABS.some(([k]) => k === asked) ? asked! : "general";
  const tabs = <Tabs current={t} items={TABS.map(([k, l]) => ({ key: k, label: l, href: `/app/configuracion?tab=${k}` }))} />;
  const now = new Intl.DateTimeFormat("es-AR", { timeZone: workspace.timezone, dateStyle: "full", timeStyle: "short" }).format(new Date());

  let body: React.ReactNode = null;
  if (t === "general") {
    body = (
      <div className="card" style={{ maxWidth: 720 }}>
        <ActionForm action={updateProfileAction} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="frow"><label className="field">Nombre<input name="name" defaultValue={user.name} /></label><label className="field">Correo<input defaultValue={user.email} disabled /></label></div>
          <div className="frow">
            <label className="field">Moneda principal<select name="currency" defaultValue={workspace.baseCurrency}><option value="ARS">Peso argentino (ARS)</option><option value="USD">Dólar (USD)</option></select></label>
            <label className="field">Zona horaria<select name="timezone" defaultValue={workspace.timezone}>{TIMEZONES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
          </div>
          <p className="sub">Hora actual en tu zona: {now}.</p>
          <div><Submit>Guardar</Submit></div>
        </ActionForm>
      </div>
    );
  }
  if (t === "funciones") {
    body = (
      <div className="card" style={{ maxWidth: 820 }}>
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
        <div className="card" style={{ maxWidth: 720 }}>
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
        <div className="card" style={{ maxWidth: 720 }}>
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
    body = (
      <div className="grid g2">
        <div className="card">
          <div className="chead"><div><h3>Tu plan: {plan === "PRO" ? "Pro" : "Gratis"}</h3><p className="sub">{plan === "PRO" ? `US$ ${PRICE_USD.monthly} por mes` : "Tenés casi todo incluido, sin costo."}</p></div></div>
          <p className="sub">Pro cuesta US$ {PRICE_USD.monthly} por mes o US$ {PRICE_USD.yearly} por año. Los cobros (Mercado Pago o Stripe) se conectan en la fase comercial; hasta entonces no se cobra nada.</p>
        </div>
        <div className="card"><div className="chead"><h3>Qué suma Pro</h3></div><div className="list">{PLAN_FEATURES.filter((f) => f.plan === "pro").map((f) => <div className="li" key={f.name}><span className="pill">Pro</span><div className="grow">{f.name}</div></div>)}</div></div>
      </div>
    );
  }
  if (t === "datos") {
    body = (
      <div className="card" style={{ maxWidth: 720 }}><div className="list">
        <div className="li"><div className="grow"><div className="t">Descargar todos mis datos</div><div className="s">Respaldo completo en un archivo. Llega con Importar y exportar (Fase 7).</div></div></div>
        <div className="li"><div className="grow"><div className="t neg">Eliminar cuenta y datos</div><div className="s">Escribinos a soporte@nexo.app desde tu correo y la eliminamos en hasta 30 días.</div></div></div>
      </div></div>
    );
  }
  return (<><PageHead crumb="Ajustes" title="Configuración" />{tabs}{body}</>);
}
