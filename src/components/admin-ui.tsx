// Piezas del panel interno: gráficos de barras sin librerías, números y textos de la actividad.
import { fmtDate } from "@/lib/dates";

export const usd = (v: number) => `US$ ${v.toLocaleString("es-AR", { maximumFractionDigits: v < 100 ? 2 : 0 })}`;
export const int = (v: number) => v.toLocaleString("es-AR");
export const pct = (v: number) => `${v.toLocaleString("es-AR", { maximumFractionDigits: 1 })}%`;
export const when = (d: Date) => `${fmtDate(d)} ${d.toISOString().slice(11, 16)}`;

export function Stats({ items }: { items: [string, string | number, string?][] }) {
  return (
    <div className="fc adm-stats" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
      {items.map(([l, v, hint]) => <div key={l}><small>{l}</small><b>{v}</b>{hint && <span className="adm-hint">{hint}</span>}</div>)}
    </div>
  );
}

// Barras verticales de una sola serie. Cada barra muestra su valor al pasar el mouse (o tocarla),
// y el valor más alto y el último quedan escritos. La tabla de abajo repite los números para lectores de pantalla.
export function Bars({ data, format = int, label }: { data: { key: string; n: number; tick: string }[]; format?: (v: number) => string; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.n));
  const iMax = data.reduce((b, d, i) => (d.n > data[b].n ? i : b), 0);
  const last = data.length - 1;
  const empty = data.every((d) => !d.n);
  return (
    <figure className="bc" aria-label={label}>
      <div className="bc-plot">
        {empty && <p className="bc-empty">Todavía no hay datos en este período.</p>}
        {data.map((d, i) => (
          <div className="bc-col" key={d.key} tabIndex={0} aria-label={`${d.tick}: ${format(d.n)}`}>
            <span className="bc-tip">{d.tick}<b>{format(d.n)}</b></span>
            {(i === iMax || i === last) && d.n > 0 && <span className="bc-val">{format(d.n)}</span>}
            <i style={{ height: `${d.n ? Math.max(3, (d.n / max) * 100) : 0}%` }} />
          </div>
        ))}
      </div>
      <div className="bc-x" aria-hidden="true">
        <span>{data[0]?.tick}</span><span>{data[Math.floor(last / 2)]?.tick}</span><span>{data[last]?.tick}</span>
      </div>
      <table className="sr-only"><tbody>{data.map((d) => <tr key={d.key}><th>{d.tick}</th><td>{format(d.n)}</td></tr>)}</tbody></table>
    </figure>
  );
}

// Barras horizontales (embudo, países): el número va escrito al lado, sin depender del color.
export function HBars({ rows, base }: { rows: { label: string; n: number }[]; base?: number }) {
  const max = Math.max(1, base ?? Math.max(...rows.map((r) => r.n)));
  return (
    <div className="hb">
      {rows.map((r) => (
        <div className="hb-row" key={r.label}>
          <span className="hb-l">{r.label}</span>
          <span className="hb-track"><i style={{ width: `${r.n ? Math.max(1.5, (r.n / max) * 100) : 0}%` }} /></span>
          <span className="hb-v">{int(r.n)}{base ? <small> · {pct(base ? (r.n / base) * 100 : 0)}</small> : null}</span>
        </div>
      ))}
    </div>
  );
}

// Nombres en castellano para la actividad.
const ACTIONS: Record<string, string> = {
  "auth.signup": "Creó su cuenta", "auth.login": "Ingresó", "auth.login_failed": "Contraseña incorrecta", "auth.2fa_ok": "Pasó el segundo paso",
  "auth.2fa_failed": "Código de dos pasos incorrecto", "auth.password_reset": "Cambió la contraseña", "auth.reset_requested": "Pidió recuperar la contraseña",
  "auth.google_linked": "Unió su cuenta de Google", "billing.checkout_started": "Fue a pagar Pro", "billing.canceled": "Canceló Pro",
  "billing.pro_grant_used": "Recibió el Pro reservado", "card.statement_loaded": "Cargó un resumen", "card.pdf_read": "Leyó un PDF de resumen",
  "admin.login": "Entró al panel", "admin.login_denied": "Intentó entrar al panel sin permiso", "admin.plan_changed": "Cambió un plan",
  "admin.pro_gifted": "Regaló Pro", "admin.pro_reserved": "Reservó Pro para un correo", "admin.pro_reserve_removed": "Quitó un Pro reservado",
  "admin.user_suspended": "Suspendió una cuenta", "admin.user_restored": "Reactivó una cuenta", "admin.2fa_reset": "Quitó el segundo paso de una cuenta",
  "admin.sessions_closed": "Cerró las sesiones de una cuenta", "admin.account_deleted": "Borró una cuenta", "admin.data_exported": "Exportó los datos de una cuenta",
  "admin.coupon_created": "Creó un cupón", "admin.coupon_paused": "Pausó un cupón", "admin.coupon_resumed": "Reactivó un cupón",
  "admin.subscription_canceled": "Canceló una suscripción", "admin.ticket_answered": "Respondió una consulta", "admin.ticket_closed": "Cerró una consulta",
  "admin.ticket_priority": "Cambió la prioridad de una consulta", "admin.saved_reply": "Guardó una respuesta", "admin.saved_reply_removed": "Borró una respuesta guardada",
  "admin.announcement_saved": "Publicó un aviso", "admin.announcement_removed": "Sacó el aviso", "admin.campaign_sent": "Mandó un correo masivo",
  "admin.news_published": "Publicó una novedad", "admin.news_removed": "Borró una novedad", "admin.cost_added": "Agregó un gasto", "admin.cost_removed": "Borró un gasto",
  "admin.plans_saved": "Cambió precios o funciones", "admin.system_saved": "Cambió los ajustes del sistema", "admin.member_added": "Sumó a alguien al equipo",
  "admin.member_role": "Cambió un rol del equipo", "admin.member_removed": "Sacó a alguien del equipo", "admin.session_revoked": "Cerró una sesión del panel",
  "admin.export": "Exportó una lista", "cron.diario": "Corrió la tarea diaria", "cron.failed": "Falló la tarea diaria",
};
export const actionName = (a: string) => ACTIONS[a] ?? a;
