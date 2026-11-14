import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/brand";
import { ActionForm, OtpInput, Submit } from "@/components/forms";
import { Icon } from "@/components/icons";
import { requireUser } from "@/lib/auth/session";
import { resendVerifyAction, verifyEmailCodeAction } from "@/app/actions/app";
import { emailEnabled } from "@/server/email-verify";

export const metadata: Metadata = { title: "Confirmar correo", robots: { index: false, follow: false } };

export default async function ConfirmEmailPage() {
  const { user } = await requireUser();
  const verified = !!user.emailVerified;
  const enabled = emailEnabled();
  return (
    <AuthShell>
      <div className="vf email-confirm">
        <span className="vf-ic" aria-hidden="true"><Icon name={verified ? "check" : "lock"} /></span>
        <h1>{verified ? "Tu correo está confirmado" : "Confirmá tu correo"}</h1>
        {verified ? (
          <>
            <p className="sub">Listo, tu cuenta ya tiene el correo confirmado. Podés seguir usando somosguafra.</p>
            <Link href="/app" className="btn pri auth-btn">Volver a la app</Link>
          </>
        ) : enabled ? (
          <>
            <p className="sub">Ingresá el código de 6 números que te mandamos a <strong className="email-confirm-address">{user.email}</strong>.</p>
            <ActionForm action={verifyEmailCodeAction} className="vf-form">
              <OtpInput />
              <Submit className="btn pri auth-btn" pending="Confirmando…">Confirmar correo</Submit>
            </ActionForm>
            <p className="sub">El código vence en 30 minutos. Si no lo encontrás, revisá también la carpeta de spam.</p>
            <ActionForm action={resendVerifyAction} className="vf-form">
              <Submit className="btn auth-btn" pending="Enviando…">Mandame otro código</Submit>
            </ActionForm>
            <div className="vf-links"><Link className="lnk" href="/app">Volver a la app</Link><Link className="lnk" href="/contacto?area=soporte">Necesito ayuda</Link></div>
          </>
        ) : (
          <>
            <p className="sub">El envío de correos no está disponible en este momento. Probá más tarde o escribinos desde Contacto.</p>
            <div className="vf-links"><Link className="lnk" href="/app">Volver a la app</Link><Link className="lnk" href="/contacto?area=soporte">Contactar a soporte</Link></div>
          </>
        )}
      </div>
    </AuthShell>
  );
}
