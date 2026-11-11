// Pestaña "Compartir" de Configuración: quién está en el espacio, invitaciones y qué puede hacer cada uno.
import Link from "next/link";
import { getDb } from "@/lib/db";
import { canUse } from "@/lib/auth/session";
import { fmtDate } from "@/lib/dates";
import { ActionForm, Submit } from "@/components/forms";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { MAX_GUESTS, ROLE_LABEL, sharingOverview } from "@/server/sharing";
import { changeRoleAction, inviteAction, leaveWorkspaceAction, removeMemberAction, revokeInviteAction } from "@/app/actions/sharing";

export async function SharingTab({ workspaceId, role, plan, userId }: { workspaceId: string; role: string; plan: "FREE" | "PRO"; userId: string }) {
  const { members, invites, left } = await sharingOverview(getDb(), workspaceId);
  const owner = role === "OWNER";
  const allowed = await canUse(plan, "compartido");
  const roleSelect = (name: string, value?: string) => (
    <select name={name} defaultValue={value ?? "EDITOR"}><option value="EDITOR">Carga y edita</option><option value="VIEWER">Solo mira</option></select>
  );
  return (
    <>
      <div className="card">
        <div className="chead"><div><h3>Personas en este espacio</h3><p className="sub">Comparten las mismas cuentas, pagos y movimientos. Cada uno entra con su propia cuenta y su propia contraseña.</p></div></div>
        <div className="list">{members.map((m) => (
          <div className="li" key={m.id} style={{ flexWrap: "wrap" }}>
            <div className="grow"><div className="t">{m.user.name}{m.userId === userId ? " (vos)" : ""}</div><div className="s">{m.user.email} · {ROLE_LABEL[m.role]}</div></div>
            {owner && m.role !== "OWNER" && (
              <div className="li-acts">
                <form action={changeRoleAction} className="acts"><input type="hidden" name="id" value={m.id} />{roleSelect("role", m.role)}<button className="btn sm" type="submit">Cambiar</button></form>
                <form action={removeMemberAction}><input type="hidden" name="id" value={m.id} /><ConfirmSubmit className="btn sm ghost" question={`¿Quitar a ${m.user.name} del espacio? Deja de ver tus datos.`} yes="Sí, quitar">Quitar</ConfirmSubmit></form>
              </div>
            )}
            {!owner && m.userId === userId && (
              <form action={leaveWorkspaceAction}><input type="hidden" name="workspaceId" value={workspaceId} /><ConfirmSubmit className="btn sm ghost" question="¿Salir de este espacio compartido? Dejás de verlo y volvés al tuyo." yes="Sí, salir">Salir del espacio</ConfirmSubmit></form>
            )}
          </div>
        ))}</div>
      </div>
      {owner && (
        <div className="card">
          <div className="chead"><div><h3>Invitar a alguien</h3><p className="sub">Hasta {MAX_GUESTS} personas: tu pareja, tu familia o quien te ayuda con las cuentas. Le llega un correo con un enlace que vence en 7 días.</p></div>{allowed && <span className="pill">{left} {left === 1 ? "lugar libre" : "lugares libres"}</span>}</div>
          {!allowed ? (
            <p className="sub">Compartir tu espacio es parte de Pro. <Link className="lnk" href="/app/configuracion?tab=plan">Ver Pro</Link></p>
          ) : left > 0 ? (
            <ActionForm action={inviteAction} className="frow" style={{ flexWrap: "wrap", alignItems: "flex-end" }}>
              <label className="field" style={{ flex: "2 1 220px" }}>Correo<input name="email" type="email" autoComplete="off" placeholder="nombre@correo.com" /></label>
              <label className="field" style={{ flex: "1 1 160px" }}>Puede{roleSelect("role")}</label>
              <Submit pending="Invitando…">Invitar</Submit>
            </ActionForm>
          ) : <p className="sub">Llegaste al máximo de {MAX_GUESTS} personas. Para invitar a otra, quitá a alguien o cancelá una invitación.</p>}
          {invites.length > 0 && (
            <div className="list" style={{ marginTop: 12 }}>{invites.map((i) => (
              <div className="li" key={i.id}>
                <div className="grow"><div className="t">{i.email}</div><div className="s">Invitación pendiente · {ROLE_LABEL[i.role]} · vence el {fmtDate(i.expiresAt)}</div></div>
                <form action={revokeInviteAction}><input type="hidden" name="id" value={i.id} /><ConfirmSubmit className="btn sm ghost" question={`¿Cancelar la invitación a ${i.email}? El enlace deja de servir.`} yes="Sí, cancelar">Cancelar</ConfirmSubmit></form>
              </div>
            ))}</div>
          )}
        </div>
      )}
      <div className="card"><details className="more"><summary>¿Qué puede hacer cada uno?</summary>
        <ul className="sub" style={{ margin: "8px 0 0", paddingLeft: 18 }}>
          <li><b>Carga y edita:</b> ve todo y puede cargar, cobrar, pagar y corregir movimientos.</li>
          <li><b>Solo mira:</b> ve todo, pero no puede cambiar nada.</li>
          <li>Solo el dueño invita o quita personas y maneja el plan. Pro alcanza para todos los que están en el espacio.</li>
        </ul>
      </details></div>
    </>
  );
}
