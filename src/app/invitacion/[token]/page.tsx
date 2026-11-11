import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, Submit } from "@/components/forms";
import { getDb } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { findInvite, ROLE_LABEL } from "@/server/sharing";
import { acceptInviteAction } from "@/app/actions/sharing";
import { logoutAction } from "@/app/actions/auth";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Invitación", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await findInvite(getDb(), token);
  if (!inv) {
    return (
      <AuthShell>
        <h1>La invitación ya no sirve</h1>
        <p className="sub">Venció, ya se usó o la cancelaron. Pedile a quien te invitó que te mande otra.</p>
        <Link className="btn pri auth-btn" href="/">Ir al inicio</Link>
      </AuthShell>
    );
  }
  const owner = inv.workspace.members[0]?.user.name ?? "Alguien";
  const s = await getSession();
  const me = s && (!s.user.totpEnabledAt || s.twoFactorVerified) ? s.user : null;
  const same = me && me.email.toLowerCase() === inv.email;
  return (
    <AuthShell>
      <h1>{owner} te invitó a su espacio</h1>
      <p className="sub">Vas a poder ver {inv.role === "VIEWER" ? "" : "y cargar "}sus cuentas, pagos y movimientos en {BRAND.name} ({ROLE_LABEL[inv.role].toLowerCase()}). Tu propio espacio sigue siendo tuyo y separado: cambiás entre los dos desde el menú de tu cuenta.</p>
      {!me ? (
        <>
          <p className="sub">La invitación es para <b>{inv.email}</b>. Entrá o creá tu cuenta con ese correo y volvés acá solo.</p>
          <Link className="btn pri auth-btn" href={`/invitacion/${token}/continuar?a=registro`}>Crear mi cuenta gratis</Link>
          <Link className="btn auth-btn" href={`/invitacion/${token}/continuar?a=ingresar`}>Ya tengo cuenta: ingresar</Link>
        </>
      ) : same ? (
        <ActionForm action={acceptInviteAction}>
          <input type="hidden" name="token" value={token} />
          <Submit className="btn pri auth-btn" pending="Uniéndote…">Aceptar invitación</Submit>
        </ActionForm>
      ) : (
        <>
          <p className="notice a"><span>Entraste como <b>{me.email}</b>, pero la invitación es para <b>{inv.email}</b>. Cerrá sesión y entrá con ese correo.</span></p>
          <form action={logoutAction}><button className="btn auth-btn" type="submit">Cerrar sesión</button></form>
        </>
      )}
    </AuthShell>
  );
}
